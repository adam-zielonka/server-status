package mods

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"status/config"
)

// The HTTP service only reads a prepared snapshot. It never executes commands
// or accepts collector paths, unit names or process IDs from HTTP requests.
func Telemetry() (json.RawMessage, error) {
	path := config.GetTelemetryFile()
	if path == "" {
		return json.RawMessage(`{"enabled":false}`), nil
	}
	return readTelemetry(path)
}

func readTelemetry(path string) (json.RawMessage, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("monitoring snapshot is unavailable")
	}
	defer f.Close()
	const maxSize = 8 * 1024 * 1024
	body, err := io.ReadAll(io.LimitReader(f, maxSize+1))
	if err != nil || len(body) > maxSize {
		return nil, fmt.Errorf("monitoring snapshot could not be read")
	}
	var envelope struct {
		SchemaVersion int    `json:"schema_version"`
		CollectedAt   string `json:"collected_at"`
		Enabled       bool   `json:"enabled"`
	}
	if json.Unmarshal(body, &envelope) != nil || envelope.SchemaVersion != 1 || !envelope.Enabled || envelope.CollectedAt == "" {
		return nil, fmt.Errorf("monitoring snapshot has an unsupported format")
	}
	return json.RawMessage(body), nil
}
