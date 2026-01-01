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

	var result []Network
	for _, stat := range stats {
		addrs := []string{}
		interfaces, _ := net.Interfaces()
		for _, iface := range interfaces {
			if iface.Name == stat.Name {
				for _, addr := range iface.Addrs {
					addrs = append(addrs, addr.Addr)
				}
			}
		}
		result = append(result, Network{
			Interface: stat.Name,
			Addresses: addrs,
			RxBytes:   stat.BytesRecv,
			TxBytes:   stat.BytesSent,
		})
	}

	return result, nil
}
