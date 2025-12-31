package mods

import (
	"math"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/host"
)

type SystemInfo struct {
	Distro   string `json:"distro"`
	Release  string `json:"release"`
	Kernel   string `json:"kernel"`
	Arch     string `json:"arch"`
	Hostname string `json:"hostname"`
}

type CPUInfo struct {
	Manufacturer string  `json:"manufacturer"`
	Brand        string  `json:"brand"`
	Speed        float64 `json:"speed"`
	Cores        int32   `json:"cores"`
}

type TimeInfo struct {
	Uptime uint64 `json:"uptime"`
}

type FullSystemInfo struct {
	System SystemInfo `json:"system"`
	CPU    CPUInfo    `json:"cpu"`
	Time   TimeInfo   `json:"time"`
}

func System() (FullSystemInfo, error) {
	info, err := host.Info()
	if err != nil {
		return FullSystemInfo{}, err
	}
	cpuInfo, err := cpu.Info()
	if err != nil {
		return FullSystemInfo{}, err
	}

	return FullSystemInfo{
		System: SystemInfo{
			Distro:   info.Platform,
			Release:  info.PlatformVersion,
			Kernel:   info.KernelVersion,
			Arch:     info.KernelArch,
			Hostname: info.Hostname,
		},
		CPU: CPUInfo{
			Manufacturer: cpuInfo[0].VendorID,
			Brand:        cpuInfo[0].ModelName,
			Speed:        math.Round(cpuInfo[0].Mhz/100) / 10,
			Cores:        int32(len(cpuInfo)),
		},
		Time: TimeInfo{
			Uptime: info.Uptime,
		},
	}, nil
}
