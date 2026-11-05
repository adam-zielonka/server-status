package mods

import (
	"errors"
	"testing"

	"github.com/shirou/gopsutil/v4/disk"
)

func TestRootUsageSurvivesPhysicalPartitionFilter(t *testing.T) {
	for _, fallback := range []bool{false, true} {
		result, err := fileSystems(func(all bool) ([]disk.PartitionStat, error) {
			if !all {
				return []disk.PartitionStat{{Device: "/dev/example", Mountpoint: "/data", Fstype: "ext4"}}, nil
			}
			if fallback {
				return nil, errors.New("mount metadata unavailable")
			}
			return []disk.PartitionStat{{Device: "overlay", Mountpoint: "/", Fstype: "overlay"}, {Device: "proc", Mountpoint: "/proc", Fstype: "proc"}}, nil
		}, func(path string) (*disk.UsageStat, error) {
			if path != "/" && path != "/data" {
				t.Fatal("pseudo mount must remain filtered")
			}
			return &disk.UsageStat{Total: 1000, Used: 600, Free: 300, UsedPercent: 600.0 / 900 * 100}, nil
		})
		if err != nil || len(result) != 2 || result[1].Mount != "/" || result[1].Available != 300 {
			t.Fatalf("root usage missing: %v %v", result, err)
		}
		if !fallback && result[1].Type != "overlay" {
			t.Fatal("overlay metadata missing")
		}
	}
}

func TestRootPartitionNotDuplicated(t *testing.T) {
	result, err := fileSystems(func(all bool) ([]disk.PartitionStat, error) {
		if all {
			t.Fatal("unfiltered enumeration unnecessary")
		}
		return []disk.PartitionStat{{Device: "/dev/root", Mountpoint: "/", Fstype: "ext4"}}, nil
	}, func(string) (*disk.UsageStat, error) { return &disk.UsageStat{Total: 1000}, nil })
	if err != nil || len(result) != 1 {
		t.Fatal("root must appear once")
	}
}
