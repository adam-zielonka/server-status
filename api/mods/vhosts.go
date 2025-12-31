package mods

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"status/config"
	"strings"
)

type VHost struct {
	Port               string `json:"port"`
	Name               string `json:"name"`
	StatusCode         string `json:"statusCode"`
	ExternalStatusCode string `json:"externalStatusCode"`
}

type CaddyConfig struct {
	Apps struct {
		HTTP struct {
			Servers map[string]struct {
				Listen []string `json:"listen"`
				Routes []struct {
					Match []struct {
						Host []string `json:"host"`
					} `json:"match"`
				} `json:"routes"`
			} `json:"servers"`
		} `json:"http"`
	} `json:"apps"`
}

func VHosts() ([]VHost, error) {
	resp, err := http.Get("http://localhost:2019/config/")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var caddyConfig CaddyConfig
	if err := json.Unmarshal(body, &caddyConfig); err != nil {
		return nil, err
	}

	var vhosts []VHost
	servers := caddyConfig.Apps.HTTP.Servers

	for _, server := range servers {
		if len(server.Listen) == 0 {
			continue
		}

		port := strings.TrimPrefix(server.Listen[0], ":")

		for _, route := range server.Routes {
			for _, match := range route.Match {
				for _, host := range match.Host {
					vhosts = append(vhosts, VHost{
						Port: port,
						Name: host,
					})
				}
			}
		}
	}

	for i, vhost := range vhosts {
		vhosts[i].StatusCode = CheckVHost(vhost.Name)
		vhosts[i].ExternalStatusCode = CheckExternalVHost(vhost.Name)
	}

	return vhosts, nil
}

func CheckVHost(name string) string {
	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	req, err := http.NewRequest("GET", fmt.Sprintf("http://%s", name), nil)
	if err != nil {
		return fmt.Sprintf("%d", http.StatusInternalServerError)
	}

	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		return "0"
	}
	defer resp.Body.Close()

	return fmt.Sprintf("%d", resp.StatusCode)
}

func CheckExternalVHost(name string) string {
	externalURL := config.GetExternalStatusCodeURL()
	if externalURL == "" {
		return "Need setup"
	}

	body := []byte(fmt.Sprintf("http://%s", name))
	req, err := http.NewRequest("POST", externalURL, bytes.NewBuffer(body))
	if err != nil {
		return "0"
	}

	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")

	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		return "0"
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Sprintf("%d", resp.StatusCode)
	}

	return string(responseBody)
}
