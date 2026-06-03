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
	"strings"
	"sync"

	"gorm.io/gorm"
)

// --- auto.dev API response type ---

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

// --- NHTSA API response types ---

type nhtsaResponse struct {
	Results []nhtsaResult `json:"Results"`
}

type nhtsaResult struct {
	BrakeSystemType     string `json:"BrakeSystemType"`
	DisplacementL       string `json:"DisplacementL"`
	Doors               string `json:"Doors"`
	EngineConfiguration string `json:"EngineConfiguration"`
	EngineCylinders     string `json:"EngineCylinders"`
	GVWR                string `json:"GVWR"`
}

// --- concurrent fetch result wrappers ---

type autoDevResult struct {
	resp *autoDevResponse
	err  error
}

type nhtsaFetchResult struct {
	resp *nhtsaResult
	err  error
}

// --- VIN decode entry point ---

// DecodeVINAndSave calls the auto.dev and NHTSA VIN APIs concurrently, merges
// the results onto the provided Vehicle pointer, and upserts it into the database.
func DecodeVINAndSave(db *gorm.DB, vin string, vehicle *models.Vehicle) error {
	vin = strings.TrimSpace(strings.ToUpper(vin))

	rawToken := os.Getenv("AUTO_DEV_TOKEN")
	apiToken := strings.Trim(strings.TrimSpace(rawToken), `"`)
	if apiToken == "" {
		return fmt.Errorf("AUTO_DEV_TOKEN environment variable is not set")
	}
	log.Printf("[VIN decode] vin=%s token_len=%d token_prefix=%s",
		vin, len(apiToken), maskToken(apiToken))

	// Fire both API calls concurrently.
	var wg sync.WaitGroup
	wg.Add(2)

	autoCh := make(chan autoDevResult, 1)
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

	autoRes := <-autoCh
	nhtsaRes := <-nhtsaCh

	if autoRes.err != nil {
		return fmt.Errorf("auto.dev request failed: %w", autoRes.err)
	}
	if !autoRes.resp.VINValid {
		return fmt.Errorf("invalid VIN: %s", vin)
	}

	if nhtsaRes.err != nil {
		// NHTSA is supplementary — log and continue rather than failing the whole decode.
		log.Printf("[VIN decode] NHTSA fetch failed (non-fatal): %v", nhtsaRes.err)
	}

	if err := mapToVehicle(vin, autoRes.resp, nhtsaRes.resp, vehicle); err != nil {
		return fmt.Errorf("mapping failed: %w", err)
	}

	// Upsert: update all columns if BuildKey already exists.
	if err := db.Where(models.Vehicle{BuildKey: vehicle.BuildKey}).
		Assign(vehicle).
		FirstOrCreate(vehicle).Error; err != nil {
		return fmt.Errorf("database error: %w", err)
	}

	return nil
}

// --- auto.dev fetch ---

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

	log.Printf("[auto.dev] status=%d body=%s", resp.StatusCode, truncate(string(body), 300))

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("auto.dev returned status %d: %s", resp.StatusCode, truncate(string(body), 120))
	}
	fmt.Println(string(body))

	var result autoDevResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse auto.dev response: %w", err)
	}

	return &result, nil
}

// --- NHTSA fetch ---

func fetchNHTSA(vin string) (*nhtsaResult, error) {
	url := fmt.Sprintf("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/%s?format=json", vin)

	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	log.Printf("[nhtsa] status=%d body=%s", resp.StatusCode, truncate(string(body), 300))

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

// --- helpers ---

// maskToken shows the first 8 chars of a token followed by "…" for safe logging.
func maskToken(t string) string {
	if len(t) <= 8 {
		return strings.Repeat("*", len(t))
	}
	return t[:8] + "…"
}

// truncate caps a string at n bytes for log output.
func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// --- Mapping ---

// mapToVehicle merges auto.dev (primary) and NHTSA (supplementary) data onto v.
// nhtsa may be nil if the NHTSA request failed.
func mapToVehicle(vin string, r *autoDevResponse, nhtsa *nhtsaResult, v *models.Vehicle) error {
	year := r.Vehicle.Year
	if year == 0 {
		return fmt.Errorf("auto.dev returned no year for VIN %s", vin)
	}

	make_ := strings.TrimSpace(r.Vehicle.Make)
	model := strings.TrimSpace(r.Vehicle.Model)
	if make_ == "" || model == "" {
		return fmt.Errorf("auto.dev returned no Make/Model for VIN %s", vin)
	}

	buildKey := helpers.ExtractBuildKey(vin)

	// --- Fields from auto.dev ---
	v.BuildKey = buildKey
	v.ExampleBuildNumber = strings.TrimSpace(r.VIN)
	v.Year = year
	v.Make = strings.Title(strings.ToLower(make_))
	v.Model = model
	v.Trim = strings.TrimSpace(r.Trim)
	v.BodyType = strings.TrimSpace(r.Body)
	v.DriveType = normalizeDriveType(r.Drive)
	v.Country = strings.TrimSpace(r.Origin)
	v.TransmissionType = normalizeTransmission(r.Trans)

	v.Cylinders, v.DisplacementL, v.FuelType = parseEngineString(r.Engine)

	// --- Fields from NHTSA (fill gaps; prefer auto.dev where both provide a value) ---
	if nhtsa != nil {
		if v.Cylinders == "" && nhtsa.EngineCylinders != "" {
			v.Cylinders = strings.TrimSpace(nhtsa.EngineCylinders)
		}
		if v.DisplacementL == "" && nhtsa.DisplacementL != "" {
			v.DisplacementL = strings.TrimSpace(nhtsa.DisplacementL)
		}
		v.GVWR = strings.TrimSpace(nhtsa.GVWR)
		v.Doors = strings.TrimSpace(nhtsa.Doors)
		v.BrakeSystemType = strings.TrimSpace(nhtsa.BrakeSystemType)
		v.EngineConfiguration = strings.TrimSpace(nhtsa.EngineConfiguration)
	}

	// --- Not provided by either source; zeroed so existing DB rows are not
	//     left with stale values if you ever re-decode a VIN. ---
	v.Series = ""
	v.Speeds = 0
	v.ABS = ""
	v.BrakeCode = ""
	v.FrontBrakeType = ""
	v.RearBrakeType = ""
	v.FrontSpringType = ""
	v.RearSpringType = ""
	v.SteeringType = ""
	v.FrontRotorSize = ""
	v.RearRotorSize = ""

	return nil
}

// --- Engine string parser ---

// parseEngineString extracts cylinders, displacement, and fuel type from
// auto.dev's freeform engine string, e.g. "5.3L V8 OHV 16V FFV".
func parseEngineString(s string) (cylinders string, displacement string, fuelType string) {
	upper := strings.ToUpper(strings.TrimSpace(s))
	if upper == "" {
		return
	}

	// Displacement: match pattern like "5.3L" or "2L"
	for _, part := range strings.Fields(s) {
		p := strings.ToUpper(part)
		if strings.HasSuffix(p, "L") {
			candidate := strings.TrimSuffix(p, "L")
			// Validate it looks like a number (e.g. "5.3", "2")
			valid := len(candidate) > 0
			for _, c := range candidate {
				if c != '.' && (c < '0' || c > '9') {
					valid = false
					break
				}
			}
			if valid {
				displacement = strings.TrimSuffix(part, "L")
				displacement = strings.TrimSuffix(displacement, "l")
				break
			}
		}
	}

	// Cylinders: match pattern like "V8", "I4", "H6", "W12"
	for _, part := range strings.Fields(upper) {
		if len(part) >= 2 {
			prefix := part[0]
			if prefix == 'V' || prefix == 'I' || prefix == 'H' || prefix == 'W' {
				rest := part[1:]
				allDigits := len(rest) > 0
				for _, c := range rest {
					if c < '0' || c > '9' {
						allDigits = false
						break
					}
				}
				if allDigits {
					cylinders = rest
					break
				}
			}
		}
	}

	// Fuel type: inferred from engine string keywords
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

// --- Field normalizers ---

func normalizeDriveType(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	switch {
	case strings.Contains(s, "FWD") || strings.Contains(s, "FRONT"):
		return "FWD"
	case strings.Contains(s, "RWD") || strings.Contains(s, "REAR"):
		return "RWD"
	case strings.Contains(s, "AWD") || strings.Contains(s, "ALL-WHEEL") || strings.Contains(s, "ALL WHEEL DRIVE"):
		return "AWD"
	case strings.Contains(s, "4WD") || strings.Contains(s, "4X4") || strings.Contains(s, "FOUR-WHEEL"):
		return "4WD"
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
