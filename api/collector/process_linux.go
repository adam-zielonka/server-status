package collector

import (
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

type process struct {
	Name       string
	Executable string
	Service    string
	ServiceKey string
	PPID       int
	Ticks      uint64
	Start      uint64
	RSS        int64
}

func processStat(body string) (process, error) {
	left := strings.IndexByte(body, '(')
	right := strings.LastIndexByte(body, ')')
	if left < 0 || right <= left {
		return process{}, errors.New("invalid process stat")
	}
	fields := strings.Fields(body[right+1:])
	if len(fields) < 22 {
		return process{}, errors.New("invalid process stat")
	}
	ppid, e1 := strconv.Atoi(fields[1])
	user, e2 := strconv.ParseUint(fields[11], 10, 64)
	system, e3 := strconv.ParseUint(fields[12], 10, 64)
	start, e4 := strconv.ParseUint(fields[19], 10, 64)
	rss, e5 := strconv.ParseInt(fields[21], 10, 64)
	if e1 != nil || e2 != nil || e3 != nil || e4 != nil || e5 != nil {
		return process{}, errors.New("invalid process stat")
	}
	return process{Name: truncate(body[left+1:right], 80), PPID: ppid, Ticks: user + system, Start: start, RSS: max(0, rss) * int64(os.Getpagesize())}, nil
}
func truncate(s string, length int) string {
	r := []rune(s)
	if len(r) > length {
		return string(r[:length])
	}
	return s
}
func readProcesses(root string) map[int]process {
	result := map[int]process{}
	entries, err := os.ReadDir(root)
	if err != nil {
		return result
	}
	for _, entry := range entries {
		pid, err := strconv.Atoi(entry.Name())
		if err != nil || pid < 1 {
			continue
		}
		base := filepath.Join(root, entry.Name())
		body, err := os.ReadFile(filepath.Join(base, "stat"))
		if err != nil {
			continue
		}
		p, err := processStat(string(body))
		if err != nil {
			continue
		}
		if exe, err := os.Readlink(filepath.Join(base, "exe")); err == nil {
			p.Executable = truncate(strings.TrimSuffix(filepath.Base(exe), " (deleted)"), 80)
		}
		if cgroup, err := os.ReadFile(filepath.Join(base, "cgroup")); err == nil {
			for _, line := range strings.Split(string(cgroup), "\n") {
				if strings.HasPrefix(line, "0::") {
					parts := strings.Split(strings.TrimPrefix(line, "0::"), "/")
					for i := len(parts) - 1; i >= 0; i-- {
						if strings.HasSuffix(parts[i], ".service") {
							p.Service = truncate(parts[i], 120)
							p.ServiceKey = strings.Join(parts[:i+1], "/")
							break
						}
					}
					break
				}
			}
		}
		result[pid] = p
	}
	return result
}
func isBrowser(exe string) bool {
	switch exe {
	case "chrome", "chrome-headless-shell", "chromium", "chromium-browser", "firefox", "firefox-bin":
		return true
	}
	return false
}
func executableRoot(pid int, items map[int]process) int {
	root := pid
	seen := map[int]bool{pid: true}
	exe := items[pid].Executable
	for exe != "" {
		p := items[root]
		ancestor, ok := items[p.PPID]
		if !ok || seen[p.PPID] || ancestor.Executable != exe || ancestor.ServiceKey != items[pid].ServiceKey || ancestor.Start > p.Start {
			break
		}
		seen[p.PPID] = true
		root = p.PPID
	}
	return root
}
func processName(p process) any {
	if p.Executable != "" {
		return p.Executable
	}
	return nullable(p.Name)
}
func topProcesses(first, second map[int]process, elapsed, ticks float64) row {
	pids := make([]int, 0, len(second))
	for pid := range second {
		pids = append(pids, pid)
	}
	sort.Ints(pids)
	serviceMembers := map[string]map[int]bool{}
	for pid, p := range second {
		if key := p.ServiceKey; key != "" {
			if serviceMembers[key] == nil {
				serviceMembers[key] = map[int]bool{}
			}
			serviceMembers[key][pid] = true
		}
	}
	serviceRoots := map[string]int{}
	for key, members := range serviceMembers {
		candidates := []int{}
		for pid := range members {
			if !members[second[pid].PPID] {
				candidates = append(candidates, pid)
			}
		}
		if len(candidates) == 0 {
			for pid := range members {
				candidates = append(candidates, pid)
			}
		}
		sort.Slice(candidates, func(i, j int) bool {
			a, b := second[candidates[i]], second[candidates[j]]
			if a.Start == b.Start {
				return candidates[i] < candidates[j]
			}
			return a.Start < b.Start
		})
		serviceRoots[key] = candidates[0]
	}
	processRows := []row{}
	groups := map[string]row{}
	groupBrowsers := map[string]map[int]bool{}
	for _, pid := range pids {
		p := second[pid]
		var percent any
		if old, ok := first[pid]; ok && old.Start == p.Start && elapsed > 0 && ticks > 0 {
			diff := float64(0)
			if p.Ticks >= old.Ticks {
				diff = float64(p.Ticks - old.Ticks)
			}
			percent = round(diff/ticks/elapsed*100, 1)
		}
		browser := isBrowser(p.Executable)
		key := p.ServiceKey
		root := executableRoot(pid, second)
		kind := "process"
		var browserRoot any
		if browser {
			browserRoot = root
			kind = "browser"
		}
		if key != "" {
			root = serviceRoots[key]
			kind = "service"
		} else if browser {
			owner, ok := second[second[root].PPID]
			parent := second[root].PPID
			if parent > 1 && ok && owner.Executable != "" && !isBrowser(owner.Executable) && owner.ServiceKey == "" && owner.Start <= second[root].Start {
				root = executableRoot(parent, second)
				kind = "process"
			}
		}
		name := processName(second[root])
		groupKey := fmt.Sprintf("instance:%d", root)
		if kind == "service" {
			name = p.Service
			groupKey = "service:" + key
		}
		item := row{"pid": pid, "name": p.Name, "rss_bytes": p.RSS, "cpu_percent": percent, "ppid": p.PPID, "parent_name": processName(second[p.PPID]), "service": nullable(p.Service), "instance_pid": root, "instance_name": name, "group_kind": kind, "browser_instance_pid": browserRoot}
		processRows = append(processRows, item)
		g := groups[groupKey]
		if g == nil {
			rp := second[root]
			g = row{"pid": root, "name": name, "group_kind": kind, "rss_bytes": int64(0), "cpu_percent": float64(0), "process_count": 0, "member_pids": []int{}, "service": nullable(rp.Service), "ppid": rp.PPID, "parent_name": processName(second[rp.PPID])}
			groups[groupKey] = g
			groupBrowsers[groupKey] = map[int]bool{}
		}
		if browserRoot != nil {
			groupBrowsers[groupKey][browserRoot.(int)] = true
		}
		g["browser_instance_count"] = len(groupBrowsers[groupKey])
		g["rss_bytes"] = g["rss_bytes"].(int64) + p.RSS
		g["process_count"] = g["process_count"].(int) + 1
		g["member_pids"] = append(g["member_pids"].([]int), pid)
		if percent == nil || g["cpu_percent"] == nil {
			g["cpu_percent"] = nil
		} else {
			g["cpu_percent"] = round(numeric(g["cpu_percent"])+numeric(percent), 1)
		}
	}
	groupRows := []row{}
	for _, g := range groups {
		groupRows = append(groupRows, g)
	}
	ranked := func(items []row, key string) []row {
		out := append([]row{}, items...)
		sort.Slice(out, func(i, j int) bool {
			a, b := numeric(out[i][key]), numeric(out[j][key])
			if a == b {
				return numeric(out[i]["pid"]) < numeric(out[j]["pid"])
			}
			return a > b
		})
		return out
	}
	return row{"top_cpu": ranked(processRows, "cpu_percent"), "top_memory": ranked(processRows, "rss_bytes"), "groups_cpu": ranked(groupRows, "cpu_percent"), "groups_memory": ranked(groupRows, "rss_bytes"), "sample_seconds": math.Round(elapsed*100) / 100, "cpu_basis": "100% equals one logical CPU"}
}
