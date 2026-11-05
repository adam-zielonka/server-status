package config

import (
	"bytes"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"net"
	"net/netip"
	"os"
	"slices"
	"strconv"
	"strings"
	"sync/atomic"
	"unicode"
)

const (
	DefaultSessionTTLSeconds = 43200
	MinSessionTTLSeconds     = 300
	MaxSessionTTLSeconds     = 604800
)

type ServerConfig struct {
	Listen        Listen     `json:"listen"`
	Auth          ServerAuth `json:"auth"`
	Services      []Service  `json:"services"`
	Hosts         []string   `json:"hosts"`
	TelemetryFile string     `json:"telemetry_file"`
}

type Listen struct {
	Host string `json:"host"`
	Port int    `json:"port"`
}

type ServerAuth struct {
	Users             []ServerUser `json:"users"`
	Secret            string       `json:"secret"`
	SessionTTLSeconds int          `json:"session_ttl_seconds,omitempty"`
}

type ServerUser struct {
	Name string `json:"name"`
	Pass string `json:"pass"`
}

type Service struct {
	Name string `json:"name"`
	Port string `json:"port"`
}

var config atomic.Pointer[ServerConfig]

func Initialize(path string) error {
	loaded, err := Load(path)
	if err != nil {
		return err
	}
	config.Store(loaded)
	return nil
}

// Load validates configuration without changing the running server's settings.
func Load(path string) (*ServerConfig, error) {
	if path == "" {
		path = "config.json"
	}

	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file")
	}

	// The shape check also rejects duplicate/case-ambiguous keys and null scalar
	// fields, which encoding/json otherwise silently accepts. Never report input
	// values (including unknown field names), since configuration holds secrets.
	if !validJSONShape(b, apiConfigShape) {
		return nil, fmt.Errorf("failed to parse config file: expected a JSON object with known fields and valid field types")
	}
	loaded := &ServerConfig{Auth: ServerAuth{SessionTTLSeconds: DefaultSessionTTLSeconds}}
	// external was retired in 4.6. It remains explicitly ignored for migration.
	wire := struct {
		*ServerConfig
		External json.RawMessage `json:"external"`
	}{ServerConfig: loaded}
	decoder := json.NewDecoder(bytes.NewReader(b))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&wire); err != nil {
		return nil, fmt.Errorf("failed to parse config file: expected valid field types")
	}
	if err := loaded.validate(); err != nil {
		return nil, err
	}
	return loaded, nil
}

func (c *ServerConfig) validate() error {
	if c.Listen.Port < 1 || c.Listen.Port > 65535 {
		return fmt.Errorf("listen port must be between 1 and 65535")
	}
	if c.Listen.Host != "" && !validHost(c.Listen.Host) {
		return fmt.Errorf("listen host must be an IP address or hostname without a port")
	}
	if strings.TrimSpace(c.Auth.Secret) == "" {
		return fmt.Errorf("auth secret is required")
	}
	if c.Auth.SessionTTLSeconds < MinSessionTTLSeconds || c.Auth.SessionTTLSeconds > MaxSessionTTLSeconds {
		return fmt.Errorf("auth session_ttl_seconds must be between 300 and 604800")
	}
	if len(c.Auth.Users) == 0 {
		return fmt.Errorf("at least one user is required")
	}
	names := map[string]bool{}
	for _, user := range c.Auth.Users {
		if !validName(user.Name) || strings.Contains(user.Name, ":") || names[user.Name] {
			return fmt.Errorf("user names must be nonblank, unique, without colons, control characters or surrounding whitespace")
		}
		if user.Pass == "" {
			return fmt.Errorf("user passwords must be nonempty")
		}
		names[user.Name] = true
	}
	names = map[string]bool{}
	for _, service := range c.Services {
		if !validName(service.Name) || names[service.Name] {
			return fmt.Errorf("service names must be nonblank, unique and without control characters or surrounding whitespace")
		}
		port, err := strconv.Atoi(service.Port)
		if err != nil || port < 1 || port > 65535 || strings.IndexFunc(service.Port, func(r rune) bool { return r < '0' || r > '9' }) >= 0 {
			return fmt.Errorf("service ports must be numeric and between 1 and 65535")
		}
		names[service.Name] = true
	}
	for _, host := range c.Hosts {
		if !validHost(host) {
			return fmt.Errorf("hosts must be IP addresses or hostnames without ports")
		}
	}
	if strings.TrimSpace(c.TelemetryFile) != c.TelemetryFile || strings.IndexFunc(c.TelemetryFile, unicode.IsControl) >= 0 {
		return fmt.Errorf("telemetry_file must not contain control characters or surrounding whitespace")
	}
	return nil
}

func validName(name string) bool {
	return name != "" && strings.TrimSpace(name) == name && strings.IndexFunc(name, unicode.IsControl) < 0
}

func validHost(host string) bool {
	if host == "" || strings.TrimSpace(host) != host {
		return false
	}
	if address, err := netip.ParseAddr(host); err == nil {
		return address.Zone() == "" || (address.Is6() && validName(address.Zone()) && !strings.ContainsAny(address.Zone(), "/\\%[]:"))
	}
	// Accept ASCII DNS names (including localhost and a terminal root dot)
	// without resolving them or requiring network access during config checks.
	host = strings.TrimSuffix(host, ".")
	if len(host) == 0 || len(host) > 253 || strings.Contains(host, ":") {
		return false
	}
	for _, label := range strings.Split(host, ".") {
		if len(label) == 0 || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, char := range label {
			if !(char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char >= '0' && char <= '9' || char == '-') {
				return false
			}
		}
	}
	return true
}

// GetAuthSettings returns one coherent snapshot for authentication and key
// derivation, even if Initialize replaces the settings concurrently.
func GetAuthSettings() ServerAuth {
	if current := config.Load(); current != nil {
		settings := current.Auth
		settings.Users = slices.Clone(settings.Users)
		return settings
	}
	return ServerAuth{}
}

func (settings ServerAuth) FindUser(name string) (ServerUser, error) {
	for _, user := range settings.Users {
		if user.Name == name {
			return user, nil
		}
	}
	return ServerUser{}, fmt.Errorf("user not found")
}

func (settings ServerAuth) CheckPassword(name, pass string) error {
	user, err := settings.FindUser(name)
	if err != nil || pass == "" {
		return fmt.Errorf("invalid credentials")
	}
	// Compare fixed-size digests so password length does not affect comparison.
	expected, supplied := sha256.Sum256([]byte(user.Pass)), sha256.Sum256([]byte(pass))
	if subtle.ConstantTimeCompare(expected[:], supplied[:]) != 1 {
		return fmt.Errorf("invalid credentials")
	}
	return nil
}

func FindUser(name string) (ServerUser, error) {
	return GetAuthSettings().FindUser(name)
}

func FindUserAndCheckPassword(name string, pass string) error {
	return GetAuthSettings().CheckPassword(name, pass)
}

func GetAuthSecret() []byte {
	return []byte(GetAuthSettings().Secret)
}

func GetListenAddress() string {
	if current := config.Load(); current != nil {
		return net.JoinHostPort(current.Listen.Host, strconv.Itoa(current.Listen.Port))
	}
	return "localhost:4000"
}

func GetServicesAndHosts() ([]Service, []string) {
	if current := config.Load(); current != nil {
		return slices.Clone(current.Services), slices.Clone(current.Hosts)
	}
	return []Service{}, []string{}
}

func GetTelemetryFile() string {
	if current := config.Load(); current != nil {
		return current.TelemetryFile
	}
	return ""
}
