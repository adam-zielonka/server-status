package main

import (
	"github.com/elastic/go-sysinfo"
)

type Memory struct {
	Total     uint64 `json:"total"`
	Free      uint64 `json:"free"`
	Used      uint64 `json:"used"`
	Available uint64 `json:"available"`
}

func memory() Memory {
	var result Memory

	info, err := sysinfo.Host()
	if err != nil {
		return result
	}

	memory, err := info.Memory()
	if err != nil {
		return result
	}

	result = Memory{
		Total:     memory.Total,
		Free:      memory.Free,
		Used:      memory.Used,
		Available: memory.Available,
	}

	return result
}
