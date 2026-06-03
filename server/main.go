package main

import (
	"main/config"
	"main/models"
	"main/routes"

	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	db, err := config.InitDB()
	if err != nil {
		log.Fatal("DB connection failed:", err)
	}

	// Migrate your Vin model automatically
	err = db.AutoMigrate(&models.Vehicle{}, &models.PartCategory{}, &models.User{}, &models.AgentNote{}, &models.FieldPermission{}, &models.VehicleFieldHistory{})
	if err != nil {
		log.Fatal("Migration failed:", err)
	}
	r := gin.Default()
	routes.Setup(r, db)
	r.Run(":8080")
}
