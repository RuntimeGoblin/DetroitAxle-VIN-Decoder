package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// CatalogPart is a part in the parts catalog.
// Intentionally separate from the agent-note PartCategory model.
// Uses gorm.Model for soft-delete — deleting 100K-scale catalog data
// should be reversible.
type CatalogPart struct {
	gorm.Model
	PartNumber   string `gorm:"column:part_number;uniqueIndex;not null;size:100"`
	Name         string `gorm:"column:name;not null;size:255"`
	Category     string `gorm:"column:category;size:100;index"`
	Description  string `gorm:"column:description;size:2000"`
	InternalNote string `gorm:"column:internal_note;size:1000"`

	FitmentRules []PartFitmentRule `gorm:"foreignKey:PartID"`
}

// PartFitmentRule holds the conditions under which a part fits a vehicle.
// A part can have multiple rules (e.g. one for 4WD, one for 2WD variants).
//
// Indexed columns are chosen based on selectivity:
//   - Make + Year filter alone typically eliminates 95% of all rules
//   - Subsequent Go-level evaluation handles callouts and substring checks
type PartFitmentRule struct {
	gorm.Model
	PartID uint `gorm:"column:part_id;not null;index"`

	// Required conditions — empty string / nil means "any value accepted".
	// Indexed fields are used by the SQL pre-filter in GetCompatibleParts.
	YearMin          *int   `gorm:"column:year_min;index"`
	YearMax          *int   `gorm:"column:year_max;index"`
	Make         string `gorm:"column:make;size:100;index"`
	VehicleModel string `gorm:"column:model;size:200"`       // Go-level contains check
	Trim         string `gorm:"column:trim;size:200"`         // Go-level contains check
	Cylinders        string `gorm:"column:cylinders;size:20;index"`
	DisplacementL    string `gorm:"column:displacement_l;size:20;index"`
	FuelType         string `gorm:"column:fuel_type;size:50;index"`
	DriveType        string `gorm:"column:drive_type;size:20;index"`
	BodyType         string `gorm:"column:body_type;size:100"`    // Go-level contains check
	TransmissionType string `gorm:"column:transmission_type;size:50;index"`

	// Callouts — JSONB array of FitmentCallout.
	// Missing field in vehicle → FitWithNote.
	// Wrong value in vehicle    → FitNone (hard no).
	Callouts datatypes.JSON `gorm:"column:callouts;type:jsonb;default:'[]'"`

	// Human-readable note for this specific rule (e.g. "Crew cab only")
	Note string `gorm:"column:note;size:500"`

	Part *CatalogPart `gorm:"foreignKey:PartID"`
}

// FitmentCallout is a conditional match criterion stored in PartFitmentRule.Callouts.
// Field supports standard vehicle columns ("trim", "drive_type", …) and custom fields
// via the "custom_fields." prefix ("custom_fields.engine_chassis").
//
// Field name comparison is always normalised — spaces, hyphens, underscores and case
// are all stripped before comparison, so "engine_chassis", "engine-chassis" and
// "Engine Chassis" are treated identically.
type FitmentCallout struct {
	Field string `json:"field"` // e.g. "custom_fields.engine_chassis"
	Value string `json:"value"` // expected value — compared case-insensitively
	Note  string `json:"note"`  // shown to agent when field is missing/unverified
}
