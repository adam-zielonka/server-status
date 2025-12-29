package main

import (
	"github.com/shirou/gopsutil/v4/load"
)

type LoadAverage [3]float64

func loadAvg() LoadAverage {
	var result LoadAverage

	memory, _ := load.Avg()

	result = LoadAverage{memory.Load1, memory.Load5, memory.Load15}

	return result
}
