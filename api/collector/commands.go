package collector

// Defaults are explicit rather than searched through the privileged process's
// PATH. Operators may override individual tools in their private configuration.
var defaultCommands = map[string]string{
	"systemctl": "/usr/bin/systemctl", "runuser": "/usr/sbin/runuser",
	"du": "/usr/bin/du", "gh": "/usr/bin/gh", "psql": "/usr/bin/psql",
	"tailscale": "/usr/bin/tailscale", "systemd-detect-virt": "/usr/bin/systemd-detect-virt",
	"apt": "/usr/bin/apt", "apt-cache": "/usr/bin/apt-cache",
	"dpkg": "/usr/bin/dpkg", "dpkg-query": "/usr/bin/dpkg-query",
}
