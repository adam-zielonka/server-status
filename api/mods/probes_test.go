package mods

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"status/config"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestConfiguredVHostsIncludesNestedRoutesAndAllListeners(t *testing.T) {
	var settings CaddyConfig
	err := json.Unmarshal([]byte(`{"apps":{"http":{"servers":{"example":{"listen":[":443","127.0.0.1:8443"],"tls_connection_policies":[{}],"routes":[{"match":[{"host":["b.example.com","a.example.com"]}],"handle":[{"routes":[{"match":[{"host":["a.example.com","nested.example.com"]}]}]}]}]}}}}}`), &settings)
	if err != nil {
		t.Fatal(err)
	}
	hosts := configuredVHosts(settings)
	if len(hosts) != 6 {
		t.Fatalf("expected 6 distinct host/listener pairs: %+v", hosts)
	}
	if hosts[0].Name != "a.example.com" || hosts[0].Port != "443" || hosts[5].Name != "nested.example.com" {
		t.Fatalf("unexpected ordering: %+v", hosts)
	}
	for _, host := range hosts {
		if host.scheme != "https" {
			t.Fatal("TLS policy must select HTTPS")
		}
	}
}

func TestLocalProbeUsesLoopbackAndRetainsHostAndSNI(t *testing.T) {
	received := make(chan string, 1)
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received <- r.Host + "|" + r.TLS.ServerName
		w.Header().Set("Location", "https://elsewhere.example.com")
		w.WriteHeader(http.StatusTemporaryRedirect)
	}))
	defer server.Close()
	address, _ := url.Parse(server.URL)
	transport := localProbeTransport()
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: time.Second, CheckRedirect: noProbeRedirect}
	target := "https://vhost.example.invalid:" + address.Port()
	if code := checkVHost(context.Background(), client, target); code != "307" {
		t.Fatalf("got status %s", code)
	}
	if got := <-received; got != "vhost.example.invalid:"+address.Port()+"|vhost.example.invalid" {
		t.Fatal(got)
	}
}

func TestExternalProbeValidatesResponseAndCertificates(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Error("expected POST")
		}
		w.Write([]byte(r.URL.Query().Get("code")))
	}))
	defer server.Close()
	client := &http.Client{Timeout: time.Second, CheckRedirect: noProbeRedirect}
	for _, test := range []struct{ body, want string }{
		{"204", "204"}, {" 301\n", "301"}, {"<html>upstream failure</html>", "0"}, {strings.Repeat("2", 64), "0"}, {"999", "0"},
	} {
		if got := checkExternalVHost(context.Background(), client, server.URL+"?code="+url.QueryEscape(test.body), "http://example.com"); got != test.want {
			t.Errorf("%q: got %s, want %s", test.body, got, test.want)
		}
	}
	tlsServer := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("200")) }))
	defer tlsServer.Close()
	if got := checkExternalVHost(context.Background(), client, tlsServer.URL, "http://example.com"); got != "0" {
		t.Fatal("external TLS must verify certificates")
	}
}

func TestVHostProbesBoundConcurrencyAndHonorCancellation(t *testing.T) {
	var active, peak atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := active.Add(1)
		defer active.Add(-1)
		for {
			old := peak.Load()
			if old >= n || peak.CompareAndSwap(old, n) {
				break
			}
		}
		<-r.Context().Done()
	}))
	defer server.Close()
	address, _ := url.Parse(server.URL)
	hosts := make([]VHost, 32)
	for i := range hosts {
		hosts[i] = VHost{Name: address.Hostname(), Port: address.Port(), scheme: "http", StatusCode: "0"}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()
	client := &http.Client{Timeout: time.Second}
	start := time.Now()
	probeVHosts(ctx, hosts, client, client, "")
	if time.Since(start) > 2*time.Second {
		t.Fatal("cancellation did not stop probes")
	}
	if n := peak.Load(); n < 1 || n > 8 {
		t.Fatalf("unexpected concurrency: %d", n)
	}
	for _, host := range hosts {
		if host.StatusCode != "0" {
			t.Fatal("a canceled probe must not look healthy")
		}
	}
}

func TestPortChecksAndCancellation(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	_, port, _ := net.SplitHostPort(listener.Addr().String())
	services := []config.Service{{Name: "Example", Port: port}, {Name: "Invalid", Port: "0"}}
	result, err := probeServices(context.Background(), services, []string{"127.0.0.1"})
	if err != nil {
		t.Fatal(err)
	}
	if !result[0].Hosts[0].Open || result[1].Hosts[0].Open {
		t.Fatalf("unexpected checks: %+v", result)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := probeServices(ctx, services, []string{"127.0.0.1"}); err == nil {
		t.Fatal("canceled checks must not return a successful report")
	}
}
