package config

import (
	"encoding/json"
	"fmt"
	"os"
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

var config *ServerConfig

func loadServerConfig() *ServerConfig {
	if config != nil {
		return config
	}
	path := "config.jsonc"
	b, err := os.ReadFile(path)
	if err != nil {
		panic(err)
	}
	if err := json.Unmarshal(b, &config); err != nil {
		panic(err)
	}
	return config
}

func FindUser(name string) (ServerUser, error) {
	config := loadServerConfig()
	for _, user := range config.Auth.Users {
		if user.Name == name {
			return user, nil
		}
	}
	return ServerUser{}, fmt.Errorf("user not found")
}

func FindUserAndCheckPassword(name string, pass string) error {
	config := loadServerConfig()
	for _, user := range config.Auth.Users {
		if user.Name == name && user.Pass == pass {
			return nil
		}
	}
	return fmt.Errorf("user not found")
}

func GetAuthSecret() []byte {
	config := loadServerConfig()
	return []byte(config.Auth.Secret)
}

func GetListenAddress() string {
	config := loadServerConfig()
	return fmt.Sprintf("%s:%d", config.Listen.Host, config.Listen.Port)
}

func GetExternalStatusCodeURL() string {
	config := loadServerConfig()
	return config.External
}
