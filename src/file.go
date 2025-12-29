package main

import (
	"github.com/shirou/gopsutil/v4/disk"
)

type FileSystem struct {
	FS    string  `json:"fs"`
	Type  string  `json:"type"`
	Size  uint64  `json:"size"`
	Used  uint64  `json:"used"`
	Use   float64 `json:"use"`
	Mount string  `json:"mount"`
}

func fileSystem() []FileSystem {
	partitions, _ := disk.Partitions(true)

	var result []FileSystem
	for _, p := range partitions {
		usage, _ := disk.Usage(p.Mountpoint)

		fs := FileSystem{
			FS:    p.Device,
			Type:  p.Fstype,
			Size:  usage.Total,
			Used:  usage.Used,
			Use:   usage.UsedPercent,
			Mount: p.Mountpoint,
		}

		result = append(result, fs)
	}

	return result
}
