# Optional operations monitoring

The Linux collector adds systemd health, process resource usage, container/cgroup
allocation, Tailscale status, persistent resource history, directory growth, and
scheduled task/backup results. Code, UI and examples use English.

The collector is separate from the HTTP API. It runs read-only commands on a
timer and atomically writes an allowlisted snapshot. The API remains an
unprivileged process without command execution or service-control endpoints.
`/api/telemetry` requires JWT authentication, like the existing metrics.

## Privacy boundaries

Keep real configuration, credentials, snapshots, history, deployment notes,
hostnames, infrastructure addresses, directory labels and task sources **outside
the public checkout**. Only `config.example.json` is intended for version control.
Never copy production snapshots into tests, screenshots, demo assets, issues,
commits or CI artifacts. The public demo generates synthetic data.

The collector does not read process arguments, environment variables, journal
messages, Tailscale peer lists/user identities/key material, workflow logs or
backup contents. Service errors contain systemd result/exit codes only. GitHub
access uses the collector user's existing `gh` login; no token belongs in the
application config, frontend build variables or service unit.

Snapshots contain operational information: store them privately and expose the
API only behind authentication on the intended network. For Tailscale-only
access, Serve can publish the built frontend directory and proxy `/api` to a
loopback API. Keep Funnel disabled. Never publish the snapshot directory or its
parents as static files.

## Installation

Requires Linux, cgroup v2, Python 3.10+, systemd and GNU `du`. Tailscale and `gh`
are optional, depending on configured checks. The provided collector unit runs
as root to read process counters and directory metadata. It has no listener,
uses no shell, and has a read-only filesystem with limited capabilities. Only
root may edit its configuration or installed code.

1. Create a `server-status` system group/account for the API if needed.
2. Create `/etc/server-status` with mode 0700. Copy `config.example.json` to
   `/etc/server-status/collector.json`, mode 0600, and configure the checks.
3. Create `/var/lib/server-status`, owned by `root:server-status`, mode **2750**.
   The setgid bit makes atomic snapshots inherit the API's group.
4. Install `collect.py` as `/opt/server-status/collect.py`, owned by root.
5. Add `"telemetry_file": "/var/lib/server-status/telemetry.json"` to the
   private API configuration and restart the API.
6. Install the supplied `.service` and `.timer` into `/etc/systemd/system/`, run
   `systemctl daemon-reload`, then
   `systemctl enable --now server-status-collector.timer`.
7. Run `systemctl start server-status-collector.service` for an initial sample.

The unit creates `/var/lib/server-status-collector` (0700) for persistent state
and locking. Snapshots are 0640; state/history is 0600. The API gets read access
only to its snapshot, never collector configuration or private state.

Without `telemetry_file`, the API returns `{"enabled":false}` and the operations
section remains hidden. This preserves the original dashboard for other users.
Configure `units` for long-running services, `directories` for disk growth, and
`jobs` for systemd oneshots and GitHub Actions workflows. Service/task entries
accept an optional `user` for a user service manager; tasks accept a `timer`.

The timer defaults to 60 seconds. Keep `sample_interval_seconds` aligned with
`OnUnitActiveSec` if changing it. Directory scans default to 15 minutes; GitHub
checks default to 5 minutes. Set `max_age_seconds` per task to match its schedule,
including weekends. Unreachable or missing sources are explicitly unknown.

## Metric semantics

- Service uptime uses systemd monotonic timestamps. Restarts show current
  `NRestarts`. Last observed errors persist, without historical journal scraping.
- Process CPU uses a roughly one-second sample: 100% means one logical CPU.
  Reused PIDs never inherit the previous process's counter.
- Overall CPU uses the visible cgroup CPU counter normalized to cpuset/quota.
  Memory working set is `memory.current - inactive_file`; its percentage uses
  a finite cgroup limit or visible `/proc/meminfo` memory as a fallback.
  Total cgroup memory including file cache is displayed separately.
- Ancestor cgroup limits may be hidden. "No finite limit visible" does not
  assert unlimited host resources. PID 1 lifetime is separate from the kernel
  boot clock and uses matching clock sources.
- History starts at installation, retains up to 24 hours and survives API and
  collector restarts. Missing samples are never fabricated. Stale snapshots
  are marked after three intervals (at least three minutes); chart gaps remain.
- Directory sizes are allocated bytes from `du -sx -B1`, respecting mount
  boundaries. Growth compares actual observations in the selected time window.
  Failed scans retain their last value and timestamp, with an explicit error.
- A successful inactive oneshot is a successful task. Known successful runs are
  retained across later observed failures. Workflow success reports metadata;
  backup contents and restoreability require separate verification.
- The UI polls every 30 seconds. Indicators flag stale data, unhealthy services,
  resource pressure, expiring node keys and failed/overdue tasks. They do not
  send outbound notifications.

## Validation and disabling

```bash
python3 -m unittest discover -s collector -p 'test_*.py'
systemd-analyze verify collector/server-status-collector.service collector/server-status-collector.timer
systemctl status server-status-collector.timer
journalctl -u server-status-collector.service -n 20 --no-pager
```

Disable with `systemctl disable --now server-status-collector.timer`, remove
`telemetry_file` from the private API configuration, and restart the API.
History remains on disk; remove it separately only when intended. Do not reset
unrelated Tailscale Serve mappings.

References: [cgroup v2](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html),
[systemd services](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html).
