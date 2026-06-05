package helpers

import (
	"encoding/json"
	"fmt"
	"main/models"
	"math"
	"strconv"
	"strings"
)

/* ── Fit result constants ─────────────────────────────────────────── */

type FitResult int

const (
	FitNone     FitResult = 0 // required condition failed or callout explicitly mismatched
	FitWithNote FitResult = 1 // required conditions pass, but a callout field is missing
	FitExact    FitResult = 2 // all required conditions + all callouts verified
)

type EvalResult struct {
	Result   FitResult
	Notes    []string // callout notes — populated for FitWithNote
	RuleNote string   // the matched rule's own descriptive note (e.g. "14.29 inch rotor")
}

/* ── Field name normalisation ─────────────────────────────────────
   "engine_chassis" == "engine-chassis" == "Engine Chassis" == "enginechassis"
   All comparisons go through here so the matching is always case/format
   agnostic — even if the DNR team entered "EngineChasis" in custom fields.
────────────────────────────────────────────────────────────────── */

func normalizeKey(s string) string {
	s = strings.ToLower(s)
	s = strings.NewReplacer(" ", "", "-", "", "_", "").Replace(s)
	return s
}

/* ── Standard field value resolver ───────────────────────────────── */

var standardFieldMap = map[string]func(models.Vehicle) string{
	"year":             func(v models.Vehicle) string { return fmt.Sprintf("%d", v.Year) },
	"make":             func(v models.Vehicle) string { return v.Make },
	"model":            func(v models.Vehicle) string { return v.Model },
	"trim":             func(v models.Vehicle) string { return v.Trim },
	"series":           func(v models.Vehicle) string { return v.Series },
	"bodytype":         func(v models.Vehicle) string { return v.BodyType },
	"drivetype":        func(v models.Vehicle) string { return v.DriveType },
	"country":          func(v models.Vehicle) string { return v.Country },
	"cylinders":        func(v models.Vehicle) string { return v.Cylinders },
	"displacementl":    func(v models.Vehicle) string { return v.DisplacementL },
	"fueltype":         func(v models.Vehicle) string { return v.FuelType },
	"transmissiontype": func(v models.Vehicle) string { return v.TransmissionType },
	"speeds":           func(v models.Vehicle) string { return fmt.Sprintf("%d", v.Speeds) },
	"doors":            func(v models.Vehicle) string { return v.Doors },
	"abs":              func(v models.Vehicle) string { return v.ABS },
	"frontbraketype":   func(v models.Vehicle) string { return v.FrontBrakeType },
	"rearbraketype":    func(v models.Vehicle) string { return v.RearBrakeType },
	"frontrotorsize":   func(v models.Vehicle) string { return v.FrontRotorSize },
	"rearrotorsize":    func(v models.Vehicle) string { return v.RearRotorSize },
	"brakecode":        func(v models.Vehicle) string { return v.BrakeCode },
	"brakesystemtype":  func(v models.Vehicle) string { return v.BrakeSystemType },
	"frontspringtype":  func(v models.Vehicle) string { return v.FrontSpringType },
	"rearspringtype":   func(v models.Vehicle) string { return v.RearSpringType },
	"steeringtype":     func(v models.Vehicle) string { return v.SteeringType },
	"gvwr":             func(v models.Vehicle) string { return v.GVWR },
	"gvwrlbs":          func(v models.Vehicle) string { return v.GVWR },
}

// resolveField returns the vehicle's value for a given field path.
// Returns "" if the field doesn't exist or isn't set.
func resolveField(vehicle models.Vehicle, fieldPath string) string {
	norm := normalizeKey(fieldPath)

	// Custom field: "custom_fields.some_key" (also handles "customfields.some_key")
	const cfPrefix = "customfields."
	if strings.HasPrefix(norm, cfPrefix) {
		targetKey := normalizeKey(strings.TrimPrefix(norm, cfPrefix))
		for rawKey, rawVal := range vehicle.CustomFields {
			if normalizeKey(rawKey) == targetKey {
				return fmt.Sprintf("%v", rawVal)
			}
		}
		return "" // not found
	}

	// Standard field lookup
	if fn, ok := standardFieldMap[norm]; ok {
		return fn(vehicle)
	}

	// Fallback: search custom_fields without requiring the "custom_fields." prefix.
	// This lets callout authors write {field: "Lugs"} instead of
	// {field: "custom_fields.Lugs"} — the prefix is optional.
	for rawKey, rawVal := range vehicle.CustomFields {
		if normalizeKey(rawKey) == norm {
			return fmt.Sprintf("%v", rawVal)
		}
	}
	return ""
}

/* ── Callout evaluation ───────────────────────────────────────────── */

type calloutStatus int

const (
	calloutMatch    calloutStatus = 0 // field found and value matches
	calloutMismatch calloutStatus = 1 // field found but value doesn't match → hard no
	calloutMissing  calloutStatus = 2 // field not present in vehicle → fits with note
)

func evaluateCallout(vehicle models.Vehicle, co models.FitmentCallout) calloutStatus {
	val := strings.TrimSpace(resolveField(vehicle, co.Field))
	if val == "" || val == "0" {
		return calloutMissing
	}
	if strings.EqualFold(val, strings.TrimSpace(co.Value)) {
		return calloutMatch
	}
	return calloutMismatch
}

/* ── Required condition checks ───────────────────────────────────── */

func ciEqual(a, b string) bool {
	return strings.EqualFold(strings.TrimSpace(a), strings.TrimSpace(b))
}

// normModelStr strips all non-alphanumeric characters so that "F-350" and
// "F350" produce the same token, then lowercases.
// "F-350 Super Duty" → "f350 super duty"
// "Super Duty F-350 DRW" → "super duty f350 drw"
func normModelStr(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == ' ':
			b.WriteRune(' ')
		// hyphens, slashes, dots → nothing (join the surrounding chars)
		}
	}
	// collapse multiple spaces
	return strings.Join(strings.Fields(b.String()), " ")
}

// containsWord checks that needle appears as a whole space-delimited word
// in haystack, preventing "f35" from matching "f350".
func containsWord(haystack, needle string) bool {
	haystack = " " + haystack + " "
	return strings.Contains(haystack, " "+needle+" ")
}

// matchesModelTokens returns true when every space-delimited token of
// ruleVal appears as a whole word in vehicleVal (after normModelStr).
// "F-350 Super Duty" matches "Super Duty F-350 DRW" because the tokens
// ["f350","super","duty"] all appear word-for-word in the vehicle string.
func matchesModelTokens(vehicleVal, ruleVal string) bool {
	if ruleVal == "" {
		return true
	}
	vNorm := normModelStr(vehicleVal)
	for _, tok := range strings.Fields(normModelStr(ruleVal)) {
		if tok == "" {
			continue
		}
		if !containsWord(vNorm, tok) {
			return false
		}
	}
	return true
}

// matchesTrimList handles a comma-separated list of acceptable trim values.
// "King Ranch, Lariat, XL, XLT" matches a vehicle whose trim contains "XLT".
// Matching is token-based (same as matchesModelTokens) per list entry.
func matchesTrimList(vehicleTrim, ruleTrim string) bool {
	if ruleTrim == "" {
		return true
	}
	vNorm := normModelStr(vehicleTrim)
	for _, opt := range strings.Split(ruleTrim, ",") {
		opt = strings.TrimSpace(opt)
		if opt == "" {
			continue
		}
		allMatch := true
		for _, tok := range strings.Fields(normModelStr(opt)) {
			if !containsWord(vNorm, tok) {
				allMatch = false
				break
			}
		}
		if allMatch {
			return true
		}
	}
	return false
}

// normDriveType maps common drive-type strings to a canonical short form.
// Handles both human-entered values ("4WD") and decoded strings from
// auto.dev/NHTSA ("FOUR WHEEL DRIVE", "FOUR-WHEEL DRIVE", "4x4", etc.).
func normDriveType(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	switch {
	case strings.Contains(s, "4WD") || strings.Contains(s, "4X4") ||
		strings.Contains(s, "FOUR") && strings.Contains(s, "WHEEL"):
		return "4WD"
	case strings.Contains(s, "AWD") ||
		strings.Contains(s, "ALL") && strings.Contains(s, "WHEEL"):
		return "AWD"
	case strings.Contains(s, "FWD") ||
		strings.Contains(s, "FRONT") && strings.Contains(s, "WHEEL"):
		return "FWD"
	case strings.Contains(s, "RWD") ||
		strings.Contains(s, "REAR") && strings.Contains(s, "WHEEL"):
		return "RWD"
	default:
		return s
	}
}

/* ── Numeric displacement comparison ─────────────────────────────────
   Parses both strings as float64 so "3.5" == "3.50" == "3.500".
   Falls back to case-insensitive string equality if parsing fails.
   An empty rule displacement means "any" — always true.
──────────────────────────────────────────────────────────────────── */
func displMatches(vehicleDispl, ruleDispl string) bool {
	if ruleDispl == "" {
		return true // any displacement
	}
	if vehicleDispl == "" {
		return false // rule requires displacement, vehicle has none
	}
	rv, errR := strconv.ParseFloat(strings.TrimSpace(ruleDispl), 64)
	vv, errV := strconv.ParseFloat(strings.TrimSpace(vehicleDispl), 64)
	if errR != nil || errV != nil {
		return ciEqual(vehicleDispl, ruleDispl)
	}
	// Round to one decimal to avoid float precision drift (3.5000000001 == 3.5)
	return math.Round(rv*10) == math.Round(vv*10)
}

/* ── Main evaluation function ────────────────────────────────────── */

// EvaluateRule evaluates a single PartFitmentRule against a Vehicle.
//
// Algorithm:
//  1. All non-empty required fields are checked; any failure → FitNone.
//  2. Callouts are checked:
//     - field value matches → ok
//     - field exists but wrong value → FitNone (explicit mismatch)
//     - field missing from vehicle → FitWithNote (can't verify)
//  3. If all required pass and no callout mismatch:
//     - any unverified callout → FitWithNote with notes
//     - otherwise → FitExact
func EvaluateRule(vehicle models.Vehicle, rule models.PartFitmentRule) EvalResult {
	none := EvalResult{FitNone, nil, ""}

	// ── Required: year range ──────────────────────────────────────
	if rule.YearMin != nil && vehicle.Year < *rule.YearMin {
		return none
	}
	if rule.YearMax != nil && vehicle.Year > *rule.YearMax {
		return none
	}

	// ── Required: make (exact, case-insensitive) ──────────────────
	if rule.Make != "" && !ciEqual(vehicle.Make, rule.Make) {
		return none
	}

	// ── Required: model — token-based, order-independent ────────
	// "F-350 Super Duty" matches "Super Duty F-350 DRW" because
	// all tokens ["f350","super","duty"] appear as whole words.
	if !matchesModelTokens(vehicle.Model, rule.VehicleModel) {
		return none
	}

	// ── Required: trim — comma-separated list of valid values ────
	// "King Ranch, Lariat, XL, XLT" matches a vehicle trim containing "XLT".
	if !matchesTrimList(vehicle.Trim, rule.Trim) {
		return none
	}

	// ── Required: cylinders (exact, case-insensitive) ────────────
	if rule.Cylinders != "" && !ciEqual(vehicle.Cylinders, rule.Cylinders) {
		return none
	}

	// ── Required: displacement — numeric so "3.5" == "3.50" ──────
	if !displMatches(vehicle.DisplacementL, rule.DisplacementL) {
		return none
	}

	// ── Required: fuel type (exact, case-insensitive) ────────────
	if rule.FuelType != "" && !ciEqual(vehicle.FuelType, rule.FuelType) {
		return none
	}

	// ── Required: drive type — normalised so "FOUR WHEEL DRIVE"
	// and "4WD" are treated as the same value. ────────────────────
	if rule.DriveType != "" && normDriveType(vehicle.DriveType) != normDriveType(rule.DriveType) {
		return none
	}

	// ── Required: body type — token-based ────────────────────────
	if !matchesModelTokens(vehicle.BodyType, rule.BodyType) {
		return none
	}

	// ── Required: transmission type (exact, case-insensitive) ────
	if rule.TransmissionType != "" && !ciEqual(vehicle.TransmissionType, rule.TransmissionType) {
		return none
	}

	// ── Callouts ─────────────────────────────────────────────────
	var callouts []models.FitmentCallout
	if len(rule.Callouts) > 0 {
		_ = json.Unmarshal(rule.Callouts, &callouts)
	}

	var unverifiedNotes []string
	for _, co := range callouts {
		switch evaluateCallout(vehicle, co) {
		case calloutMismatch:
			// Field exists in vehicle record but value doesn't match → hard no
			return none
		case calloutMissing:
			// Field not in vehicle record → can't verify → fits with note
			note := strings.TrimSpace(co.Note)
			if note == "" {
				note = fmt.Sprintf("Verify: %s = %s", co.Field, co.Value)
			}
			unverifiedNotes = append(unverifiedNotes, note)
		// calloutMatch: all good, continue
		}
	}

	if len(unverifiedNotes) > 0 {
		return EvalResult{FitWithNote, unverifiedNotes, rule.Note}
	}
	return EvalResult{FitExact, nil, rule.Note}
}

/* ── Part ↔ vehicle matching ─────────────────────────────────────── */

// BestFitForPart evaluates all of a part's fitment rules against a vehicle
// and returns the best result (FitExact > FitWithNote > FitNone).
func BestFitForPart(vehicle models.Vehicle, rules []models.PartFitmentRule) EvalResult {
	best := EvalResult{FitNone, nil, ""}
	for _, rule := range rules {
		r := EvaluateRule(vehicle, rule)
		if r.Result > best.Result {
			best = r
		}
		if best.Result == FitExact {
			break // can't do better
		}
	}
	return best
}

// FitResultString converts a FitResult to its API string representation.
func FitResultString(r FitResult) string {
	switch r {
	case FitExact:
		return "exact"
	case FitWithNote:
		return "note"
	default:
		return "none"
	}
}
