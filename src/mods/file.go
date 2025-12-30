package mods

import (
	"github.com/shirou/gopsutil/v4/disk"
)

type FileSystemType struct {
	FS    string  `json:"fs"`
	Type  string  `json:"type"`
	Size  uint64  `json:"size"`
	Used  uint64  `json:"used"`
	Use   float64 `json:"use"`
	Mount string  `json:"mount"`
}

func FileSystem() []FileSystemType {
	partitions, _ := disk.Partitions(true)

	var result []FileSystemType
	for _, p := range partitions {
		usage, _ := disk.Usage(p.Mountpoint)

		fs := FileSystemType{
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
