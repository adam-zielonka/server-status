package mods

import (
	"github.com/shirou/gopsutil/v4/load"
)

type LoadAverage [3]float64

func LoadAvg() (LoadAverage, error) {
	memory, err := load.Avg()
	if err != nil {
		return LoadAverage{}, err
	}

	return LoadAverage{memory.Load1, memory.Load5, memory.Load15}, nil
}
