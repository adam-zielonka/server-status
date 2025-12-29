package main

import (
	"github.com/shirou/gopsutil/v4/mem"
)

type Memory struct {
	Active    uint64 `json:"active"`
	Available uint64 `json:"available"`
	Buffcache uint64 `json:"buffcache"`
	Free      uint64 `json:"free"`
	Swapfree  uint64 `json:"swapfree"`
	Swaptotal uint64 `json:"swaptotal"`
	Swapused  uint64 `json:"swapused"`
	Total     uint64 `json:"total"`
	Used      uint64 `json:"used"`
}

func memory() Memory {
	memory, _ := mem.VirtualMemory()

	return Memory{
		Active:    memory.Active,
		Available: memory.Available,
		Buffcache: memory.Buffers + memory.Cached,
		Free:      memory.Free,
		Swapfree:  memory.SwapFree,
		Swaptotal: memory.SwapTotal,
		Swapused:  memory.SwapTotal - memory.SwapFree,
		Total:     memory.Total,
		Used:      memory.Used,
	}
}
