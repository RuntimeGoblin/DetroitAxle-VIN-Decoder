package main

import (
	"log"
	"main/config"
	"main/models"
)

func CleanBuildKeysSQL() error {
	db, err := config.InitDB()
	if err != nil {
		log.Fatalf("DB: %v", err)
	}

	db.AutoMigrate(&models.Vehicle{}) // Ensure the Vehicle model is migrated
	query := `
		UPDATE vehicles 
		SET build_key = SUBSTR(build_key, 1, 8) || SUBSTR(build_key, 10, 2)
		WHERE LENGTH(build_key) >= 11;
	`
	return db.Exec(query).Error
}

func main() {
	if err := CleanBuildKeysSQL(); err != nil {
		log.Fatalf("clean build keys: %v", err)
	}
	log.Println("✓ Build keys cleaned successfully.")
}
