package mods

import (
	"net"
	"strconv"
	"time"

	"status/config"
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
	result := make([]Service, 0, len(services))

	for _, svc := range services {
		hosts := getHosts(hosts, svc.Port)
		service := Service{
			Name:  svc.Name,
			Port:  svc.Port,
			Hosts: hosts,
		}
		result = append(result, service)
	}

	return result, nil
}

func getHosts(hosts []string, port string) []*Host {
	result := make([]*Host, 0, len(hosts)+1)

	for _, host := range hosts {
		open := checkPort(host, port)
		result = append(result, &Host{
			Name: host,
			Port: port,
			Open: open,
		})
	}

	return result
}

func checkPort(host, portStr string) bool {
	// Validate port
	port, err := strconv.Atoi(portStr)
	if err != nil || port < 1 || port > 65535 {
		return false
	}

	// Try to connect to the port with a timeout
	address := net.JoinHostPort(host, portStr)
	timeout := 2 * time.Second

	conn, err := net.DialTimeout("tcp", address, timeout)
	if err != nil {
		return false
	}
	defer conn.Close()

	return true
}
