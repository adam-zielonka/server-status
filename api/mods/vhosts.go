package mods

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"sort"
	"status/config"
	"strconv"
	"strings"
	"sync"
	"time"
)

type VHost struct {
	Port               string `json:"port"`
	Name               string `json:"name"`
	StatusCode         string `json:"statusCode"`
	ExternalStatusCode string `json:"externalStatusCode"`
	scheme             string
}

type caddyRoute struct {
	Match []struct {
		Host []string `json:"host"`
	} `json:"match"`
	Handle []struct {
		Routes []caddyRoute `json:"routes"`
	} `json:"handle"`
}

type CaddyConfig struct {
	Apps struct {
		HTTP struct {
			Servers map[string]struct {
				Listen []string          `json:"listen"`
				Routes []caddyRoute      `json:"routes"`
				TLS    []json.RawMessage `json:"tls_connection_policies"`
			} `json:"servers"`
		} `json:"http"`
	} `json:"apps"`
}

const probeTimeout = 2 * time.Second

func noProbeRedirect(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }

// Local probes always connect to loopback. The URL retains the virtual host for
// HTTP Host and TLS SNI. Only this loopback transport accepts local certificates.
func localProbeTransport() *http.Transport {
	return &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			_, port, err := net.SplitHostPort(address)
			if err != nil {
				return nil, err
			}
			return (&net.Dialer{Timeout: probeTimeout}).DialContext(ctx, network, net.JoinHostPort("127.0.0.1", port))
		},
		MaxConnsPerHost: 8,
		IdleConnTimeout: 30 * time.Second,
	}
}

func VHosts(ctx context.Context) ([]VHost, error) {
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	transport := localProbeTransport()
	defer transport.CloseIdleConnections()
	local := &http.Client{Timeout: probeTimeout, Transport: transport, CheckRedirect: noProbeRedirect}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://localhost:2019/config/", nil)
	if err != nil {
		return nil, fmt.Errorf("virtual host configuration is unavailable")
	}
	resp, err := local.Do(req)
	if err != nil {
		return nil, fmt.Errorf("virtual host configuration is unavailable")
	}
	defer resp.Body.Close()
	const maxConfig = 2 * 1024 * 1024
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxConfig+1))
	var settings CaddyConfig
	if err != nil || resp.StatusCode != http.StatusOK || len(body) > maxConfig || json.Unmarshal(body, &settings) != nil {
		return nil, fmt.Errorf("virtual host configuration is unavailable")
	}
	vhosts := configuredVHosts(settings)
	externalTransport := http.DefaultTransport.(*http.Transport).Clone()
	defer externalTransport.CloseIdleConnections()
	external := &http.Client{Timeout: probeTimeout, Transport: externalTransport, CheckRedirect: noProbeRedirect}
	probeVHosts(ctx, vhosts, local, external, config.GetExternalStatusCodeURL())
	return vhosts, nil
}

func configuredVHosts(settings CaddyConfig) []VHost {
	result := []VHost{}
	seen := map[string]bool{}
	for _, server := range settings.Apps.HTTP.Servers {
		for _, listen := range server.Listen {
			_, port, err := net.SplitHostPort(listen)
			number, parseErr := strconv.Atoi(port)
			if err != nil || parseErr != nil || number < 1 || number > 65535 {
				continue
			}
			scheme := "http"
			if port == "443" || len(server.TLS) > 0 {
				scheme = "https"
			}
			var visit func([]caddyRoute)
			visit = func(routes []caddyRoute) {
				for _, route := range routes {
					for _, match := range route.Match {
						for _, host := range match.Host {
							key := net.JoinHostPort(host, port)
							if seen[key] {
								continue
							}
							seen[key] = true
							result = append(result, VHost{Port: port, Name: host, scheme: scheme, StatusCode: "0"})
						}
					}
					for _, handler := range route.Handle {
						visit(handler.Routes)
					}
				}
			}
			visit(server.Routes)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Name == result[j].Name {
			return result[i].Port < result[j].Port
		}
		return result[i].Name < result[j].Name
	})
	return result
}

func probeVHosts(ctx context.Context, hosts []VHost, local, external *http.Client, externalURL string) {
	work := make(chan int)
	var workers sync.WaitGroup
	for range min(8, len(hosts)) {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for i := range work {
				target := hosts[i].scheme + "://" + net.JoinHostPort(hosts[i].Name, hosts[i].Port)
				hosts[i].StatusCode = checkVHost(ctx, local, target)
				if externalURL != "" {
					hosts[i].ExternalStatusCode = checkExternalVHost(ctx, external, externalURL, "http://"+hosts[i].Name)
				}
			}
		}()
	}
	defer workers.Wait()
	defer close(work)
	for i := range hosts {
		if externalURL != "" {
			hosts[i].ExternalStatusCode = "0"
		}
	}
	for i := range hosts {
		select {
		case <-ctx.Done():
			return
		case work <- i:
		}
	}
}

func checkVHost(ctx context.Context, client *http.Client, target string) string {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return "0"
	}
	resp, err := client.Do(req)
	if err != nil {
		return "0"
	}
	defer resp.Body.Close()
	return strconv.Itoa(resp.StatusCode)
}

func checkExternalVHost(ctx context.Context, client *http.Client, externalURL, target string) string {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, externalURL, bytes.NewBufferString(target))
	if err != nil {
		return "0"
	}
	req.Header.Set("Content-Type", "text/plain")
	resp, err := client.Do(req)
	if err != nil {
		return "0"
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 33))
	code := strings.TrimSpace(string(body))
	number, parseErr := strconv.Atoi(code)
	if err != nil || len(body) > 32 || resp.StatusCode < 200 || resp.StatusCode >= 300 || parseErr != nil || number < 100 || number > 599 {
		return "0"
	}
	return strconv.Itoa(number)
}
