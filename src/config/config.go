package config

import (
	"encoding/json"
	"fmt"
	"os"
)

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

var config *ServerConfig

func loadServerConfig() (*ServerConfig, error) {
	if config != nil {
		return config, nil
	}
	path := "config.jsonc"
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(b, &config); err != nil {
		return nil, err
	}
	return config, nil
}

func FindUser(name string) (ServerUser, error) {
	config, err := loadServerConfig()
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

func FindUserAndCheckPassword(name string, pass string) error {
	config, err := loadServerConfig()
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

func GetAuthSecret() ([]byte, error) {
	config, err := loadServerConfig()
	if err != nil {
		return nil, err
	}
	return []byte(config.Auth.Secret), nil
}

func GetListenAddress() (string, error) {
	config, err := loadServerConfig()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s:%d", config.Listen.Host, config.Listen.Port), nil
}
