package collector

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"golang.org/x/mod/semver"
)

var toolVersion = regexp.MustCompile(`(?:^|[\s/])(?:v|go)?([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)(?:[\s+]|\.(?:\s|$)|$)`)
var aptUpdateLine = regexp.MustCompile(`^([^/\s]+)/\S+\s+(\S+)\s+\S+\s+\[upgradable from: ([^\]]+)\]$`)

func normalizedVersion(value string) string {
	value = strings.TrimPrefix(strings.TrimPrefix(strings.TrimSpace(value), "go"), "v")
	if semver.IsValid("v" + value) {
		return value
	}
	return ""
}
func versionStatus(installed, available string) string {
	if normalizedVersion(installed) == "" || normalizedVersion(available) == "" {
		return "unknown"
	}
	if semver.Compare("v"+installed, "v"+available) < 0 {
		return "update_available"
	}
	return "current"
}

// Fixed public registries only; never forward credentials, proxies or redirects.
func releaseJSON(ctx context.Context, endpoint string, target any) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return errQuery
	}
	req.Header.Set("User-Agent", "server-status-version-check")
	client := &http.Client{Transport: &http.Transport{Proxy: nil}, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	defer client.CloseIdleConnections()
	response, err := client.Do(req)
	if err != nil {
		return errQuery
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return errQuery
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 4*1024*1024+1))
	if err != nil || len(body) > 4*1024*1024 || json.Unmarshal(body, target) != nil {
		return errQuery
	}
	return nil
}
func availableVersion(ctx context.Context, tool SoftwareTool, installed string, fetch func(context.Context, string, any) error) (string, string, error) {
	endpoint, channel := "", "stable"
	switch tool.Kind {
	case "npm":
		channel = tool.Channel
		if channel == "" {
			channel = "latest"
		}
		endpoint = "https://registry.npmjs.org/" + url.PathEscape(tool.Package) + "/" + channel
		var release struct {
			Version string `json:"version"`
		}
		err := fetch(ctx, endpoint, &release)
		return normalizedVersion(release.Version), channel, err
	case "github":
		endpoint = "https://api.github.com/repos/" + tool.Repository + "/releases/latest"
		var release struct {
			Tag string `json:"tag_name"`
		}
		err := fetch(ctx, endpoint, &release)
		return normalizedVersion(release.Tag), channel, err
	case "node", "go":
		// Follow the installed major for Node and major.minor for Go.
		parts := strings.Split(installed, ".")
		count := 1
		endpoint = "https://nodejs.org/dist/index.json"
		if tool.Kind == "go" {
			count = 2
			endpoint = "https://go.dev/dl/?mode=json"
		}
		if len(parts) < count {
			return "", "", errQuery
		}
		prefix := strings.Join(parts[:count], ".") + "."
		channel = strings.TrimSuffix(prefix, ".") + ".x"
		var releases []struct {
			Version string `json:"version"`
		}
		if err := fetch(ctx, endpoint, &releases); err != nil {
			return "", channel, err
		}
		latest := ""
		for _, release := range releases {
			v := normalizedVersion(release.Version)
			if strings.HasPrefix(v, prefix) && !strings.Contains(v, "-") && (latest == "" || semver.Compare("v"+v, "v"+latest) > 0) {
				latest = v
			}
		}
		if latest == "" {
			return "", channel, errQuery
		}
		return latest, channel, nil
	}
	return "", "manual", errors.New("no configured release source")
}
func (s sampler) softwareTool(ctx context.Context, tool SoftwareTool, now time.Time) row {
	entry := row{"name": tool.Name, "source": tool.Kind, "status": "unknown", "checked_at": iso(now), "installed_version": nil, "available_version": nil}
	args := []string{tool.Executable, "--version"}
	if tool.Kind == "go" {
		args[1] = "version"
	}
	output, err := s.query(ctx, args, 5*time.Second, map[string]string{"NO_COLOR": "1"})
	if err != nil {
		entry["error"] = "Installed version unavailable"
		return entry
	}
	match := toolVersion.FindStringSubmatch(string(output))
	if len(match) < 2 {
		entry["error"] = "Installed version not recognized"
		return entry
	}
	installed := normalizedVersion(match[1])
	entry["installed_version"] = nullable(installed)
	available, channel, err := availableVersion(ctx, tool, installed, releaseJSON)
	entry["channel"] = channel
	if err != nil || available == "" {
		entry["error"] = "Release source unavailable or unsupported"
		return entry
	}
	entry["available_version"], entry["status"] = available, versionStatus(installed, available)
	return entry
}
func parseAPTUpdates(output string) ([]row, error) {
	updates := []row{}
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "Listing...") {
			continue
		}
		match := aptUpdateLine.FindStringSubmatch(line)
		if len(match) != 4 {
			return nil, errQuery
		}
		updates = append(updates, row{"name": match[1], "installed_version": match[3], "available_version": match[2]})
	}
	return updates, nil
}
func (s sampler) aptUpdates(ctx context.Context, now time.Time) row {
	entry := row{"status": "unknown", "checked_at": iso(now), "updates": []row{}, "security_index_at": nil}
	// This is the publication date of the local security index, not the check time.
	paths, _ := filepath.Glob("/var/lib/apt/lists/*security*InRelease")
	var index time.Time
	for _, path := range paths {
		if st, err := os.Stat(path); err == nil && st.ModTime().After(index) {
			index = st.ModTime()
		}
	}
	entry["security_index_at"] = timeValue(index)
	output, err := s.query(ctx, []string{"/usr/bin/apt", "list", "--upgradable"}, 15*time.Second, map[string]string{"LC_ALL": "C"})
	if err != nil {
		entry["error"] = "APT package query failed"
		return entry
	}
	updates, err := parseAPTUpdates(string(output))
	if err != nil {
		entry["error"] = "APT package output not recognized"
		return entry
	}
	entry["updates"] = updates
	entry["status"] = "current"
	if len(updates) > 0 {
		entry["status"] = "update_available"
	}
	if index.IsZero() || index.After(now.Add(time.Minute)) || now.Sub(index) > 48*time.Hour {
		entry["error"] = "Local APT security index is missing or older than 48 hours"
		entry["status"] = "unknown"
	}
	return entry
}
func (s sampler) software(ctx context.Context, cfg *SoftwareConfig, previous any, now time.Time) any {
	if cfg == nil {
		return nil
	}
	keyBytes, _ := json.Marshal(cfg)
	key := fmt.Sprintf("%x", sha256.Sum256(keyBytes))
	old, ok := previous.(map[string]any)
	if ok && text(old["config_hash"]) == key {
		checked := timestamp(old["checked_at"])
		if !checked.IsZero() && !checked.After(now) && now.Sub(checked) < time.Duration(cfg.interval())*time.Second {
			return old
		}
	}

	tools := make([]row, len(cfg.Tools))
	var wg sync.WaitGroup
	slots := make(chan struct{}, 4)
	for i, tool := range cfg.Tools {
		wg.Add(1)
		go func(i int, tool SoftwareTool) {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			tools[i] = s.softwareTool(ctx, tool, now)
		}(i, tool)
	}
	wg.Wait()
	var apt any
	if cfg.APT {
		apt = s.aptUpdates(ctx, now)
	}
	return row{"config_hash": key, "checked_at": iso(now), "interval_seconds": cfg.interval(), "apt": apt, "tools": tools}
}
