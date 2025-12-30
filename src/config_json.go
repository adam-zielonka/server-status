package main

import (
	"encoding/json"
	"fmt"
	"os"
)

// ServerConfig matches the structure in config.jsonc
type ServerConfig struct {
	Listen     Listen     `json:"listen"`
	Auth       ServerAuth `json:"auth"`
	Services   []Service  `json:"services"`
	Hosts      []string   `json:"hosts"`
	RootCAPath string     `json:"rootCAPath"`
	External   string     `json:"external"`
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

func loadServerConfig(path string) (*ServerConfig, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg ServerConfig
	if err := json.Unmarshal(b, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func findUser(name string) (ServerUser, error) {
	config, err := loadServerConfig("config.jsonc")
	if err != nil {
		return ServerUser{}, err
	}
	for _, user := range config.Auth.Users {
		if user.Name == name {
			return user, nil
		}
	}
	return ServerUser{}, fmt.Errorf("user not found")
}

func findUserAndCheckPassword(name string, pass string) error {
	config, err := loadServerConfig("config.jsonc")
	if err != nil {
		return err
	}
	for _, user := range config.Auth.Users {
		if user.Name == name && user.Pass == pass {
			return nil
		}
	}
	return fmt.Errorf("user not found")
}

func getAuthSecret() ([]byte, error) {
	config, err := loadServerConfig("config.jsonc")
	if err != nil {
		return nil, err
	}
	return []byte(config.Auth.Secret), nil
}
