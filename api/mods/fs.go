package mods

import (
	"github.com/shirou/gopsutil/v4/disk"
)

type FileSystemType struct {
	FS        string  `json:"fs"`
	Type      string  `json:"type"`
	Size      uint64  `json:"size"`
	Used      uint64  `json:"used"`
	Available uint64  `json:"available"`
	Use       float64 `json:"use"`
	Mount     string  `json:"mount"`
}

func FileSystem() ([]FileSystemType, error) {
	return fileSystems(disk.Partitions, disk.Usage)
}

func fileSystems(list func(bool) ([]disk.PartitionStat, error), usageAt func(string) (*disk.UsageStat, error)) ([]FileSystemType, error) {
	partitions, err := list(false)
	if err != nil {
		return nil, err
	}
	hasRoot := false
	for _, p := range partitions {
		hasRoot = hasRoot || p.Mountpoint == "/"
	}
	if !hasRoot {
		// gopsutil's physical-filesystem filter excludes overlayfs. Keep other
		// pseudo mounts filtered, but always measure the application's root.
		root := disk.PartitionStat{Device: "/", Mountpoint: "/", Fstype: "unknown"}
		if all, err := list(true); err == nil {
			for _, p := range all {
				if p.Mountpoint == "/" {
					root = p
					break
				}
			}
		}
		partitions = append(partitions, root)
	}

	var result []FileSystemType
	for _, p := range partitions {
		usage, err := usageAt(p.Mountpoint)
		if err != nil {
			return nil, err
		}

		fs := FileSystemType{
			FS:        p.Device,
			Type:      p.Fstype,
			Size:      usage.Total,
			Used:      usage.Used,
			Available: usage.Free,
			Use:       usage.UsedPercent,
			Mount:     p.Mountpoint,
		}

		result = append(result, fs)
	}

	return result, nil
}
