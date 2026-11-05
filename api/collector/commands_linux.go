package collector

import (
	"context"
	"time"
)

// Remap command positions only; arguments and monitored paths are never rewritten.
// The caller's maps/slices remain unchanged because checks may run concurrently.
func configuredQuery(cfg *Config, query queryFunc) queryFunc {
	resolve := func(path string) string {
		for name, original := range defaultCommands {
			if path == original && cfg.Commands[name] != "" {
				return cfg.Commands[name]
			}
		}
		return path
	}
	return func(ctx context.Context, args []string, timeout time.Duration, env map[string]string) ([]byte, error) {
		if len(args) == 0 {
			return nil, errQuery
		}
		next := append([]string(nil), args...)
		next[0] = resolve(args[0])
		if args[0] == defaultCommands["runuser"] && len(args) > 4 && args[3] == "--" && args[4] == defaultCommands["systemctl"] {
			next[4] = resolve(args[4])
		}
		if args[0] == defaultCommands["gh"] && cfg.GitHubConfigDir != "" {
			copyEnv := make(map[string]string, len(env)+1)
			for key, value := range env {
				copyEnv[key] = value
			}
			copyEnv["GH_CONFIG_DIR"] = cfg.GitHubConfigDir
			env = copyEnv
		}
		return query(ctx, next, timeout, env)
	}
}
