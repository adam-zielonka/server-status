//go:build !linux

package collector

import (
	"context"
	"errors"
)

func Run(context.Context, *Config) error {
	return errors.New("collect requires Linux with /proc and cgroup v2")
}
