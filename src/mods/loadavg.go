package mods

import (
	"github.com/shirou/gopsutil/v4/load"
)

type LoadAverage [3]float64

func LoadAvg() LoadAverage {
	memory, _ := load.Avg()

	return LoadAverage{memory.Load1, memory.Load5, memory.Load15}
}
