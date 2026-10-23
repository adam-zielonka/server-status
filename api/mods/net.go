package mods

import (
	"github.com/shirou/gopsutil/v4/net"
)

type Network struct {
	Interface string   `json:"iface"`
	Addresses []string `json:"addresses"`
	RxBytes   uint64   `json:"rx_bytes"`
	TxBytes   uint64   `json:"tx_bytes"`
}

func Net() ([]Network, error) {
	stats, err := net.IOCounters(true)
	if err != nil {
		return nil, err
	}
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}
	addresses := make(map[string][]string, len(interfaces))
	for _, iface := range interfaces {
		for _, addr := range iface.Addrs {
			addresses[iface.Name] = append(addresses[iface.Name], addr.Addr)
		}
	}

	var result []Network
	for _, p := range stats {
		addrs := addresses[p.Name]
		if addrs == nil {
			addrs = []string{}
		}
		result = append(result, Network{
			Interface: p.Name,
			Addresses: addrs,
			RxBytes:   p.BytesRecv,
			TxBytes:   p.BytesSent,
		})
	}

	return result, nil
}
