package main

import (
	"github.com/elastic/go-sysinfo"
)

type SystemInfo struct {
	Hostname string `json:"hostname"`
	OS       string `json:"os"`
	Kernel   string `json:"kernel"`
	Uptime   string `json:"uptime"`
	CPU      string `json:"cpu"`
}

func system() SystemInfo {
	var result SystemInfo

	info, err := sysinfo.Host()
	if err != nil {
		return result
	}

	result = SystemInfo{
		Hostname: info.Info().Hostname,
		OS:       info.Info().OS.Name,
		Kernel:   info.Info().KernelVersion,
		Uptime:   info.Info().BootTime.String(),
	}

	return result
}
