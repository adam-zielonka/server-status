package main

import (
	"fmt"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/host"
)

type SystemInfo struct {
	Hostname string `json:"hostname"`
	OS       string `json:"os"`
	Kernel   string `json:"kernel"`
	Uptime   uint64 `json:"uptime"`
	CPU      string `json:"cpu"`
}

func system() SystemInfo {
	var result SystemInfo

	info, _ := host.Info()
	cpuInfo, _ := cpu.Info()

	osName := fmt.Sprintf("%s %s", info.Platform, info.PlatformVersion)
	cpuName := fmt.Sprintf("%s @ %.0f Mhz", cpuInfo[0].ModelName, cpuInfo[0].Mhz)

	result = SystemInfo{
		Hostname: info.Hostname,
		OS:       osName,
		Kernel:   info.KernelVersion,
		Uptime:   info.Uptime,
		CPU:      cpuName,
	}

	return result
}
