package mods

import (
	"net"
	"strconv"
	"sync"
	"time"

	"status/config"
)

const (
	portCheckTimeout = 2 * time.Second
	minPort          = 1
	maxPort          = 65535
)

type Service struct {
	Name  string  `json:"name"`
	Port  string  `json:"port"`
	Link  string  `json:"link,omitempty"`
	Hosts []*Host `json:"hosts"`
}

type Host struct {
	Name string `json:"name"`
	Port string `json:"port"`
	Open bool   `json:"open"`
}

func Services() ([]Service, error) {
	services, hosts := config.GetServicesAndHosts()
	result := make([]Service, len(services))
	var wg sync.WaitGroup

	for i, svc := range services {
		wg.Add(1)
		go func(index int, service config.Service) {
			defer wg.Done()
			checkedHosts := getHosts(hosts, service.Port)
			result[index] = Service{
				Name:  service.Name,
				Port:  service.Port,
				Hosts: checkedHosts,
			}
		}(i, svc)
	}

	wg.Wait()
	return result, nil
}

func getHosts(hosts []string, port string) []*Host {
	result := make([]*Host, len(hosts))
	var wg sync.WaitGroup

	for i, host := range hosts {
		wg.Add(1)
		go func(index int, hostname string) {
			defer wg.Done()
			open := checkPort(hostname, port)
			result[index] = &Host{
				Name: hostname,
				Port: port,
				Open: open,
			}
		}(i, host)
	}

	wg.Wait()
	return result
}

func checkPort(host, portStr string) bool {
	// Validate port
	port, err := strconv.Atoi(portStr)
	if err != nil || port < minPort || port > maxPort {
		return false
	}

	// Try to connect to the port with a timeout
	address := net.JoinHostPort(host, portStr)

	conn, err := net.DialTimeout("tcp", address, portCheckTimeout)
	if err != nil {
		return false
	}
	defer conn.Close()

	return true
}
