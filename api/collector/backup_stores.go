package collector

import (
	"encoding/json"
	"io"
	"math"
	"os"
	"time"
)

// Explicit fields keep private paths, error output and credentials out of telemetry.
type backupMeasurement struct {
	Status            string `json:"status"`
	CheckedAt         string `json:"checked_at"`
	Bytes             *int64 `json:"bytes"`
	LimitBytes        *int64 `json:"limit_bytes"`
	BackupCount       *int64 `json:"backup_count"`
	LastSuccessAt     string `json:"last_success_at"`
	LatestBackupBytes *int64 `json:"latest_backup_bytes"`
}

func readBackupMeasurement(path string) (backupMeasurement, bool) {
	var value backupMeasurement
	f, err := os.Open(path)
	if err != nil {
		return value, false
	}
	defer f.Close()
	if info, err := f.Stat(); err != nil || !info.Mode().IsRegular() {
		return value, false
	}
	body, err := io.ReadAll(io.LimitReader(f, 16385))
	if err != nil || len(body) > 16384 || json.Unmarshal(body, &value) != nil {
		return value, false
	}
	return value, true
}

func collectBackupStores(config []BackupStore, now time.Time) []row {
	result := []row{}
	for _, item := range config {
		entry := row{"name": item.Name, "status": "unknown", "checked_at": nil, "max_age_seconds": item.MaxAge}
		value, ok := readBackupMeasurement(item.StatusFile)
		at, err := time.Parse(time.RFC3339Nano, value.CheckedAt)
		if ok && err == nil {
			entry["checked_at"] = iso(at)
		}
		if !ok || err != nil || at.After(now.Add(time.Minute)) || now.Sub(at) > time.Duration(item.MaxAge)*time.Second {
			entry["error"] = "Backup storage measurement is unavailable or stale"
		} else if (value.Status != "healthy" && value.Status != "warning" && value.Status != "failure") || value.Bytes == nil || value.LimitBytes == nil || *value.Bytes < 0 || *value.LimitBytes <= 0 {
			entry["error"] = "Backup storage could not be checked"
		} else {
			used, limit := *value.Bytes, *value.LimitBytes
			percent := float64(used) / float64(limit) * 100
			entry["bytes"], entry["limit_bytes"], entry["available_bytes"] = used, limit, max(int64(0), limit-used)
			entry["used_percent"] = math.Round(percent*100) / 100
			entry["status"] = "healthy"
			if percent >= 95 {
				entry["status"] = "failure"
			} else if percent >= 80 {
				entry["status"] = "warning"
			}
			if value.BackupCount != nil && *value.BackupCount >= 0 {
				entry["backup_count"] = *value.BackupCount
			}
			if value.LatestBackupBytes != nil && *value.LatestBackupBytes >= 0 {
				entry["latest_backup_bytes"] = *value.LatestBackupBytes
			}
			if last, err := time.Parse(time.RFC3339Nano, value.LastSuccessAt); err == nil && !last.After(now.Add(time.Minute)) {
				entry["last_success_at"] = iso(last)
			}
		}
		result = append(result, entry)
	}
	return result
}
