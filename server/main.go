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
	// Load .env if present (dev/Air). In production containers env vars
	// are injected directly — missing .env file is not an error there.
	_ = godotenv.Load()
	db, err := config.InitDB()
	if err != nil {
		log.Fatal("DB connection failed:", err)
	}

	// Migrate your Vin model automatically
	err = db.AutoMigrate(
		&models.Vehicle{},
		&models.PartCategory{},
		&models.User{},
		&models.AgentNote{},
		&models.FieldPermission{},
		&models.VehicleFieldHistory{},
		&models.CatalogPart{},
		&models.PartFitmentRule{},
	)
	if err != nil {
		log.Fatal("Migration failed:", err)
	}
	r := gin.Default()
	routes.Setup(r, db)
	r.Run(":8080")
}
