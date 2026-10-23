package mods

import (
	"context"
	"fmt"
	"net"
	"status/config"
	"strconv"
	"sync"
	"time"
)

type Service struct {
	Name  string  `json:"name"`
	Port  string  `json:"port"`
	Hosts []*Host `json:"hosts"`
}

type Host struct {
	Name string `json:"name"`
	Port string `json:"port"`
	Open bool   `json:"open"`
}

func Services(ctx context.Context) ([]Service, error) {
	services, hosts := config.GetServicesAndHosts()
	return probeServices(ctx, services, hosts)
}

func probeServices(ctx context.Context, services []config.Service, hosts []string) ([]Service, error) {
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	result := make([]Service, len(services))
	checks := []*Host{}
	for i, service := range services {
		result[i] = Service{Name: service.Name, Port: service.Port, Hosts: make([]*Host, len(hosts))}
		for j, name := range hosts {
			host := &Host{Name: name, Port: service.Port}
			result[i].Hosts[j] = host
			checks = append(checks, host)
		}
	}
	work := make(chan *Host)
	var workers sync.WaitGroup
	for range min(16, len(checks)) {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for host := range work {
				host.Open = checkPort(ctx, host.Name, host.Port)
			}
		}()
	}
	for _, host := range checks {
		if ctx.Err() != nil {
			break
		}
		select {
		case <-ctx.Done():
		case work <- host:
		}
	}
	close(work)
	workers.Wait()
	if ctx.Err() != nil {
		return nil, fmt.Errorf("port checks did not complete in time")
	}
	return result, nil
}

func checkPort(ctx context.Context, host, portStr string) bool {
	port, err := strconv.Atoi(portStr)
	if err != nil || port < 1 || port > 65535 {
		return false
	}
	conn, err := (&net.Dialer{Timeout: 2 * time.Second}).DialContext(ctx, "tcp", net.JoinHostPort(host, portStr))
	if err != nil {
		return false
	}
	conn.Close()
	return true
}
