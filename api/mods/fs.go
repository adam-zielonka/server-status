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

func FileSystem() ([]FileSystemType, error) {
	partitions, err := disk.Partitions(false)
	if err != nil {
		return nil, err
	}

	var result []FileSystemType
	for _, partition := range partitions {
		usage, err := disk.Usage(partition.Mountpoint)
		if err != nil {
			return nil, err
		}

		fs := FileSystemType{
			FS:    partition.Device,
			Type:  partition.Fstype,
			Size:  usage.Total,
			Used:  usage.Used,
			Use:   usage.UsedPercent,
			Mount: partition.Mountpoint,
		}

		result = append(result, fs)
	}

	return result, nil
}
