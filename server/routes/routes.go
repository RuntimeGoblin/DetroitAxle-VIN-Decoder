package routes

import (
	"main/auth"
	"main/handlers"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func Setup(r *gin.Engine, db *gorm.DB) {
	vehicleHandler := &handlers.VehicleHandler{DB: db}
	authHandler := &handlers.AuthHandler{DB: db}
	notesHandler := &handlers.NotesHandler{DB: db}
	categoriesHandler := &handlers.CategoryHandler{DB: db}
	adminHandler := &handlers.AdminHandler{DB: db}
	historyHandler := &handlers.HistoryHandler{DB: db}

	base := r.Group("/api")

	api := base.Group("/")
	api.Use(auth.RequireAuth(db))
	{
		api.GET("/vin/:vin", vehicleHandler.GetVehicle)
		api.PATCH("/update/:vin", vehicleHandler.UpdateVehicle)
		api.GET("/id/:id", vehicleHandler.GetVehicleById)
	}

	a := base.Group("/auth")
	{
		a.POST("/register", authHandler.Register)
		a.POST("/login", authHandler.Login)
		a.POST("/refresh", authHandler.Refresh)
		a.POST("/reset-password", auth.RequireAuth(db), authHandler.ResetPassword)
	}

	notes := base.Group("/notes")
	notes.Use(auth.RequireAuth(db))
	{
		notes.GET("/listing-error", notesHandler.GetListingErrorNotes)
		notes.PATCH("/:note_id/resolve", notesHandler.MarkAsResolved)
		notes.PATCH("/:note_id", notesHandler.UpdateNote)
		notes.DELETE("/:note_id", notesHandler.DeleteNote)
		notes.POST("/:vin", notesHandler.AddNote)
	}

	categories := base.Group("/category")
	categories.Use(auth.RequireAuth(db))
	{
		categories.POST("/", categoriesHandler.AddCategory)
		categories.DELETE("/:category_id", categoriesHandler.DeleteCategory)
		categories.PATCH("/:category_id", categoriesHandler.UpdateCategory)
		categories.GET("/", categoriesHandler.GetCategories)
	}

	admin := base.Group("/admin", auth.RequireAuth(db), auth.RequireAdmin)
	{
		admin.GET("/stats", adminHandler.AdminStatus)
		admin.GET("/users", adminHandler.ListUsers)
		admin.PATCH("/users/:id", adminHandler.UpdateUser)
		admin.DELETE("/users/:id", adminHandler.DeleteUser)
		admin.GET("/vehicles", vehicleHandler.ListVehicles)
		admin.GET("/notes/chart", adminHandler.GetNotesChart)
		admin.GET("/notes/recent", adminHandler.GetRecentNotes)
		admin.POST("/users", adminHandler.CreateUser)
	}

	history := base.Group("/history")
	history.Use(auth.RequireAuth(db))
	{
		history.GET("/", historyHandler.ListHistory)
		history.PATCH("/:id/verify", historyHandler.VerifyEntry)
	}

	// Serve frontend
	r.Static("/assets", "/home/developer/frontend/assets")
	r.StaticFile("/", "/home/developer/frontend/index.html")
	r.NoRoute(func(c *gin.Context) {
		c.File("/home/developer/frontend/index.html")
	})
}
