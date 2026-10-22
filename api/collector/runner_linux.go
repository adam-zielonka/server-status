package collector

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"sort"
	"syscall"
	"time"
)

var errQuery = errors.New("read-only query failed")

type queryFunc func(context.Context, []string, time.Duration, map[string]string) ([]byte, error)
type sampler struct{ query queryFunc }

// Bound output and discard stderr: tools can print credentials on failure.
type boundedOutput struct{ bytes.Buffer }

func (b *boundedOutput) Write(p []byte) (int, error) {
	if b.Len()+len(p) > 4*1024*1024 {
		return 0, errQuery
	}
	return b.Buffer.Write(p)
}
func runCommand(parent context.Context, args []string, timeout time.Duration, env map[string]string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, args[0], args[1:]...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		if cmd.Process == nil {
			return os.ErrProcessDone
		}
		return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
	cmd.WaitDelay = time.Second
	cmd.Env = os.Environ()
	keys := make([]string, 0, len(env))
	for key := range env {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		cmd.Env = append(cmd.Env, key+"="+env[key])
	}
	var output boundedOutput
	cmd.Stdout = &output
	cmd.Stderr = io.Discard
	if cmd.Run() != nil {
		return nil, errQuery
	}
	return output.Bytes(), nil
}
