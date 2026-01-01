package config

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

var (
	config     *ServerConfig
	configOnce sync.Once
	configErr  error
)

type ServerConfig struct {
	Listen   Listen     `json:"listen"`
	Auth     ServerAuth `json:"auth"`
	Services []Service  `json:"services"`
	Hosts    []string   `json:"hosts"`
	External string     `json:"external"`
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

func Initialize(path string) error {
	var configPath string

	if path == "" {
		// Try default paths
		if _, err := os.Stat("config.jsonc"); err == nil {
			configPath = "config.jsonc"
		} else if _, err := os.Stat("config.json"); err == nil {
			configPath = "config.json"
		} else {
			return fmt.Errorf("config file not found: checked config.jsonc and config.json")
		}
	} else {
		configPath = path
	}

	return loadServerConfig(configPath)
}

func loadServerConfig(path string) error {
	var loadErr error
	configOnce.Do(func() {
		b, err := os.ReadFile(path)
		if err != nil {
			loadErr = fmt.Errorf("failed to read config file: %w", err)
			return
		}

		if err := json.Unmarshal(b, &config); err != nil {
			loadErr = fmt.Errorf("failed to parse config file: %w", err)
			return
		}

		// Validate config
		if config.Listen.Port < 1 || config.Listen.Port > 65535 {
			loadErr = fmt.Errorf("invalid port number: %d", config.Listen.Port)
			return
		}
		if config.Auth.Secret == "" {
			loadErr = fmt.Errorf("auth secret is required")
			return
		}
		if len(config.Auth.Users) == 0 {
			loadErr = fmt.Errorf("at least one user is required")
			return
		}
	})
	return loadErr
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
	return fmt.Sprintf("%s:%d", config.Listen.Host, config.Listen.Port)
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
