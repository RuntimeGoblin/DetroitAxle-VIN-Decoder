package handlers

import (
	"encoding/json"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"main/auth"
	dto "main/DTO"
	"main/helpers"
	"main/models"
)

type PartsHandler struct {
	DB *gorm.DB
}

/* ─── helpers ────────────────────────────────────────────────────── */

func canEditParts(user *models.User) bool {
	return user.Role == "admin" || user.Role == "listing" || user.Role == "dnr"
}

/* ═══════════════════════════════════════════════════════════════════
   Part CRUD
═══════════════════════════════════════════════════════════════════ */

// GET /parts?q=&category=&brand=&page=1&page_size=25
func (h *PartsHandler) ListParts(c *gin.Context) {
	search   := strings.TrimSpace(c.Query("q"))
	category := strings.TrimSpace(c.Query("category"))

	page, _     := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "25"))
	if page < 1     { page = 1 }
	if pageSize < 1 || pageSize > 100 { pageSize = 25 }

	db := h.DB.Model(&models.CatalogPart{})

	// Only search indexed, short columns — searching description on 100K rows
	// with ILIKE causes full table scans. Agents search by part number or name.
	if search != "" {
		like := "%" + search + "%"
		db = db.Where("part_number ILIKE ? OR name ILIKE ?", like, like)
	}
	if category != "" {
		db = db.Where("LOWER(category) = LOWER(?)", category)
	}

	var total int64
	db.Count(&total)

	var parts []models.CatalogPart
	if err := db.Preload("FitmentRules").
		Order("category ASC, part_number ASC").
		Offset((page-1)*pageSize).Limit(pageSize).
		Find(&parts).Error; err != nil {
		helpers.Fail(c, http.StatusInternalServerError, "failed to fetch parts")
		return
	}

	summaries := make([]dto.PartSummary, len(parts))
	for i, p := range parts {
		summaries[i] = dto.PartSummaryFromModel(p)
	}

	helpers.OK(c, helpers.PaginatedData{
		Items:      summaries,
		Page:       page,
		PageSize:   pageSize,
		TotalCount: total,
		TotalPages: int(math.Ceil(float64(total) / float64(pageSize))),
	})
}

// POST /parts/:id/clone — duplicate a part with all its fitment rules
func (h *PartsHandler) ClonePart(c *gin.Context) {
	user := auth.CurrentUser(c)
	if !canEditParts(user) {
		helpers.Fail(c, http.StatusForbidden, "insufficient permissions")
		return
	}
	var req struct {
		PartNumber string `json:"part_number" binding:"required"`
		Name       string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	var source models.CatalogPart
	if err := h.DB.Preload("FitmentRules").First(&source, c.Param("id")).Error; err != nil {
		helpers.Fail(c, http.StatusNotFound, "part not found")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = source.Name
	}

	clone := models.CatalogPart{
		PartNumber:   strings.TrimSpace(req.PartNumber),
		Name:         name,
		Category:     source.Category,
		Description:  source.Description,
		InternalNote: source.InternalNote,
	}
	if err := h.DB.Create(&clone).Error; err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			helpers.Fail(c, http.StatusConflict, "part number already exists")
			return
		}
		helpers.Fail(c, http.StatusInternalServerError, "failed to clone part")
		return
	}

	// Copy all fitment rules
	for _, r := range source.FitmentRules {
		newRule := models.PartFitmentRule{
			PartID:           clone.ID,
			YearMin:          r.YearMin,
			YearMax:          r.YearMax,
			Make:             r.Make,
			VehicleModel:     r.VehicleModel,
			Trim:             r.Trim,
			Cylinders:        r.Cylinders,
			DisplacementL:    r.DisplacementL,
			FuelType:         r.FuelType,
			DriveType:        r.DriveType,
			BodyType:         r.BodyType,
			TransmissionType: r.TransmissionType,
			Callouts:         r.Callouts,
			Note:             r.Note,
		}
		h.DB.Create(&newRule)
	}

	h.DB.Preload("FitmentRules").First(&clone, clone.ID)
	helpers.OK(c, dto.PartFromModel(clone))
}

// GET /parts/categories
func (h *PartsHandler) ListCategories(c *gin.Context) {
	var cats []string
	h.DB.Model(&models.CatalogPart{}).
		Distinct("category").
		Where("category != ''").
		Order("category ASC").
		Pluck("category", &cats)
	helpers.OK(c, cats)
}

// GET /parts/:id
func (h *PartsHandler) GetPart(c *gin.Context) {
	var part models.CatalogPart
	if err := h.DB.Preload("FitmentRules").First(&part, c.Param("id")).Error; err != nil {
		helpers.Fail(c, http.StatusNotFound, "part not found")
		return
	}
	helpers.OK(c, dto.PartFromModel(part))
}

// POST /parts
func (h *PartsHandler) CreatePart(c *gin.Context) {
	user := auth.CurrentUser(c)
	if !canEditParts(user) {
		helpers.Fail(c, http.StatusForbidden, "insufficient permissions")
		return
	}
	var req struct {
		PartNumber   string `json:"part_number" binding:"required"`
		Name         string `json:"name"         binding:"required"`
		Category     string `json:"category"`
		Description  string `json:"description"`
		InternalNote string `json:"internal_note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	part := models.CatalogPart{
		PartNumber:   strings.TrimSpace(req.PartNumber),
		Name:         strings.TrimSpace(req.Name),
		Category:     strings.TrimSpace(req.Category),
		Description:  strings.TrimSpace(req.Description),
		InternalNote: strings.TrimSpace(req.InternalNote),
	}
	if err := h.DB.Create(&part).Error; err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			helpers.Fail(c, http.StatusConflict, "part number already exists")
			return
		}
		helpers.Fail(c, http.StatusInternalServerError, "failed to create part")
		return
	}
	helpers.OK(c, dto.PartFromModel(part))
}

// PATCH /parts/:id
func (h *PartsHandler) UpdatePart(c *gin.Context) {
	user := auth.CurrentUser(c)
	if !canEditParts(user) {
		helpers.Fail(c, http.StatusForbidden, "insufficient permissions")
		return
	}
	var part models.CatalogPart
	if err := h.DB.First(&part, c.Param("id")).Error; err != nil {
		helpers.Fail(c, http.StatusNotFound, "part not found")
		return
	}
	var req struct {
		PartNumber   *string `json:"part_number"`
		Name         *string `json:"name"`
		Category     *string `json:"category"`
		Description  *string `json:"description"`
		InternalNote *string `json:"internal_note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	updates := map[string]any{}
	if req.PartNumber   != nil { updates["part_number"]   = strings.TrimSpace(*req.PartNumber) }
	if req.Name         != nil { updates["name"]          = strings.TrimSpace(*req.Name) }
	if req.Category     != nil { updates["category"]      = strings.TrimSpace(*req.Category) }
	if req.Description  != nil { updates["description"]   = strings.TrimSpace(*req.Description) }
	if req.InternalNote != nil { updates["internal_note"] = strings.TrimSpace(*req.InternalNote) }

	if err := h.DB.Model(&part).Updates(updates).Error; err != nil {
		helpers.Fail(c, http.StatusInternalServerError, "failed to update part")
		return
	}
	h.DB.Preload("FitmentRules").First(&part, part.ID)
	helpers.OK(c, dto.PartFromModel(part))
}

// DELETE /parts/:id
func (h *PartsHandler) DeletePart(c *gin.Context) {
	user := auth.CurrentUser(c)
	if !canEditParts(user) {
		helpers.Fail(c, http.StatusForbidden, "insufficient permissions")
		return
	}
	var part models.CatalogPart
	if err := h.DB.First(&part, c.Param("id")).Error; err != nil {
		helpers.Fail(c, http.StatusNotFound, "part not found")
		return
	}
	// Soft-delete rules first (GORM soft-delete via gorm.Model.DeletedAt)
	h.DB.Where("part_id = ?", part.ID).Delete(&models.PartFitmentRule{})
	if err := h.DB.Delete(&part).Error; err != nil {
		helpers.Fail(c, http.StatusInternalServerError, "failed to delete part")
		return
	}
	helpers.OK(c, gin.H{"message": "part deleted"})
}

/* ═══════════════════════════════════════════════════════════════════
   Fitment rule CRUD
═══════════════════════════════════════════════════════════════════ */

// POST /parts/:id/rules
func (h *PartsHandler) AddRule(c *gin.Context) {
	user := auth.CurrentUser(c)
	if !canEditParts(user) {
		helpers.Fail(c, http.StatusForbidden, "insufficient permissions")
		return
	}
	var part models.CatalogPart
	if err := h.DB.First(&part, c.Param("id")).Error; err != nil {
		helpers.Fail(c, http.StatusNotFound, "part not found")
		return
	}
	rule, err := bindRule(c)
	if err != nil {
		helpers.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	rule.PartID = part.ID
	if err := h.DB.Create(&rule).Error; err != nil {
		helpers.Fail(c, http.StatusInternalServerError, "failed to create rule")
		return
	}
	helpers.OK(c, dto.RuleFromModel(rule))
}

// PATCH /parts/:id/rules/:rule_id
func (h *PartsHandler) UpdateRule(c *gin.Context) {
	user := auth.CurrentUser(c)
	if !canEditParts(user) {
		helpers.Fail(c, http.StatusForbidden, "insufficient permissions")
		return
	}
	var rule models.PartFitmentRule
	if err := h.DB.Where("id = ? AND part_id = ?", c.Param("rule_id"), c.Param("id")).
		First(&rule).Error; err != nil {
		helpers.Fail(c, http.StatusNotFound, "rule not found")
		return
	}
	updated, err := bindRule(c)
	if err != nil {
		helpers.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	updated.Model.ID = rule.Model.ID
	updated.PartID   = rule.PartID
	if err := h.DB.Save(&updated).Error; err != nil {
		helpers.Fail(c, http.StatusInternalServerError, "failed to update rule")
		return
	}
	helpers.OK(c, dto.RuleFromModel(updated))
}

// DELETE /parts/:id/rules/:rule_id
func (h *PartsHandler) DeleteRule(c *gin.Context) {
	user := auth.CurrentUser(c)
	if !canEditParts(user) {
		helpers.Fail(c, http.StatusForbidden, "insufficient permissions")
		return
	}
	var rule models.PartFitmentRule
	if err := h.DB.Where("id = ? AND part_id = ?", c.Param("rule_id"), c.Param("id")).
		First(&rule).Error; err != nil {
		helpers.Fail(c, http.StatusNotFound, "rule not found")
		return
	}
	h.DB.Delete(&rule)
	helpers.OK(c, gin.H{"message": "rule deleted"})
}

/* ─── bindRule ───────────────────────────────────────────────────── */
func bindRule(c *gin.Context) (models.PartFitmentRule, error) {
	var req struct {
		YearMin          *int                    `json:"year_min"`
		YearMax          *int                    `json:"year_max"`
		Make             string                  `json:"make"`
		Model            string                  `json:"model"`
		Trim             string                  `json:"trim"`
		Cylinders        string                  `json:"cylinders"`
		DisplacementL    string                  `json:"displacement_l"`
		FuelType         string                  `json:"fuel_type"`
		DriveType        string                  `json:"drive_type"`
		BodyType         string                  `json:"body_type"`
		TransmissionType string                  `json:"transmission_type"`
		Callouts         []models.FitmentCallout `json:"callouts"`
		Note             string                  `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		return models.PartFitmentRule{}, err
	}
	calloutsJSON, _ := json.Marshal(req.Callouts)
	return models.PartFitmentRule{
		YearMin:          req.YearMin,
		YearMax:          req.YearMax,
		Make:         strings.TrimSpace(req.Make),
		VehicleModel: strings.TrimSpace(req.Model),
		Trim:         strings.TrimSpace(req.Trim),
		Cylinders:        strings.TrimSpace(req.Cylinders),
		DisplacementL:    strings.TrimSpace(req.DisplacementL),
		FuelType:         strings.TrimSpace(req.FuelType),
		DriveType:        strings.TrimSpace(req.DriveType),
		BodyType:         strings.TrimSpace(req.BodyType),
		TransmissionType: strings.TrimSpace(req.TransmissionType),
		Callouts:         calloutsJSON,
		Note:             strings.TrimSpace(req.Note),
	}, nil
}

/* ═══════════════════════════════════════════════════════════════════
   Fitment queries — designed for 100K+ parts
═══════════════════════════════════════════════════════════════════ */

// ruleCandidate is the scan target for the SQL pre-filter join query.
// We pull rule fields + enough part info to build the response,
// without loading any extra columns.
type ruleCandidate struct {
	// From part_fitment_rules
	RuleID           uint           `gorm:"column:rule_id"`
	YearMin          *int           `gorm:"column:year_min"`
	YearMax          *int           `gorm:"column:year_max"`
	RuleMake         string         `gorm:"column:rule_make"`
	RuleModel        string         `gorm:"column:rule_model"`
	RuleTrim         string         `gorm:"column:rule_trim"`
	Cylinders        string         `gorm:"column:cylinders"`
	DisplacementL    string         `gorm:"column:displacement_l"`
	FuelType         string         `gorm:"column:fuel_type"`
	DriveType        string         `gorm:"column:drive_type"`
	BodyType         string         `gorm:"column:body_type"`
	TransmissionType string         `gorm:"column:transmission_type"`
	Callouts         datatypes.JSON `gorm:"column:callouts"`
	Note             string         `gorm:"column:note"`
	// From catalog_parts
	CatalogID  uint   `gorm:"column:catalog_id"`
	PartNumber string `gorm:"column:part_number"`
	PartName   string `gorm:"column:part_name"`
	Category   string `gorm:"column:category"`
}

func (rc ruleCandidate) toRule() models.PartFitmentRule {
	return models.PartFitmentRule{
		YearMin:          rc.YearMin,
		YearMax:          rc.YearMax,
		Make:         rc.RuleMake,
		VehicleModel: rc.RuleModel,
		Trim:         rc.RuleTrim,
		Cylinders:        rc.Cylinders,
		DisplacementL:    rc.DisplacementL,
		FuelType:         rc.FuelType,
		DriveType:        rc.DriveType,
		BodyType:         rc.BodyType,
		TransmissionType: rc.TransmissionType,
		Callouts:         rc.Callouts,
		Note:             rc.Note,
	}
}

// GET /parts/by-vehicle/:vin
//
// Returns compatible parts grouped by category.
//
// Scale design: instead of loading all 100K parts + rules into memory, a
// single SQL query JOINs part_fitment_rules with catalog_parts and pre-filters
// by the vehicle's indexed fields (year, make, cylinders, displacement, etc.).
// PostgreSQL reduces the result set to the relevant subset; Go then evaluates
// callouts on that small set.  Model/trim/body_type are substring checks done
// in Go after the SQL pass, not in SQL, to keep the index path clean.
func (h *PartsHandler) GetCompatibleParts(c *gin.Context) {
	vin := strings.TrimSpace(strings.ToUpper(c.Param("vin")))

	var buildKey string
	switch len(vin) {
	case 17:
		buildKey = helpers.ExtractBuildKey(vin)
	case 10:
		buildKey = vin
	default:
		helpers.Fail(c, http.StatusBadRequest, "VIN must be 10 or 17 characters")
		return
	}

	var vehicle models.Vehicle
	if err := h.DB.Where("build_key = ?", buildKey).First(&vehicle).Error; err != nil {
		helpers.Fail(c, http.StatusNotFound, "vehicle not found")
		return
	}

	// ── SQL pre-filter ────────────────────────────────────────────
	// Only the highly selective indexed columns are filtered here.
	// Model, trim, body_type, and callouts are handled in Go after.
	var candidates []ruleCandidate
	err := h.DB.Raw(`
		SELECT
			pfr.id          AS rule_id,
			pfr.year_min,
			pfr.year_max,
			pfr.make        AS rule_make,
			pfr.model       AS rule_model,
			pfr.trim        AS rule_trim,
			pfr.cylinders,
			pfr.displacement_l,
			pfr.fuel_type,
			pfr.drive_type,
			pfr.body_type,
			pfr.transmission_type,
			pfr.callouts,
			pfr.note,
			cp.id           AS catalog_id,
			cp.part_number,
			cp.name         AS part_name,
			cp.category
		FROM part_fitment_rules pfr
		JOIN catalog_parts cp ON cp.id = pfr.part_id
		WHERE pfr.deleted_at IS NULL
		  AND cp.deleted_at  IS NULL
		  AND (pfr.year_min  IS NULL OR pfr.year_min <= ?)
		  AND (pfr.year_max  IS NULL OR pfr.year_max >= ?)
		  AND (pfr.make        = '' OR LOWER(pfr.make)        = LOWER(?))
		  AND (pfr.cylinders   = '' OR LOWER(pfr.cylinders)   = LOWER(?))
		  AND (pfr.fuel_type   = '' OR LOWER(pfr.fuel_type)   = LOWER(?))
		  AND (pfr.transmission_type = '' OR LOWER(pfr.transmission_type) = LOWER(?))
	`,
		// Intentionally excluded from SQL — handled in Go with correct semantics:
		//   displacement_l: numeric float comparison ("3.5" == "3.50")
		//   drive_type:     normalization ("FOUR WHEEL DRIVE" == "4WD")
		//   model/trim:     token-based, order-independent matching
		//   body_type:      token-based matching
		// year + make alone reduces 100K+ rules to a manageable Go-evaluation set.
		vehicle.Year, vehicle.Year,
		vehicle.Make,
		vehicle.Cylinders,
		vehicle.FuelType,
		vehicle.TransmissionType,
	).Scan(&candidates).Error

	if err != nil {
		helpers.Fail(c, http.StatusInternalServerError, "failed to query compatible parts")
		return
	}

	// ── Group candidates by part, keep best rule per part ─────────
	type partEntry struct {
		summary dto.PartSummary
		rules   []models.PartFitmentRule
	}
	partMap := map[uint]*partEntry{}
	for _, rc := range candidates {
		if _, ok := partMap[rc.CatalogID]; !ok {
			partMap[rc.CatalogID] = &partEntry{
				summary: dto.PartSummary{
					ID:         rc.CatalogID,
					PartNumber: rc.PartNumber,
					Name:       rc.PartName,
					Category:   rc.Category,
				},
			}
		}
		partMap[rc.CatalogID].rules = append(partMap[rc.CatalogID].rules, rc.toRule())
	}

	// ── Go-level evaluation (callouts + model/trim/body_type) ─────
	categoryMap := map[string][]dto.PartFitResult{}
	for _, entry := range partMap {
		eval := helpers.BestFitForPart(vehicle, entry.rules)
		if eval.Result == helpers.FitNone {
			continue
		}
		notes := eval.Notes
		if notes == nil {
			notes = []string{}
		}
		categoryMap[entry.summary.Category] = append(
			categoryMap[entry.summary.Category],
			dto.PartFitResult{
				PartSummary: entry.summary,
				FitResult:   helpers.FitResultString(eval.Result),
				FitNotes:    notes,
				RuleNote:    eval.RuleNote,
			},
		)
	}

	// ── Build sorted response ─────────────────────────────────────
	groups := make([]dto.CompatiblePartsGroup, 0, len(categoryMap))
	for cat, parts := range categoryMap {
		// Within each category: exact fits first, then alphabetical by part number
		sort.Slice(parts, func(i, j int) bool {
			if parts[i].FitResult != parts[j].FitResult {
				return parts[i].FitResult == "exact"
			}
			return parts[i].PartNumber < parts[j].PartNumber
		})
		groups = append(groups, dto.CompatiblePartsGroup{Category: cat, Parts: parts})
	}
	sort.Slice(groups, func(i, j int) bool { return groups[i].Category < groups[j].Category })

	helpers.OK(c, gin.H{
		"vehicle_id":  vehicle.ID,
		"build_key":   vehicle.BuildKey,
		"total_parts": countParts(groups),
		"groups":      groups,
	})
}

func countParts(groups []dto.CompatiblePartsGroup) int {
	n := 0
	for _, g := range groups {
		n += len(g.Parts)
	}
	return n
}

// GET /parts/:id/vehicles?page=1&page_size=20
//
// Scale note: vehicle count is small (≤ ~10K), so loading candidates via SQL
// and evaluating callouts in Go is fine here.
func (h *PartsHandler) GetCompatibleVehicles(c *gin.Context) {
	page, _     := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 { page = 1 }
	if pageSize < 1 || pageSize > 100 { pageSize = 20 }

	var part models.CatalogPart
	if err := h.DB.Preload("FitmentRules").First(&part, c.Param("id")).Error; err != nil {
		helpers.Fail(c, http.StatusNotFound, "part not found")
		return
	}

	// SQL pre-filter: only apply clean, exact-match columns that reliably narrow
	// the candidate set without risking false negatives.
	//
	// Excluded from SQL (handled by Go's EvaluateRule):
	//   model        — token-based, word-order-independent matching
	//   trim         — comma-separated list of valid values
	//   drive_type   — normalisation required ("FOUR WHEEL DRIVE" == "4WD")
	//   body_type    — token-based matching
	candidateIDs := map[uint]struct{}{}
	for _, rule := range part.FitmentRules {
		db := h.DB.Model(&models.Vehicle{})
		if rule.YearMin != nil        { db = db.Where("year >= ?", *rule.YearMin) }
		if rule.YearMax != nil        { db = db.Where("year <= ?", *rule.YearMax) }
		if rule.Make != ""            { db = db.Where("LOWER(make) = LOWER(?)", rule.Make) }
		if rule.Cylinders != ""       { db = db.Where("LOWER(cylinders) = LOWER(?)", rule.Cylinders) }
		if rule.DisplacementL != ""   { db = db.Where("LOWER(displacement_l) = LOWER(?)", rule.DisplacementL) }
		if rule.FuelType != ""        { db = db.Where("LOWER(fuel_type) = LOWER(?)", rule.FuelType) }
		if rule.TransmissionType != "" { db = db.Where("LOWER(transmission_type) = LOWER(?)", rule.TransmissionType) }

		var ids []uint
		db.Pluck("id", &ids)
		for _, id := range ids { candidateIDs[id] = struct{}{} }
	}

	if len(candidateIDs) == 0 {
		helpers.OK(c, gin.H{
			"items": []dto.VehicleFitResult{}, "total_count": 0,
			"exact_count": 0, "note_count": 0,
		})
		return
	}

	ids := make([]uint, 0, len(candidateIDs))
	for id := range candidateIDs { ids = append(ids, id) }

	var vehicles []models.Vehicle
	h.DB.Where("id IN ?", ids).Find(&vehicles)

	var results []dto.VehicleFitResult
	exactCount, noteCount := 0, 0
	for _, v := range vehicles {
		eval := helpers.BestFitForPart(v, part.FitmentRules)
		if eval.Result == helpers.FitNone { continue }
		notes := eval.Notes
		if notes == nil { notes = []string{} }
		fr := helpers.FitResultString(eval.Result)
		if fr == "exact" { exactCount++ } else { noteCount++ }
		results = append(results, dto.VehicleFitResult{
			VehicleResponse: dto.VehicleFromModel(v),
			FitResult:       fr,
			FitNotes:        notes,
			RuleNote:        eval.RuleNote,
		})
	}

	sort.Slice(results, func(i, j int) bool {
		if results[i].FitResult != results[j].FitResult {
			return results[i].FitResult == "exact"
		}
		return results[i].Year > results[j].Year
	})

	total := len(results)
	start := (page-1) * pageSize
	end   := start + pageSize
	if start > total { start = total }
	if end > total   { end = total }

	helpers.OK(c, gin.H{
		"items":       results[start:end],
		"total_count": total,
		"exact_count": exactCount,
		"note_count":  noteCount,
		"page":        page,
		"page_size":   pageSize,
		"total_pages": int(math.Ceil(float64(total) / float64(pageSize))),
	})
}
