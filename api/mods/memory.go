package mods

import (
	"github.com/shirou/gopsutil/v4/mem"
)

type MemoryType struct {
	Used      uint64 `json:"used"`
	Cached    uint64 `json:"cached"`
	Free      uint64 `json:"free"`
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
		Used:      memory.Used,
		Cached:    memory.Total - memory.Free - memory.Used,
		Free:      memory.Free,
		Total:     memory.Total,
		Swapfree:  memory.SwapFree,
		Swaptotal: memory.SwapTotal,
		Swapused:  memory.SwapTotal - memory.SwapFree,
	}, nil
}
