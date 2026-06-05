package auth

import (
	"strings"
	"time"

	"main/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const CurrentUserKey = "currentUser"

func RequireAuth(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(401, gin.H{"error": "missing or malformed token"})
			return
		}

		claims, err := ParseToken(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"error": err.Error()})
			return
		}

		var user models.User
		if err := db.First(&user, claims.UserID).Error; err != nil {
			c.AbortWithStatusJSON(401, gin.H{"error": "user not found"})
			return
		}

		if !user.IsActive {
			c.AbortWithStatusJSON(403, gin.H{"error": "account disabled"})
			return
		}

		// Stamp last login
		db.Model(&user).Update("last_login_at", time.Now())

		c.Set(CurrentUserKey, &user)
		c.Next()
	}
}

// Helper — call this anywhere you have a *gin.Context
func CurrentUser(c *gin.Context) *models.User {
	user, _ := c.MustGet(CurrentUserKey).(*models.User)
	return user
}

func RequireAdmin(c *gin.Context) {
	user, exists := c.Get(CurrentUserKey)
	if !exists {
		c.AbortWithStatusJSON(401, gin.H{"error": "unauthorized"})
		return
	}
	if user.(*models.User).Role != "admin" {
		c.AbortWithStatusJSON(403, gin.H{"error": "admin access required"})
		return
	}
	c.Next()
}

// RequireDNR allows admin and dnr roles only.
func RequireDNR(c *gin.Context) {
	user, exists := c.Get(CurrentUserKey)
	if !exists {
		c.AbortWithStatusJSON(401, gin.H{"error": "unauthorized"})
		return
	}
	role := user.(*models.User).Role
	if role != "admin" && role != "dnr" {
		c.AbortWithStatusJSON(403, gin.H{"error": "DNR team access required"})
		return
	}
	c.Next()
}
