package collector

import (
	"context"
	"io"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

var metricPattern = regexp.MustCompile(`^(cloudflared_tunnel_[a-z_]+)(\{[^\n]*\})?\s+(\S+)$`)
var locationPattern = regexp.MustCompile(`(?:\{|,)edge_location="([A-Za-z0-9_-]{1,32})"(?:,|\})`)

func tunnelMetrics(body string) (row, error) {
	counters := map[string]string{"cloudflared_tunnel_ha_connections": "connections", "cloudflared_tunnel_total_requests": "requests", "cloudflared_tunnel_request_errors": "request_errors"}
	result := row{}
	locations := map[string]bool{}
	for _, line := range strings.Split(body, "\n") {
		match := metricPattern.FindStringSubmatch(line)
		if match == nil {
			continue
		}
		name, labels, raw := match[1], match[2], match[3]
		key, known := counters[name]
		if !known && name != "cloudflared_tunnel_server_locations" {
			continue
		}
		value, err := strconv.ParseFloat(raw, 64)
		if err != nil || math.IsNaN(value) || math.IsInf(value, 0) || value < 0 || value != math.Trunc(value) || value >= math.MaxInt64 {
			return nil, errQuery
		}
		if known && labels == "" {
			result[key] = int64(value)
		} else if name == "cloudflared_tunnel_server_locations" && value > 0 {
			if location := locationPattern.FindStringSubmatch(labels); location != nil {
				locations[location[1]] = true
			}
		}
	}
	if _, ok := result["connections"]; !ok {
		return nil, errQuery
	}
	codes := make([]string, 0, len(locations))
	for code := range locations {
		codes = append(codes, code)
	}
	sort.Strings(codes)
	result["locations"] = codes
	return result, nil
}
func tunnelHTTP(ctx context.Context, client *http.Client, port int, path string) (int, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://127.0.0.1:"+strconv.Itoa(port)+path, nil)
	if err != nil {
		return 0, "", errQuery
	}
	response, err := client.Do(req)
	if err != nil {
		return 0, "", errQuery
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 262145))
	if err != nil || len(body) > 262144 || !utf8.Valid(body) {
		return 0, "", errQuery
	}
	return response.StatusCode, string(body), nil
}
func collectTunnels(ctx context.Context, items []Tunnel) []row {
	// A literal IPv4 loopback destination, no proxies, redirects, or credentials.
	transport := &http.Transport{Proxy: nil, DisableKeepAlives: true}
	defer transport.CloseIdleConnections()
	client := &http.Client{Timeout: 2 * time.Second, Transport: transport, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	result := []row{}
	for _, item := range items {
		hosts := item.Hostnames
		if hosts == nil {
			hosts = []string{}
		}
		entry := row{"name": item.Name, "hostnames": hosts, "status": "unknown", "checked_at": iso(time.Now()), "expected_connections": item.expected()}
		status, body, err := tunnelHTTP(ctx, client, item.MetricsPort, "/metrics")
		metrics, parseErr := tunnelMetrics(body)
		if err != nil || status != 200 || parseErr != nil {
			entry["error"] = "Local connector metrics are unavailable"
			result = append(result, entry)
			continue
		}
		ready, _, err := tunnelHTTP(ctx, client, item.MetricsPort, "/ready")
		connections := numeric(metrics["connections"])
		if err != nil || ready != 200 && ready != 503 || ready == 200 && connections == 0 {
			entry["error"] = "Local connector metrics are unavailable"
		} else {
			for key, value := range metrics {
				entry[key] = value
			}
			status := "degraded"
			if ready == 503 || connections == 0 {
				status = "failure"
			} else if connections >= float64(item.expected()) {
				status = "healthy"
			}
			entry["status"] = status
		}
		result = append(result, entry)
	}
	return result
}
