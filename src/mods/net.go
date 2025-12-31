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
	for _, p := range stats {
		addrs := []string{}
		n, _ := net.Interfaces()
		for _, ni := range n {
			if ni.Name == p.Name {
				for _, addr := range ni.Addrs {
					addrs = append(addrs, addr.Addr)
				}
			}
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
