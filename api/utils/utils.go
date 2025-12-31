package utils

import "encoding/json"

func ToJSON(s any) string {
	if b, err := json.Marshal(s); err != nil {
		return "{\"error\":\"failed to marshal json\"}"
	} else {
		return string(b)
	}
}
