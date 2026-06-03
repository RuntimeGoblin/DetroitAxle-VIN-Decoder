package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Email          string     `gorm:"uniqueIndex;not null;size:255"`
	Username       string     `gorm:"uniqueIndex;not null;size:50"`
	HashedPassword string     `gorm:"not null"                   json:"-"`
	IsActive       bool       `gorm:"default:true;not null"`
	LastLoginAt    *time.Time `gorm:"column:last_login_at"`
	Role           string     `gorm:"not null;size:20;default:agent"` // agent, admin, listing
	IsTrusted      bool       `gorm:"not null;default:false"`
	FreeNotesCount int        `gorm:"column:free_notes_count;not null;default:0"`
	PartNotesCount int        `gorm:"column:part_notes_count;not null;default:0"`
	VinUsageCount  int        `gorm:"column:vin_usage_count;not null;default:0"`
	UpdatesCount   int        `gorm:"column:updates_count;not null;default:0"`
}
