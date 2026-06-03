package helpers

import "strings"

func ExtractBuildKey(vin string) string {
	vin = strings.TrimSpace(strings.ToUpper(vin))
	return vin[0:8] + vin[9:11]
}
