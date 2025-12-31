package mods

import (
	"github.com/shirou/gopsutil/v4/mem"
)

type MemoryType struct {
	Active    uint64 `json:"active"`
	Used      uint64 `json:"used"`
	Available uint64 `json:"available"`
	Total     uint64 `json:"total"`
	Swapfree  uint64 `json:"swapfree"`
	Swaptotal uint64 `json:"swaptotal"`
	Swapused  uint64 `json:"swapused"`
}

func Memory() (MemoryType, error) {
	memory, err := mem.VirtualMemory()
	if err != nil {
		return MemoryType{}, err
	}

	return MemoryType{
		Active:    memory.Active,
		Available: memory.Available,
		Used:      memory.Used,
		Total:     memory.Total,
		Swapfree:  memory.SwapFree,
		Swaptotal: memory.SwapTotal,
		Swapused:  memory.SwapTotal - memory.SwapFree,
	}, nil
}
