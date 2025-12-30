package utils

type Response struct {
	Data   any      `json:"data,omitempty"`
	Errors []string `json:"errors,omitempty"`
}
