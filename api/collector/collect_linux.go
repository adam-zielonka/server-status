package collector

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/tklauser/go-sysconf"
	"golang.org/x/sys/unix"
)

var errCollection = errors.New("telemetry collection failed; check configuration and local permissions")

// Run collects one sample. The state lock prevents concurrent snapshot writers.
func Run(ctx context.Context, cfg *Config) error {
	if err := cfg.Validate(); err != nil {
		return err
	}
	lock, err := os.OpenFile(cfg.StateFile+".lock", os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return errCollection
	}
	defer lock.Close()
	if err := unix.Flock(int(lock.Fd()), unix.LOCK_EX|unix.LOCK_NB); err != nil {
		if errors.Is(err, unix.EWOULDBLOCK) {
			return nil
		}
		return errCollection
	}
	defer unix.Flock(int(lock.Fd()), unix.LOCK_UN)
	if err := (sampler{query: runCommand}).collect(ctx, cfg); err != nil {
		return errCollection
	}
	return nil
}

func (s sampler) collect(ctx context.Context, cfg *Config) error {
	state, previous := readObject(cfg.StateFile), readObject(cfg.SnapshotFile)
	now := time.Now()
	ticks, err := sysconf.Sysconf(sysconf.SC_CLK_TCK)
	if err != nil || ticks < 1 {
		return errCollection
	}
	container, err := s.container(ctx, float64(ticks))
	if err != nil {
		return err
	}
	before := readProcesses("/proc")
	cpuBefore := optionalCPUCounter()
	sampleAt := time.Now()
	timer := time.NewTimer(time.Second)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
	}
	after := readProcesses("/proc")
	cpuAfter := optionalCPUCounter()
	elapsed := time.Since(sampleAt).Seconds()
	var cpu any
	if cpuBefore != nil && cpuAfter != nil {
		cpu = round(float64(max(int64(0), *cpuAfter-*cpuBefore))/1e6/elapsed/numeric(container["effective_cpu_cores"])*100, 2)
	}
	directories := s.directories(ctx, cfg.Directories, rows(previous["directories"]), now, cfg.DirectoryInterval)
	services := s.services(ctx, cfg.Units, rows(previous["services"]))
	oldJobs := byName(rows(previous["jobs"]), "name")
	jobs := []row{}
	for _, item := range cfg.Jobs {
		old := oldJobs[item.Name]
		if item.Kind == "systemd" {
			jobs = append(jobs, s.systemdJob(ctx, item, old))
		} else {
			jobs = append(jobs, s.githubJob(ctx, item, old, now, cfg.GitHubInterval))
		}
	}
	var disk unix.Statfs_t
	if err := unix.Statfs("/", &disk); err != nil {
		return err
	}
	total := float64(disk.Blocks) * float64(disk.Bsize)
	used := float64(disk.Blocks-disk.Bfree) * float64(disk.Bsize)
	available := float64(disk.Bavail) * float64(disk.Bsize)
	diskPercent := float64(0)
	if used+available > 0 {
		diskPercent = round(used/(used+available)*100, 2)
	}
	if total <= 0 {
		return errCollection
	}
	limit := numeric(container["visible_memory_bytes"])
	if value := container["memory_limit_bytes"].(*int64); value != nil && *value > 0 {
		limit = float64(*value)
	}
	var memoryPercent any
	memory := container["memory_working_set_bytes"]
	if memory != nil && limit > 0 {
		memoryPercent = round(numeric(memory)/limit*100, 2)
	}
	directoryBytes := row{}
	for _, entry := range directories {
		if entry["bytes"] != nil {
			directoryBytes[text(entry["name"])] = entry["bytes"]
		}
	}
	point := row{"at": iso(now), "cpu_percent": cpu, "memory_percent": memoryPercent, "disk_percent": diskPercent, "memory_bytes": memory, "disk_used_bytes": int64(used), "directory_bytes": directoryBytes}
	history := retainHistory(rows(state["history"]), point, now)
	var tailscale any
	if cfg.Tailscale {
		tailscale = s.tailscale(ctx)
	}
	snapshot := row{"schema_version": 1, "enabled": true, "collected_at": iso(time.Now()), "sample_at": iso(now), "sample_interval_seconds": cfg.SampleInterval, "services": services, "processes": topProcesses(before, after, elapsed, float64(ticks)), "container": container, "tailscale": tailscale, "directories": directories, "jobs": jobs, "databases": s.databases(ctx, cfg.Databases), "tunnels": collectTunnels(ctx, cfg.Tunnels), "history": history}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := atomicJSON(cfg.SnapshotFile, snapshot, 0640); err != nil {
		return err
	}
	return atomicJSON(cfg.StateFile, row{"history": history}, 0600)
}

func optionalCPUCounter() *int64 {
	value, ok := numericFields("/sys/fs/cgroup/cpu.stat")["usage_usec"]
	if !ok || value < 0 {
		return nil
	}
	return &value
}

func atomicJSON(path string, data any, mode os.FileMode) error {
	// Marshal first: invalid values must not replace an existing snapshot.
	body, err := json.Marshal(data)
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".*")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	defer f.Close()
	if err := f.Chmod(mode); err != nil {
		return err
	}
	body = append(body, '\n')
	if written, err := f.Write(body); err != nil || written != len(body) {
		if err != nil {
			return err
		}
		return io.ErrShortWrite
	}
	if err := f.Sync(); err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}
