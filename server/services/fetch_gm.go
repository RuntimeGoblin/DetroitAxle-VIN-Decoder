package services

// fetch_gm.go — GM Parts Giant VIN attribute fetcher.
// Site owner confirmed API use is permitted.
//
// IMPORTANT: GM data here (RPO / build-option codes) is VIN-specific — it is
// stamped per individual vehicle off the assembly line. It is fetched live on
// demand and NEVER persisted, because two vehicles that share a build key
// (same model/trim/engine) can carry completely different option packages.

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
// internal catalog metadata and aren't useful to display.
var rpoCleanRe = regexp.MustCompile(`^[A-Z0-9]+-?$`)

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
