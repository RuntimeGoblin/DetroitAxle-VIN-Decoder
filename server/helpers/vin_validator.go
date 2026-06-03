package helpers

import (
	"strings"
)

func VinValidator(vin string) bool {
	vin = strings.TrimSpace(strings.ToUpper(vin))

	// Must be exactly 17 characters or 10 ( build key )
	if len(vin) == 10 {
		return true
	}
	if len(vin) != 17 {
		return false
	}

	// Transliteration map (letters → numbers)
	transliteration := map[rune]int{
		'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
		'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
		'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
		'0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
		'5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
	}

	// Position weights
	weights := []int{8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2}

	sum := 0
	for i, char := range vin {
		val, ok := transliteration[char]
		if !ok {
			return false // Invalid character (I, O, Q are not allowed)
		}
		sum += val * weights[i]
	}

	remainder := sum % 11

	// Check digit is position 9 (index 8)
	checkDigit := vin[8]
	if remainder == 10 {
		return checkDigit == 'X'
	}
	return checkDigit == byte('0'+remainder)
}
