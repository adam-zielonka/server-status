package config

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"strconv"
)

type ServerConfig struct {
	Listen        Listen     `json:"listen"`
	Auth          ServerAuth `json:"auth"`
	Services      []Service  `json:"services"`
	Hosts         []string   `json:"hosts"`
	External      string     `json:"external"`
	TelemetryFile string     `json:"telemetry_file"`
}

type Listen struct {
	Host string `json:"host"`
	Port int    `json:"port"`
}

type ServerAuth struct {
	Users  []ServerUser `json:"users"`
	Secret string       `json:"secret"`
}

type ServerUser struct {
	Name string `json:"name"`
	Pass string `json:"pass"`
}

type Service struct {
	Name string `json:"name"`
	Port string `json:"port"`
}

var config *ServerConfig

func Initialize(path string) error {
	loaded, err := Load(path)
	if err != nil {
		return err
	}
	config = loaded
	return nil
}

// Load validates configuration without changing the running server's settings.
func Load(path string) (*ServerConfig, error) {
	var configPath string

	if path == "" {
		// Try default paths
		if _, err := os.Stat("config.jsonc"); err == nil {
			configPath = "config.jsonc"
		} else if _, err := os.Stat("config.json"); err == nil {
			configPath = "config.json"
		} else {
			return nil, fmt.Errorf("config file not found: checked config.jsonc and config.json in the working directory")
		}
	} else {
		configPath = path
	}

	b, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var loaded *ServerConfig
	if err := json.Unmarshal(b, &loaded); err != nil {
		// A type error can contain a supplied value. Do not print config contents.
		return nil, fmt.Errorf("failed to parse config file: expected a JSON object with valid field types")
	}
	if loaded == nil {
		return nil, fmt.Errorf("config must be a JSON object")
	}

	// Validate config
	if loaded.Listen.Port < 1 || loaded.Listen.Port > 65535 {
		return nil, fmt.Errorf("listen port must be between 1 and 65535")
	}
	if loaded.Auth.Secret == "" {
		return nil, fmt.Errorf("auth secret is required")
	}
	if len(loaded.Auth.Users) == 0 {
		return nil, fmt.Errorf("at least one user is required")
	}

	return loaded, nil
}

func FindUser(name string) (ServerUser, error) {
	if config == nil {
		return ServerUser{}, fmt.Errorf("config not initialized")
	}
	for _, user := range config.Auth.Users {
		if user.Name == name {
			return user, nil
		}
	}
	return ServerUser{}, fmt.Errorf("user not found")
}

func FindUserAndCheckPassword(name string, pass string) error {
	if config == nil {
		return fmt.Errorf("invalid credentials")
	}
	for _, user := range config.Auth.Users {
		if user.Name == name && user.Pass == pass {
			return nil
		}
	}
	return fmt.Errorf("invalid credentials")
}

func GetAuthSecret() []byte {
	if config == nil {
		return []byte{}
	}
	return []byte(config.Auth.Secret)
}

func GetListenAddress() string {
	if config == nil {
		return "localhost:4000"
	}
	return net.JoinHostPort(config.Listen.Host, strconv.Itoa(config.Listen.Port))
}

func GetExternalStatusCodeURL() string {
	if config == nil {
		return ""
	}
	return config.External
}

func GetServicesAndHosts() ([]Service, []string) {
	if config == nil {
		return []Service{}, []string{}
	}
	return config.Services, config.Hosts
}

func GetTelemetryFile() string {
	if config == nil {
		return ""
	}
	return config.TelemetryFile
}
