package services

// fetch_gm.go — GM Parts Giant VIN attribute fetcher.
// Site owner confirmed API use is permitted.
//
// Two distinct uses of GM data, with very different persistence rules:
//
//  1. Build-key-STABLE fields (Series, Speeds, Engine-derived) come from GM's
//     majorAttribute section. They are fixed by the VIN's VDS/model, so every
//     vehicle sharing a build key has identical values — SAFE to persist.
//     See ApplyStableFields (called during decode).
//
//  2. VIN-SPECIFIC fields — the entire `specification` array of RPO codes,
//     including the brake code (BRK/BKS) — are stamped per individual unit off
//     the assembly line. These are NEVER persisted; they are fetched live on
//     demand and shown read-only. See FormatAsJSON (served by /api/gm/decode).

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"
	"main/models"
)

const gmDecodeURL = "https://www.gmpartsgiant.com/api/vehicle/mul/decode-vin-attributes"

// ErrGMNoData means GM Parts Giant responded successfully but has no build data
// for this VIN (e.g. an upfitter-built incomplete vehicle). Callers should treat
// this as a clean "not found", not a server error.
var ErrGMNoData = errors.New("no GM build data for this VIN")

var gmClient = &http.Client{
	Timeout: 15 * time.Second,
}

// --- Response types ---

type gmAPIResponse struct {
	Code int       `json:"code"`
	Data gmAPIData `json:"data"`
}

type gmAPIData struct {
	VinInfos []gmVinInfo `json:"vinInfos"`
}

type gmVinInfo struct {
	VehicleInfo        string       `json:"vehicleInfo"`
	RequiredInfo       string       `json:"requiredInfo"`
	OptionalInfo       string       `json:"optionalInfo"`
	RedirectURL        string       `json:"redirectUrl"`
	VehicleInformation []gmNameDesc `json:"vehicleInformation"`
	MajorAttribute     []gmNameDesc `json:"majorAttribute"`
	Specification      []gmNameDesc `json:"specification"`
}

type gmNameDesc struct {
	Name string `json:"name"`
	Desc string `json:"desc"`
}

// GMVINAttributes holds the parsed response from GM Parts Giant.
type GMVINAttributes struct {
	VinInfos []gmVinInfo
}

// --- HTTP fetch ---

// FetchGMAttributes calls the GM Parts Giant VIN decode API.
// Retries once after 2 s on 429 or 503. Returns ErrGMNoData when the VIN
// decodes successfully but carries no build data.
func FetchGMAttributes(vin string) (*GMVINAttributes, error) {
	const maxAttempts = 2
	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		attrs, err := doGMFetch(vin)
		if err == nil {
			return attrs, nil
		}
		// Don't retry a definitive "no data" result.
		if errors.Is(err, ErrGMNoData) {
			return nil, err
		}
		lastErr = err
		if attempt < maxAttempts {
			log.Printf("[gm-parts-giant] attempt %d failed: %v — retrying after 2s", attempt, err)
			time.Sleep(2 * time.Second)
		}
	}
	return nil, lastErr
}

func doGMFetch(vin string) (*GMVINAttributes, error) {
	payload, err := json.Marshal(map[string]string{"vin": vin})
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, gmDecodeURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	guid := gmUUID()
	now := time.Now()
	logKey := fmt.Sprintf("%d%02d.%014d", now.UnixMilli(), now.UnixNano()%100, now.UnixNano()%int64(1e14))
	vinURL := "https://www.gmpartsgiant.com/vin-decoder.html?vin=" + vin

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("If-Modified-Since", "0")
	req.Header.Set("Origin", "https://www.gmpartsgiant.com")
	req.Header.Set("Pragma", "no-cache")
	req.Header.Set("Referer", vinURL)
	req.Header.Set("Sec-Fetch-Dest", "empty")
	req.Header.Set("Sec-Fetch-Mode", "cors")
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
	req.Header.Set("accessToken", "")
	req.Header.Set("currentHost", "www.gmpartsgiant.com")
	req.Header.Set("currentUrl", vinURL)
	req.Header.Set("guid", guid)
	req.Header.Set("logkey", logKey)
	req.Header.Set("site", "GPG")

	resp, err := gmClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("[gm-parts-giant] vin=%s status=%d body=%s", vin, resp.StatusCode, truncate(string(body), 400))

	if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusServiceUnavailable {
		return nil, fmt.Errorf("rate limited (status %d)", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, truncate(string(body), 120))
	}

	var apiResp gmAPIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("parse: %w", err)
	}
	// code 200 with zero vinInfos = decoded fine, but no build data for this VIN.
	if len(apiResp.Data.VinInfos) == 0 {
		return nil, ErrGMNoData
	}

	return &GMVINAttributes{VinInfos: apiResp.Data.VinInfos}, nil
}

// --- Live formatter ---

// rpoCleanRe matches a spec description that is ONLY a routing code with no
// human-readable text, e.g. "TL1-", "L-", "0495-", "2014-". These are GM's
// internal catalog metadata and aren't useful to display. The trailing dash is
// REQUIRED so we never drop a legitimate single-word description like "STANDARD".
var rpoCleanRe = regexp.MustCompile(`^[A-Z0-9]+-$`)

// FormatAsJSON returns GM Parts Giant's full native structure for this VIN,
// ready to be JSON-serialised in an HTTP response. Nothing is dropped except
// pure catalog-routing metadata rows; every real RPO / build-option code is
// preserved so the team can see the exact per-VIN equipment.
func (a *GMVINAttributes) FormatAsJSON() map[string]any {
	if a == nil || len(a.VinInfos) == 0 {
		return nil
	}
	info := a.primaryVinInfo()
	if info == nil {
		return nil
	}

	out := map[string]any{
		"vehicle_information": cleanNameDescList(info.VehicleInformation, false),
		"major_attributes":    cleanNameDescList(info.MajorAttribute, false),
		"specifications":      cleanNameDescList(info.Specification, true),
	}
	if v := strings.TrimSpace(info.VehicleInfo); v != "" {
		out["vehicle_info"] = v
	}
	if v := strings.TrimSpace(info.RedirectURL); v != "" {
		out["redirect_url"] = v
	}
	if v := strings.TrimSpace(info.RequiredInfo); v != "" {
		out["required_info"] = v
	}
	if v := strings.TrimSpace(info.OptionalInfo); v != "" {
		out["optional_info"] = v
	}
	return out
}

// cleanNameDescList trims entries and (when dropMeta is true) removes rows whose
// description is just a routing code with no descriptive text.
func cleanNameDescList(items []gmNameDesc, dropMeta bool) []map[string]string {
	out := make([]map[string]string, 0, len(items))
	for _, it := range items {
		name := strings.TrimSpace(it.Name)
		desc := strings.TrimSpace(it.Desc)
		if desc == "" {
			continue
		}
		if dropMeta && rpoCleanRe.MatchString(desc) {
			continue // pure metadata like "TL1-", "2014-"
		}
		out = append(out, map[string]string{"name": name, "desc": desc})
	}
	return out
}

// primaryVinInfo returns the first vinInfo that has specification data.
func (a *GMVINAttributes) primaryVinInfo() *gmVinInfo {
	for i := range a.VinInfos {
		if len(a.VinInfos[i].Specification) > 0 {
			return &a.VinInfos[i]
		}
	}
	if len(a.VinInfos) > 0 {
		return &a.VinInfos[0]
	}
	return nil
}

// --- Persisted enrichment (build-key-stable fields only) ---

// ApplyStableFields writes ONLY the GM values that are encoded in the VIN's
// VDS (positions 4–8) — i.e. provably identical for every vehicle that shares
// this build key. These come from GM's majorAttribute section, never from the
// per-VIN `specification` RPO list.
//
// Hard rules (so a sibling vehicle sharing the build key is never corrupted):
//   - Only VDS-encoded attributes: series, trim, and engine (cylinders/
//     displacement/fuel). Transmission is intentionally EXCLUDED — it is not
//     encoded in the VDS for GM, so it can differ between two units with the
//     same build key.
//   - Fill-only-when-empty: GM never overwrites a value auto.dev / NHTSA / a
//     human already set.
//   - NEVER touch brake code, brake/suspension/steering types, GVWR, country,
//     speeds, or any individual RPO option — those vary per unit (live-only).
func (a *GMVINAttributes) ApplyStableFields(v *models.Vehicle) {
	if a == nil {
		return
	}
	info := a.primaryVinInfo()
	if info == nil {
		return
	}
	major := gmToMap(info.MajorAttribute)

	modelString := major["Model String"]

	// Series — from "Model String" (e.g. "Silverado 1500 Crew Cab" → "1500").
	// A different series is a different VDS, so this is build-key-stable. GM is
	// often the only source, since auto.dev/NHTSA frequently omit it for trucks.
	if v.Series == "" {
		if s := parseGMSeries(modelString); s != "" {
			v.Series = s
		}
	}

	// Trim — GM is the most accurate source for trim level. It wraps the trim in
	// single quotes in the model string (e.g. "Terrain 'SLT' SUV" → "SLT"). For
	// GM the trim is generally encoded in the VDS, so it is build-key-stable.
	// Fill-only-when-empty: we never overwrite a trim auto.dev/NHTSA/a human set.
	if v.Trim == "" {
		if t := parseGMTrim(modelString); t != "" {
			v.Trim = t
		}
	}

	// Engine-derived: cylinders / displacement (VDS-encoded) + fuel hint.
	cyl, disp, fuel := parseGMEngine(major["Engine"])
	if v.Cylinders == "" && cyl != "" {
		v.Cylinders = cyl
	}
	if v.DisplacementL == "" && disp != "" {
		v.DisplacementL = disp
	}
	// Fuel: only upgrade the generic "Gasoline"/empty default (GM "E85 MAX" etc.).
	if fuel != "" && (v.FuelType == "" || v.FuelType == "Gasoline") {
		v.FuelType = fuel
	}
}

// EnrichExistingWithGM backfills GM build-key-stable fields onto an
// already-persisted vehicle (a cache hit on search, or an import that skipped
// an existing record) and marks it gm_checked so we only ever do this once.
//
// It is a no-op when the vehicle is already checked, or when vin isn't a
// GM-brand 17-char VIN. Like ApplyStableFields it only FILLS empty fields, so a
// human's edits and a sibling's values are never overwritten.
func EnrichExistingWithGM(db *gorm.DB, vin string, v *models.Vehicle) error {
	vin = strings.TrimSpace(strings.ToUpper(vin))
	if v.GMChecked || len(vin) != 17 || !IsGMBrandVIN(vin) {
		return nil
	}

	attrs, err := FetchGMAttributes(vin)
	if err != nil {
		if errors.Is(err, ErrGMNoData) {
			// GM has no data for this VIN — mark checked so we don't retry.
			v.GMChecked = true
			return db.Model(&models.Vehicle{}).
				Where("build_key = ?", v.BuildKey).
				Update("gm_checked", true).Error
		}
		return err // transient — leave unchecked so a later access retries
	}

	attrs.ApplyStableFields(v)
	v.GMChecked = true

	return db.Model(&models.Vehicle{}).
		Where("build_key = ?", v.BuildKey).
		Updates(map[string]any{
			"trim":           v.Trim,
			"series":         v.Series,
			"cylinders":      v.Cylinders,
			"displacement_l": v.DisplacementL,
			"fuel_type":      v.FuelType,
			"gm_checked":     true,
		}).Error
}

// gmToMap converts a []gmNameDesc into a name→desc map, trimming both sides so
// stray whitespace in the API response never breaks a lookup like major["Engine"].
func gmToMap(items []gmNameDesc) map[string]string {
	m := make(map[string]string, len(items))
	for _, it := range items {
		m[strings.TrimSpace(it.Name)] = strings.TrimSpace(it.Desc)
	}
	return m
}

// parseGMTrim extracts the trim from a GM model string. GM wraps the trim in
// single quotes, e.g. "Terrain 'SLT' SUV" → "SLT". Returns "" when absent.
func parseGMTrim(modelString string) string {
	i := strings.Index(modelString, "'")
	if i < 0 {
		return ""
	}
	rest := modelString[i+1:]
	j := strings.Index(rest, "'")
	if j < 0 {
		return ""
	}
	return strings.TrimSpace(rest[:j])
}

// parseGMSeries extracts the numeric series designation from a model string.
// "Silverado 1500 Crew Cab" → "1500"; "Sierra 2500HD" → "2500HD".
func parseGMSeries(modelString string) string {
	for _, tok := range strings.Fields(modelString) {
		base := strings.TrimSuffix(strings.TrimSuffix(strings.ToUpper(tok), "HD"), "LD")
		if len(base) >= 3 && len(base) <= 4 && isAllDigits(base) {
			return strings.Trim(tok, "'\"")
		}
	}
	return ""
}

// parseGMEngine pulls cylinders, displacement, and a fuel hint from a GM engine
// string, e.g. "4 Cyl 2.4L SIDI, DOHC, E85 MAX, ALUM".
func parseGMEngine(desc string) (cylinders, displacement, fuelType string) {
	upper := strings.ToUpper(desc)
	for _, tok := range strings.Fields(upper) {
		t := strings.Trim(tok, ",;")
		// Displacement: "2.4L" or bare "2.4".
		if displacement == "" {
			stem := strings.TrimSuffix(t, "L")
			if strings.Contains(stem, ".") && isNumericFloat(stem) {
				displacement = stem
			}
		}
	}
	// Cylinders: "<n> CYL" / "<n> CYLINDER".
	fields := strings.Fields(upper)
	for i, tok := range fields {
		if strings.HasPrefix(tok, "CYL") && i > 0 {
			if prev := strings.Trim(fields[i-1], ",;"); isAllDigits(prev) {
				cylinders = prev
				break
			}
		}
	}
	switch {
	case strings.Contains(upper, "E85") || strings.Contains(upper, "FLEX") || strings.Contains(upper, "FFV"):
		fuelType = "Flex Fuel"
	case strings.Contains(upper, "DIESEL"):
		fuelType = "Diesel"
	case strings.Contains(upper, "ELECTRIC"):
		fuelType = "Electric"
	case strings.Contains(upper, "HYBRID"):
		fuelType = "Hybrid"
	}
	return
}

// --- Brand detection ---

// IsGMBrandVIN reports whether the VIN's World Manufacturer Identifier belongs
// to a standard GM plant. NOTE: this is a fast-path hint only — some GM-branded
// vehicles (e.g. upfitter-built chassis cabs) carry a non-GM WMI, so callers
// should not hard-reject a VIN solely because this returns false.
//
//   - GM North America (USA / Canada / Mexico): WMI starts with 1G, 2G, 3G
//   - GM Korea (Chevrolet/Buick/Cadillac built in Korea): KL4, KL8, KL1
//   - GM Germany (Opel): W0L
func IsGMBrandVIN(vin string) bool {
	if len(vin) < 3 {
		return false
	}
	upper := strings.ToUpper(vin)
	switch upper[:2] {
	case "1G", "2G", "3G":
		return true
	}
	switch upper[:3] {
	case "KL4", "KL8", "KL1", "W0L":
		return true
	}
	return false
}

// --- Shared utilities ---

// gmUUID generates a random UUID v4 string using crypto/rand (no external deps).
func gmUUID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		t := time.Now().UnixNano()
		for i := range b {
			b[i] = byte(t >> (i % 8 * 8))
		}
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
