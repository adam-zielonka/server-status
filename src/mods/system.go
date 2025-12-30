package mods

import (
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/host"
)

type SystemInfo struct {
	Platform string `json:"platform"`
	Distro   string `json:"distro"`
	Release  string `json:"release"`
	Codename string `json:"codename"`
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

func System() FullSystemInfo {
	info, _ := host.Info()
	cpuInfo, _ := cpu.Info()

	return FullSystemInfo{
		System: SystemInfo{
			Platform: info.Platform,
			Distro:   info.PlatformFamily,
			Release:  info.PlatformVersion,
			Codename: "",
			Kernel:   info.KernelVersion,
			Arch:     info.KernelArch,
			Hostname: info.Hostname,
		},
		CPU: CPUInfo{
			Manufacturer: cpuInfo[0].VendorID,
			Brand:        cpuInfo[0].ModelName,
			Speed:        cpuInfo[0].Mhz,
			Cores:        cpuInfo[0].Cores,
		},
		Time: TimeInfo{
			Uptime: info.Uptime,
		},
	}
}
