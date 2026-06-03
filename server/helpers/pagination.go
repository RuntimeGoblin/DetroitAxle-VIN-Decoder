package helpers

import "gorm.io/gorm"

type PaginationQuery struct {
	Page     int `form:"page,default=1"`
	PageSize int `form:"page_size,default=20"`
}

type PaginatedData struct {
	Items      any   `json:"items"`
	TotalCount int64 `json:"total_count"`
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	TotalPages int   `json:"total_pages"`
}

func Paginate(q PaginationQuery) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		offset := (q.Page - 1) * q.PageSize
		return db.Offset(offset).Limit(q.PageSize)
	}
}
