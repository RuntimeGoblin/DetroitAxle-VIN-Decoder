package services

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"main/helpers"
	"main/models"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

// ─── auto.dev response ────────────────────────────────────────────────────────

type autoDevResponse struct {
	VIN      string `json:"vin"`
	VINValid bool   `json:"vinValid"`
	Origin   string `json:"origin"` // country of manufacture
	Make     string `json:"make"`
	Model    string `json:"model"`
	Trim     string `json:"trim"`
	Style    string `json:"style"`  // e.g. "4x4 4dr Crew Cab 5.8 ft. SB"
	Body     string `json:"body"`   // e.g. "Truck", "Sedan"
	Engine   string `json:"engine"` // e.g. "5.3L V8 OHV 16V FFV"
	Drive    string `json:"drive"`
	Trans    string `json:"transmission"`
	Vehicle  struct {
		Year  int    `json:"year"`
		Make  string `json:"make"`
		Model string `json:"model"`
	} `json:"vehicle"`
}

// ─── NHTSA DecodeVinValuesExtended response ───────────────────────────────────

type nhtsaResponse struct {
	Results []nhtsaResult `json:"Results"`
}

type nhtsaResult struct {
	// Engine / drivetrain
	EngineCylinders     string `json:"EngineCylinders"`
	DisplacementL       string `json:"DisplacementL"`
	EngineConfiguration string `json:"EngineConfiguration"` // "V", "Inline", etc.
	FuelTypePrimary     string `json:"FuelTypePrimary"`
	FuelTypeSecondary   string `json:"FuelTypeSecondary"`
	TransmissionStyle   string `json:"TransmissionStyle"`
	TransmissionSpeeds  string `json:"TransmissionSpeeds"`
	DriveType           string `json:"DriveType"`

	// Body
	BodyClass string `json:"BodyClass"` // "Pickup", "SUV", etc.
	Doors     string `json:"Doors"`

	// Identity — may fill gaps auto.dev misses
	ModelYear string `json:"ModelYear"`
	Make      string `json:"Make"`
	Model     string `json:"Model"`
	Trim      string `json:"Trim"`
	Series    string `json:"Series"`

	// Safety
	ABS             string `json:"ABS"`             // "Standard", "Optional", "Not Available"
	BrakeSystemType string `json:"BrakeSystemType"` // "Hydraulic", etc.

	// Weight
	GVWR string `json:"GVWR"`

	// Assembly plant (used to infer Country when auto.dev's Origin is blank)
	PlantCity        string `json:"PlantCity"`
	PlantCountry     string `json:"PlantCountry"`     // e.g. "UNITED STATES (USA)"
	PlantCompanyName string `json:"PlantCompanyName"` // e.g. "GENERAL MOTORS"

	// Decode quality
	ErrorCode string `json:"ErrorCode"` // "0" = clean decode
	ErrorText string `json:"ErrorText"`
	Note      string `json:"Note"`
}

// ─── Result wrappers (concurrency) ───────────────────────────────────────────

type autoDevResult struct {
	resp *autoDevResponse
	err  error
}

type nhtsaFetchResult struct {
	resp *nhtsaResult
	err  error
}

// ─── Entry point ─────────────────────────────────────────────────────────────

// DecodeVINAndSave fetches auto.dev + NHTSA concurrently, merges both sources
// onto vehicle, then upserts into the database.
//
// GM Parts Giant (RPO / build-option codes) is intentionally NOT called here.
// RPO codes are stamped per individual vehicle off the assembly line — saving
// them under a shared build key would corrupt all other vehicles in that group.
// Use GET /api/gm/decode/:vin for on-demand live lookup of a specific VIN.
func DecodeVINAndSave(db *gorm.DB, vin string, vehicle *models.Vehicle) error {
	vin = strings.TrimSpace(strings.ToUpper(vin))

	rawToken := os.Getenv("AUTO_DEV_TOKEN")
	apiToken := strings.Trim(strings.TrimSpace(rawToken), `"`)
	if apiToken == "" {
		return fmt.Errorf("AUTO_DEV_TOKEN environment variable is not set")
	}
	log.Printf("[VIN decode] vin=%s token_prefix=%s", vin, maskToken(apiToken))

	var wg sync.WaitGroup
	wg.Add(2)

	autoCh  := make(chan autoDevResult, 1)
	nhtsaCh := make(chan nhtsaFetchResult, 1)

	go func() {
		defer wg.Done()
		resp, err := fetchAutoDev(vin, apiToken)
		autoCh <- autoDevResult{resp, err}
	}()

	go func() {
		defer wg.Done()
		resp, err := fetchNHTSA(vin)
		nhtsaCh <- nhtsaFetchResult{resp, err}
	}()

	wg.Wait()
	close(autoCh)
	close(nhtsaCh)

	autoRes  := <-autoCh
	nhtsaRes := <-nhtsaCh

	if autoRes.err != nil {
		return fmt.Errorf("auto.dev request failed: %w", autoRes.err)
	}
	if !autoRes.resp.VINValid {
		return fmt.Errorf("invalid VIN: %s", vin)
	}
	if nhtsaRes.err != nil {
		log.Printf("[VIN decode] NHTSA fetch failed (non-fatal): %v", nhtsaRes.err)
	}

	if err := mapToVehicle(vin, autoRes.resp, nhtsaRes.resp, vehicle); err != nil {
		return fmt.Errorf("mapping failed: %w", err)
	}

	// Upsert.
	// Assign(*vehicle) passes a struct VALUE snapshot taken right now, before
	// FirstOrCreate scans the DB row back into the pointer — preventing the
	// enriched values from being silently overwritten by the DB read.
	if err := db.Where(models.Vehicle{BuildKey: vehicle.BuildKey}).
		Assign(*vehicle).
		FirstOrCreate(vehicle).Error; err != nil {
		return fmt.Errorf("database error: %w", err)
	}

	return nil
}

// ─── auto.dev fetch ───────────────────────────────────────────────────────────

func fetchAutoDev(vin, apiKey string) (*autoDevResponse, error) {
	url := fmt.Sprintf("https://api.auto.dev/vin/%s", vin)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("[auto.dev] vin=%s status=%d body=%s", vin, resp.StatusCode, truncate(string(body), 400))

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("auto.dev returned status %d: %s", resp.StatusCode, truncate(string(body), 120))
	}

	var result autoDevResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse auto.dev response: %w", err)
	}

	return &result, nil
}

// ─── NHTSA fetch ─────────────────────────────────────────────────────────────

func fetchNHTSA(vin string) (*nhtsaResult, error) {
	url := fmt.Sprintf("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/%s?format=json", vin)

	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("[nhtsa] vin=%s status=%d body=%s", vin, resp.StatusCode, truncate(string(body), 400))

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("NHTSA returned status %d: %s", resp.StatusCode, truncate(string(body), 120))
	}

	var result nhtsaResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse NHTSA response: %w", err)
	}
	if len(result.Results) == 0 {
		return nil, fmt.Errorf("NHTSA returned empty results for VIN %s", vin)
	}

	return &result.Results[0], nil
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

// mapToVehicle merges auto.dev (primary) and NHTSA (supplementary) data onto v.
// Layer priority (highest → lowest):  auto.dev  →  NHTSA  →  VIN-derived  →  existing DB value
//
// GM Parts Giant data is NOT applied here — it is fetched live on demand and
// never persisted (RPO codes are per-VIN, not per build key).
func mapToVehicle(vin string, r *autoDevResponse, nhtsa *nhtsaResult, v *models.Vehicle) error {
	// ── Resolve YEAR (auto.dev → NHTSA → VIN 10th-char decode) ───────────────
	// auto.dev omits vehicle.year for some VIN types (e.g. incomplete/chassis
	// cabs), so we can't hard-require it. NHTSA's ModelYear is reliable, and the
	// VIN itself encodes the model year in position 10 as a last resort.
	year := r.Vehicle.Year
	if year == 0 && nhtsa != nil {
		if y, err := strconv.Atoi(strings.TrimSpace(nhtsa.ModelYear)); err == nil {
			year = y
		}
	}
	if year == 0 {
		year = modelYearFromVIN(vin)
	}
	if year == 0 {
		return fmt.Errorf("could not determine model year for VIN %s", vin)
	}

	// ── Resolve MAKE / MODEL ─────────────────────────────────────────────────
	// auto.dev's top-level make/model are present even when the nested vehicle
	// object is sparse; fall back to the nested object, then to NHTSA.
	make_ := coalesce(r.Make, r.Vehicle.Make, nhtsaStr(nhtsa, func(n *nhtsaResult) string { return n.Make }))
	model := coalesce(r.Model, r.Vehicle.Model, nhtsaStr(nhtsa, func(n *nhtsaResult) string { return n.Model }))
	if make_ == "" || model == "" {
		return fmt.Errorf("could not determine make/model for VIN %s", vin)
	}

	buildKey := helpers.ExtractBuildKey(vin)

	// ── Layer 1: auto.dev (authoritative for identity) ───────────────────────
	v.BuildKey           = buildKey
	v.ExampleBuildNumber = strings.TrimSpace(r.VIN)
	v.Year               = year
	v.Make               = normalizeMake(make_) // preserve acronyms like GMC, BMW
	v.Model              = model
	v.Trim               = strings.TrimSpace(r.Trim)
	v.BodyType           = strings.TrimSpace(r.Body)
	v.DriveType          = normalizeDriveType(r.Drive)
	v.Country            = strings.TrimSpace(r.Origin)
	v.TransmissionType   = normalizeTransmission(r.Trans)

	v.Cylinders, v.DisplacementL, v.FuelType = parseEngineString(r.Engine)

	// ── Layer 2: NHTSA (fills gaps auto.dev misses) ──────────────────────────
	if nhtsa != nil {
		// Log NHTSA decode warnings without failing the whole request.
		if nhtsa.ErrorCode != "" && nhtsa.ErrorCode != "0" {
			log.Printf("[VIN decode] NHTSA warning vin=%s code=%s: %s",
				vin, nhtsa.ErrorCode, truncate(nhtsa.ErrorText, 120))
		}

		// Engine gaps
		if v.Cylinders == "" && nhtsa.EngineCylinders != "" {
			v.Cylinders = strings.TrimSpace(nhtsa.EngineCylinders)
		}
		if v.DisplacementL == "" && nhtsa.DisplacementL != "" {
			v.DisplacementL = strings.TrimSpace(nhtsa.DisplacementL)
		}
		if v.EngineConfiguration == "" && nhtsa.EngineConfiguration != "" {
			v.EngineConfiguration = strings.TrimSpace(nhtsa.EngineConfiguration)
		}

		// Body
		if v.Doors == "" && nhtsa.Doors != "" {
			v.Doors = strings.TrimSpace(nhtsa.Doors)
		}
		if v.BodyType == "" && nhtsa.BodyClass != "" {
			v.BodyType = strings.TrimSpace(nhtsa.BodyClass)
		}
		if v.BrakeSystemType == "" && nhtsa.BrakeSystemType != "" {
			v.BrakeSystemType = strings.TrimSpace(nhtsa.BrakeSystemType)
		}

		// Weight — NHTSA is usually reliable; GM will overwrite with exact value if available
		if nhtsa.GVWR != "" {
			v.GVWR = strings.TrimSpace(nhtsa.GVWR)
		}

		// Trim — NHTSA often has the full trim string when auto.dev is blank
		if v.Trim == "" && nhtsa.Trim != "" {
			v.Trim = strings.TrimSpace(nhtsa.Trim)
		}

		// Series — fill for non-GM cars (GM's MapToVehicle will overwrite for GM cars)
		if v.Series == "" && nhtsa.Series != "" {
			v.Series = strings.TrimSpace(nhtsa.Series)
		}

		// Drive type — fill if auto.dev was blank
		if v.DriveType == "" && nhtsa.DriveType != "" {
			v.DriveType = normalizeDriveType(nhtsa.DriveType)
		}

		// Transmission speeds
		if v.Speeds == 0 && nhtsa.TransmissionSpeeds != "" {
			if n, err := strconv.Atoi(strings.TrimSpace(nhtsa.TransmissionSpeeds)); err == nil && n > 0 {
				v.Speeds = n
			}
		}

		// Transmission type — fill if auto.dev was blank
		if v.TransmissionType == "" && nhtsa.TransmissionStyle != "" {
			v.TransmissionType = normalizeTransmission(nhtsa.TransmissionStyle)
		}

		// Fuel type — NHTSA FuelTypePrimary+Secondary is more precise than auto.dev's
		// engine-string inference (catches flex-fuel, hybrid, hydrogen, etc.).
		// Only upgrade if auto.dev left us with the generic "Gasoline" default.
		if nhtsa.FuelTypePrimary != "" {
			if ft := normalizeNHTSAFuelType(nhtsa.FuelTypePrimary, nhtsa.FuelTypeSecondary); ft != "" {
				if v.FuelType == "" || v.FuelType == "Gasoline" {
					v.FuelType = ft
				}
			}
		}

		// ABS — NHTSA is the standard source for this
		if nhtsa.ABS != "" {
			v.ABS = strings.TrimSpace(nhtsa.ABS)
		}

		// Country — fall back to NHTSA plant country when auto.dev Origin is blank
		if v.Country == "" && nhtsa.PlantCountry != "" {
			v.Country = cleanNHTSACountry(nhtsa.PlantCountry)
		}
	}

	return nil
}

// ─── Engine string parser ─────────────────────────────────────────────────────

// parseEngineString extracts cylinders, displacement, and fuel type from
// auto.dev's freeform engine string. Handles both common formats:
//   "5.3L V8 OHV 16V FFV"        (displacement+L, V8)
//   "6.0, 8 Cylinder Engine"     (bare float, "N Cylinder")
// Any field this can't parse is left empty for NHTSA to fill.
func parseEngineString(s string) (cylinders, displacement, fuelType string) {
	upper := strings.ToUpper(strings.TrimSpace(s))
	if upper == "" {
		return
	}
	fields := strings.Fields(upper)

	// Displacement, pass 1: a token ending in "L" whose stem is numeric ("5.3L").
	for _, p := range fields {
		if strings.HasSuffix(p, "L") {
			stem := strings.TrimSuffix(p, "L")
			if isNumericFloat(stem) {
				displacement = stem
				break
			}
		}
	}
	// Displacement, pass 2: a bare decimal token ("6.0", "6.0,"). Must contain a
	// dot so we never mistake the cylinder count ("8") for displacement.
	if displacement == "" {
		for _, p := range fields {
			stem := strings.Trim(p, ",;")
			if strings.Contains(stem, ".") && isNumericFloat(stem) {
				displacement = stem
				break
			}
		}
	}

	// Cylinders, pass 1: "V8", "I4", "H6", "W12".
	for _, p := range fields {
		if len(p) >= 2 {
			switch p[0] {
			case 'V', 'I', 'H', 'W':
				if rest := p[1:]; isAllDigits(rest) {
					cylinders = rest
				}
			}
		}
		if cylinders != "" {
			break
		}
	}
	// Cylinders, pass 2: "8 CYLINDER" — the digit token immediately before "CYLINDER".
	if cylinders == "" {
		for i, p := range fields {
			if strings.HasPrefix(p, "CYLINDER") && i > 0 {
				if prev := strings.Trim(fields[i-1], ",;"); isAllDigits(prev) {
					cylinders = prev
					break
				}
			}
		}
	}

	// Fuel type from engine string keywords (rough pass; NHTSA refines later).
	switch {
	case strings.Contains(upper, "FFV") || strings.Contains(upper, "FLEX"):
		fuelType = "Flex Fuel"
	case strings.Contains(upper, "DIESEL"):
		fuelType = "Diesel"
	case strings.Contains(upper, "ELECTRIC"):
		fuelType = "Electric"
	case strings.Contains(upper, "HYBRID"):
		fuelType = "Hybrid"
	default:
		fuelType = "Gasoline"
	}

	return
}

// isNumericFloat reports whether s is a non-empty run of digits with at most one dot.
func isNumericFloat(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		if c != '.' && (c < '0' || c > '9') {
			return false
		}
	}
	return true
}

// isAllDigits reports whether s is a non-empty run of digits.
func isAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// ─── Field normalizers ────────────────────────────────────────────────────────

func normalizeDriveType(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	switch {
	case strings.Contains(s, "4WD") || strings.Contains(s, "4X4") ||
		(strings.Contains(s, "FOUR") && strings.Contains(s, "WHEEL")):
		return "4WD"
	case strings.Contains(s, "AWD") ||
		(strings.Contains(s, "ALL") && strings.Contains(s, "WHEEL")):
		return "AWD"
	case strings.Contains(s, "FWD") ||
		(strings.Contains(s, "FRONT") && strings.Contains(s, "WHEEL")):
		return "FWD"
	case strings.Contains(s, "RWD") ||
		(strings.Contains(s, "REAR") && strings.Contains(s, "WHEEL")):
		return "RWD"
	default:
		return s
	}
}

func normalizeTransmission(s string) string {
	upper := strings.ToUpper(strings.TrimSpace(s))
	switch {
	case strings.Contains(upper, "MANUAL"):
		return "Manual"
	case strings.Contains(upper, "CVT") || strings.Contains(upper, "CONTINUOUSLY"):
		return "CVT"
	case strings.Contains(upper, "DUAL") || strings.Contains(upper, "DCT") || strings.Contains(upper, "PDK"):
		return "DCT"
	case strings.Contains(upper, "AUTOMATIC"):
		return "Automatic"
	default:
		return strings.TrimSpace(s)
	}
}

// normalizeNHTSAFuelType maps NHTSA's FuelTypePrimary+Secondary to our standard labels.
func normalizeNHTSAFuelType(primary, secondary string) string {
	combined := strings.ToUpper(primary + " " + secondary)
	switch {
	case strings.Contains(combined, "FFV") || strings.Contains(combined, "FLEX") ||
		strings.Contains(combined, "E85"):
		return "Flex Fuel"
	case strings.Contains(combined, "DIESEL"):
		return "Diesel"
	case strings.Contains(combined, "ELECTRIC") && strings.Contains(combined, "GAS"):
		return "Hybrid"
	case strings.Contains(combined, "ELECTRIC") || strings.Contains(combined, "BEV"):
		return "Electric"
	case strings.Contains(combined, "NATURAL GAS") || strings.Contains(combined, "CNG"):
		return "Natural Gas"
	case strings.Contains(combined, "HYDROGEN"):
		return "Hydrogen"
	case strings.Contains(combined, "GASOLINE") || strings.Contains(combined, "GAS"):
		return "Gasoline"
	default:
		return ""
	}
}

// cleanNHTSACountry strips the abbreviation in parentheses and title-cases.
// Example: "UNITED STATES (USA)" → "United States"
func cleanNHTSACountry(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.Index(s, "("); i > 0 {
		s = strings.TrimSpace(s[:i])
	}
	return strings.Title(strings.ToLower(s))
}

// ─── Identity helpers ─────────────────────────────────────────────────────────

// coalesce returns the first non-empty trimmed string.
func coalesce(vals ...string) string {
	for _, v := range vals {
		if t := strings.TrimSpace(v); t != "" {
			return t
		}
	}
	return ""
}

// nhtsaStr safely reads a field from a possibly-nil NHTSA result.
func nhtsaStr(n *nhtsaResult, get func(*nhtsaResult) string) string {
	if n == nil {
		return ""
	}
	return get(n)
}

// normalizeMake trims the make and fixes ONLY the all-uppercase case
// (e.g. "CHEVROLET" → "Chevrolet"). Mixed-case values from auto.dev such as
// "GMC", "BMW", "Chevrolet" are returned untouched so acronyms stay intact.
func normalizeMake(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if s == strings.ToUpper(s) && len(s) > 3 {
		// All caps and longer than a typical acronym → title-case it.
		return strings.Title(strings.ToLower(s))
	}
	return s
}

// vinYearCodes maps the VIN's 10th character to the FIRST model year it
// represents (starting 1980). The code repeats on a 30-year cycle; the letters
// I, O, Q, U, Z and the digit 0 are never used in position 10.
var vinYearCodes = map[byte]int{
	'A': 1980, 'B': 1981, 'C': 1982, 'D': 1983, 'E': 1984, 'F': 1985,
	'G': 1986, 'H': 1987, 'J': 1988, 'K': 1989, 'L': 1990, 'M': 1991,
	'N': 1992, 'P': 1993, 'R': 1994, 'S': 1995, 'T': 1996, 'V': 1997,
	'W': 1998, 'X': 1999, 'Y': 2000,
	'1': 2001, '2': 2002, '3': 2003, '4': 2004, '5': 2005,
	'6': 2006, '7': 2007, '8': 2008, '9': 2009,
}

// modelYearFromVIN decodes the model year from the VIN's 10th character.
// Because the code cycles every 30 years, we pick the most recent candidate
// that is no later than next model year relative to today. Returns 0 if the
// VIN is too short or the character is invalid.
func modelYearFromVIN(vin string) int {
	vin = strings.ToUpper(strings.TrimSpace(vin))
	if len(vin) < 10 {
		return 0
	}
	base, ok := vinYearCodes[vin[9]]
	if !ok {
		return 0
	}
	cutoff := time.Now().Year() + 1
	best := base
	for y := base + 30; y <= cutoff; y += 30 {
		best = y
	}
	return best
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func maskToken(t string) string {
	if len(t) <= 8 {
		return strings.Repeat("*", len(t))
	}
	return t[:8] + "…"
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
