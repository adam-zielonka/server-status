// Package collector produces allowlisted Linux telemetry snapshots.
// It is invoked only by the collect CLI command.
package collector

import (
	"encoding/json"
	"errors"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type AgentQueueConfig struct {
	GitHubConfigFile string `json:"github_config_file"`
}

type Config struct {
	AgentQueue        *AgentQueueConfig `json:"agent_queue"`
	SnapshotFile      string            `json:"snapshot_file"`
	StateFile         string            `json:"state_file"`
	SampleInterval    int               `json:"sample_interval_seconds"`
	DirectoryInterval int               `json:"directory_interval_seconds"`
	GitHubInterval    int               `json:"github_interval_seconds"`
	CPUCapacityCores  *float64          `json:"cpu_capacity_cores"`
	Software          *SoftwareConfig   `json:"software"`
	Tailscale         bool              `json:"tailscale"`
	Units             []Unit            `json:"units"`
	Directories       []Directory       `json:"directories"`
	Jobs              []Job             `json:"jobs"`
	Databases         []Database        `json:"databases"`
	Tunnels           []Tunnel          `json:"tunnels"`
	BackupStores      []BackupStore     `json:"backup_stores"`
}

// BackupStore reads sanitized measurements from a separate backup checker.
// The collector never receives remote credentials or runs backup operations.
type BackupStore struct {
	Name       string `json:"name"`
	StatusFile string `json:"status_file"`
	MaxAge     int    `json:"max_age_seconds"`
}

type SoftwareConfig struct {
	Interval int            `json:"interval_seconds"`
	APT      bool           `json:"apt"`
	Tools    []SoftwareTool `json:"tools"`
}
type SoftwareTool struct {
	Name       string `json:"name"`
	Executable string `json:"executable"`
	Kind       string `json:"kind"`
	Package    string `json:"package"`
	Repository string `json:"repository"`
	Channel    string `json:"channel"`
}

func (c *SoftwareConfig) interval() int {
	if c.Interval == 0 {
		return 21600
	}
	return c.Interval
}

type Unit struct {
	Name string `json:"name"`
	Unit string `json:"unit"`
	User string `json:"user"`
}

type Directory struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

type Job struct {
	Unit
	Kind       string `json:"kind"`
	Category   string `json:"category"`
	Timer      string `json:"timer"`
	Repository string `json:"repository"`
	Workflow   string `json:"workflow"`
	MaxAge     *int   `json:"max_age_seconds"`
}

type Database struct {
	Name        string `json:"name"`
	Service     string `json:"service"`
	ServiceFile string `json:"service_file"`
	LimitBytes  int64  `json:"limit_bytes"`
}

type Tunnel struct {
	Name        string   `json:"name"`
	Hostnames   []string `json:"hostnames"`
	MetricsPort int      `json:"metrics_port"`
	Expected    *int     `json:"expected_connections"`
}

func (t Tunnel) expected() int {
	if t.Expected != nil {
		return *t.Expected
	}
	return 4
}
func (j Job) maxAge() int {
	if j.MaxAge != nil {
		return *j.MaxAge
	}
	return 86400
}
func (j Job) category() string {
	if j.Category != "" {
		return j.Category
	}
	return "maintenance"
}

var (
	unitPattern       = regexp.MustCompile(`^[A-Za-z0-9_@][A-Za-z0-9_.@:\\-]*\.(service|timer)$`)
	userPattern       = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_.-]*\$?$`)
	repositoryPattern = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)
	servicePattern    = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)
	hostPattern       = regexp.MustCompile(`^[A-Za-z0-9.-]{1,253}$`)
)

func Load(path string) (*Config, error) {
	if path == "" {
		return nil, errors.New("collector requires --config with an explicit private configuration path")
	}
	body, err := os.ReadFile(path)
	if err != nil {
		return nil, errors.New("collector configuration could not be read")
	}
	cfg := &Config{SampleInterval: 60, DirectoryInterval: 900, GitHubInterval: 300}
	if json.Unmarshal(body, &cfg) != nil || cfg == nil {
		return nil, errors.New("invalid collector configuration JSON or field types")
	}
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) Validate() error {
	if c == nil || !filepath.IsAbs(c.SnapshotFile) || !filepath.IsAbs(c.StateFile) ||
		filepath.Clean(c.SnapshotFile) == filepath.Clean(c.StateFile) ||
		filepath.Clean(c.SnapshotFile) == filepath.Clean(c.StateFile)+".lock" {
		return errors.New("collector output paths must be absolute and distinct")
	}
	if c.SampleInterval < 1 || c.DirectoryInterval < 1 || c.GitHubInterval < 1 {
		return errors.New("collector intervals must be positive seconds")
	}
	if c.CPUCapacityCores != nil && (*c.CPUCapacityCores <= 0 || math.IsNaN(*c.CPUCapacityCores) || math.IsInf(*c.CPUCapacityCores, 0)) {
		return errors.New("CPU capacity must be a finite positive number of cores")
	}
	if c.AgentQueue != nil && !filepath.IsAbs(c.AgentQueue.GitHubConfigFile) {
		return errors.New("agent queue requires an absolute GitHub configuration path")
	}
	if c.Software != nil {
		if c.Software.interval() < 3600 || c.Software.interval() > 604800 || len(c.Software.Tools) > 24 {
			return errors.New("software checks require an interval between one hour and one week and at most 24 tools")
		}
		names := map[string]bool{}
		for _, tool := range c.Software.Tools {
			if strings.TrimSpace(tool.Name) == "" || names[tool.Name] || !filepath.IsAbs(tool.Executable) {
				return errors.New("invalid software name or executable")
			}
			names[tool.Name] = true
			switch tool.Kind {
			case "npm":
				if !regexp.MustCompile(`^(@[a-z0-9_-]+/)?[a-z0-9_.-]+$`).MatchString(tool.Package) || (tool.Channel != "" && !regexp.MustCompile(`^[a-zA-Z0-9_-]+$`).MatchString(tool.Channel)) {
					return errors.New("invalid npm package or channel")
				}
			case "github":
				if !repositoryPattern.MatchString(tool.Repository) {
					return errors.New("invalid software release repository")
				}
			case "node", "go", "manual":
			default:
				return errors.New("unsupported software source")
			}
		}
	}
	for _, item := range c.Units {
		if !validUnit(item) {
			return errors.New("invalid collector unit or user")
		}
	}
	for _, item := range c.Directories {
		if strings.TrimSpace(item.Name) == "" || !filepath.IsAbs(item.Path) {
			return errors.New("invalid directory configuration")
		}
	}
	storeNames := map[string]bool{}
	for _, item := range c.BackupStores {
		if strings.TrimSpace(item.Name) == "" || storeNames[item.Name] || !filepath.IsAbs(item.StatusFile) || item.MaxAge < 60 || item.MaxAge > 604800 {
			return errors.New("invalid backup store name, status file or maximum age")
		}
		storeNames[item.Name] = true
	}
	ports := map[int]bool{}
	for _, item := range c.Tunnels {
		if item.MetricsPort < 1 || item.MetricsPort > 65535 || ports[item.MetricsPort] || item.expected() < 1 || item.expected() > 100 || strings.TrimSpace(item.Name) == "" {
			return errors.New("invalid tunnel name, connection count or duplicate metrics port")
		}
		ports[item.MetricsPort] = true
		for _, host := range item.Hostnames {
			if !hostPattern.MatchString(host) {
				return errors.New("invalid tunnel hostname")
			}
		}
	}
	for _, item := range c.Databases {
		if strings.TrimSpace(item.Name) == "" || !servicePattern.MatchString(item.Service) || !filepath.IsAbs(item.ServiceFile) || item.LimitBytes <= 0 {
			return errors.New("invalid database configuration")
		}
	}
	for _, item := range c.Jobs {
		if strings.TrimSpace(item.Name) == "" || item.maxAge() < 1 {
			return errors.New("invalid task name or maximum age")
		}
		switch item.Kind {
		case "systemd":
			if !validUnit(item.Unit) || item.Timer != "" && !unitPattern.MatchString(item.Timer) {
				return errors.New("invalid task unit or timer")
			}
		case "github":
			if !repositoryPattern.MatchString(item.Repository) || strings.TrimSpace(item.Workflow) == "" || strings.HasPrefix(item.Workflow, "-") {
				return errors.New("invalid workflow configuration")
			}
		default:
			return errors.New("unsupported task source")
		}
	}
	return nil
}

func validUnit(u Unit) bool {
	return unitPattern.MatchString(u.Unit) && (u.User == "" || userPattern.MatchString(u.User))
}
