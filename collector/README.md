# Optional operations monitoring

The Linux collector adds systemd health, process resource usage, container/cgroup
allocation, Tailscale status, persistent resource history, directory growth, and
scheduled task/backup results. Code, UI and examples use English.

The Go collector runs as `server-status collect --config /path/to/collector.json`
from the same executable that serves the dashboard and API. It is a separate
process from the HTTP API. It runs read-only commands on a timer and atomically
writes an allowlisted snapshot. The API remains an
unprivileged process without command execution or service-control endpoints.
`/api/telemetry` requires JWT authentication, like the existing metrics.

## Privacy boundaries

Keep real configuration, credentials, snapshots, history, deployment notes,
hostnames, infrastructure addresses, directory labels and task sources **outside
the public checkout**. Only the supplied example configurations are intended for version control.
Never copy production snapshots into tests, screenshots, demo assets, issues,
commits or CI artifacts. The public demo generates synthetic data.

The collector does not read process arguments, environment variables, journal
messages, Tailscale peer lists/user identities/key material, workflow logs or
backup contents. Service errors contain systemd result/exit codes only. GitHub
access uses the collector user's existing `gh` login; no token belongs in the
application config, frontend build variables or service unit.

Snapshots contain operational information: store them privately and expose the
API only behind authentication on the intended network. For Tailscale-only
access, Serve can proxy all paths to the loopback Go listener, which serves the
embedded frontend and API. Keep Funnel disabled. Never publish the snapshot
directory or its parents as static files.

## Installation

Requires Linux, cgroup v2, systemd and GNU `du`. Tailscale and `gh` are optional,
depending on configured checks. The provided collector unit runs
as root to read process counters and directory metadata. It has no listener,
uses no shell, and has a read-only filesystem with limited capabilities. Only
root may edit its configuration or installed code.

Follow the complete [installation guide](../docs/installation.md) for the API,
credential delivery, minimal collector configuration, ownership and units. The
minimal configuration collects core samples without enabling optional sources.
The full example is a catalog: configure its integrations before using it. The
collector unit creates private state and publishes a group-readable snapshot;
the API does not need access to collector configuration or state.

Without `telemetry_file`, `/api/telemetry` reports disabled and operations views
show disabled states.
Configure `units` for long-running services, `directories` for disk growth, and
`jobs` for systemd oneshots and GitHub Actions workflows. Service/task entries
accept an optional `user` for a user service manager; tasks accept a `timer`.

The timer defaults to 60 seconds. Keep `sample_interval_seconds` aligned with
`OnUnitActiveSec` if changing it. Directory scans default to 15 minutes; GitHub
checks default to 5 minutes. Set `max_age_seconds` per task to match its schedule,
including weekends. Unreachable or missing sources are explicitly unknown.

The snapshot retains the last observed systemd attempt, completion, outcome,
error and successful completion across host/manager restarts or unit unloading.
Resetting a failed unit does not rewrite an observed failure as a success.
Empty execution timestamps from systemd do not erase that history; timer state
and the next scheduled run are still refreshed. A previously running attempt
whose completion was not observed remains unknown after a restart. Keep the
snapshot on persistent storage: the collector cannot reconstruct erased history
or infer a successful attempt from systemd's default `Result=success` alone.

## Tool paths and GitHub identity

Optional `commands` maps symbolic names `systemctl`, `runuser`, `du`, `gh`,
`psql`, `tailscale`, `systemd-detect-virt`, `apt`, `apt-cache`, `dpkg`, and
`dpkg-query` to trusted absolute executable paths. Omitted entries retain the
built-in defaults. Only root should control these executables and configuration;
do not use untrusted paths. Optional `github_config_dir` is an absolute path to
a private GitHub CLI configuration directory. When omitted, the collector uses
the invoking user's normal `gh` defaults and environment; no root-specific
configuration directory is forced. Ensure the service account can access any
configured sources without exposing credentials.

Defaults use `/usr/bin/<name>` except `runuser`, which uses `/usr/sbin/runuser`.
For example, `"commands": {"gh": "/usr/local/bin/gh"}` changes only the GitHub
CLI executable. Commands still run without a shell and keep the same fixed
arguments, timeouts and output limits. Configuration validation checks path
syntax; it does not prove that an executable exists or can access its source.
Software inventory's explicit `executable` paths remain independent of these
integration overrides.

## Metric semantics

- Service uptime uses systemd monotonic timestamps. Restarts show current
  `NRestarts`. Last observed errors persist, without historical journal scraping.
- Process CPU uses a roughly one-second sample: 100% means one logical CPU.
  Reused PIDs never inherit the previous process's counter.
- Processes include parent PID/name, executable basename (no full path), and
  the innermost systemd service name from cgroup metadata when available.
  All members of the same systemd service cgroup are grouped together,
  including browser instances and workers running different executables.
  Service identity includes the cgroup hierarchy internally, so equal unit
  names in separate user managers stay distinct. Each process is counted once.
  Without a service, connected same-executable ancestors form an instance;
  browsers join the group of their observed non-browser launching parent
  (excluding PID 1), when it has no conflicting service metadata. Otherwise
  browser instances stay standalone. Browser instance counts remain visible
  in groups, and individual browser processes retain their browser main PID.
  The group PID is the oldest observed root when a service has several roots.
  All observed processes and groups are included in the sorted rankings, with
  no top-N limit. The UI expands a group into its complete process list.
  Summed RSS can count shared pages repeatedly; it is not unique physical memory.
  A group CPU estimate is unavailable if any member lacks a valid CPU sample.
  Exited/missing ancestors cannot be reconstructed. PID lists include every
  observed member. `top_cpu` and `top_memory` contain full rankings.
- Overall CPU uses the visible cgroup CPU counter normalized to cpuset/quota.
  Optional `cpu_capacity_cores` sets a positive capacity in logical CPU units
  when a host limit is hidden. For example, `"cpu_capacity_cores": 1` makes
  one fully used CPU equal 100%, even with two visible logical CPUs (previously
  50%). The smaller of configured capacity and visible cpuset/quota is used;
  omitting the setting preserves automatic detection. This is operator
  calibration, not proof of a host quota. Raw utilization and resource-alert
  thresholds keep this allocation-based scale.
  The **CPU usage** card, resource history and resource alerts all use the same
  allocation-based percentage. The UI does not normalize readings to a historical
  peak or display additional CPU scales. Legacy peak metadata remains in collector
  state and snapshots for compatibility but is not used by the dashboard.
  Retained CPU history is rescaled using each point's saved capacity (legacy
  points use the previous snapshot's allocation); values with an unknown
  original scale become unavailable. Process CPU remains per logical CPU.
  Short sampling bursts may exceed 100%; values are not clipped.
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
./build.sh frontend
(cd api && go test ./...)
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

## Database capacity

### PostgreSQL (default)

Optional `databases` entries default to `kind: "postgres"` when `kind` is omitted,
preserving existing configuration. PostgreSQL entries contain `name`, `service`,
`service_file` (absolute path to a private libpq service file) and `limit_bytes` (bytes, not MiB). Requires
`psql`. Store credentials in a separate 0600 passfile referenced by that service;
use verified TLS. Credentials are never passed in process arguments or snapshot
fields. The collector executes a fixed read-only query with connection and
statement timeouts, returning database size, remaining capacity, connection
count, TLS status and round-trip latency. The Storage page shows warnings at
80% and critical usage at 95%. Query errors show unknown usage, never zero.
Capacity is operator supplied; this check does not impose a database quota.

### MySQL / MariaDB

Set `kind: "mysql"` (or `"mariadb"`), `name`, positive `limit_bytes`, and an
absolute `mysql_config_file`; omit `service` and `service_file`. The existing
Storage row and capacity alerts are reused without changing the snapshot contract.
The private JSON file has exactly the fields shown in
[`mysql-config.example.json`](mysql-config.example.json):

```json
{
  "host": "db.example.test",
  "port": 3306,
  "user": "example-monitor",
  "database": "example_schema",
  "password_file": "/etc/server-status/mysql.password",
  "tls_ca_file": "/etc/server-status/mysql-ca.pem",
  "tls_server_name": "db.example.test"
}
```

All fields above are required in CA mode. Host is a bare DNS name or IP, not a
URL; port is an integer 1–65535. File paths must be absolute. Configuration and
password files must be regular files with no group/other permission bits
(0600 or 0400 recommended), in private directories outside the checkout. Reads
are capped at 16 KiB for JSON, 64 KiB for password and 1 MiB for CA PEM. The
password is read **byte-exact**, including spaces, Unicode, CR/LF or an empty
file; write the submitted secret without appending a newline. Unknown fields,
invalid types and invalid TLS combinations are rejected. The collector validates
private input each attempt; the top-level `config check` validates the engine
and config path, without connecting or opening the referenced private files.

TLS 1.2+ is mandatory, with no plaintext fallback. CA mode requires both the
trusted CA PEM and the expected certificate DNS/IP SAN in `tls_server_name`,
even when connecting by a different address. A self-signed server certificate
works as the trust anchor if its SAN matches that name.

For a self-signed leaf without usable SANs, replace **both** `tls_ca_file` and
`tls_server_name` with the single optional field `tls_cert_sha256`, containing
exactly 64 hexadecimal characters (case insensitive, no colons/prefix), the
SHA-256 digest of the **DER leaf certificate**. Empty/null/malformed pins and
combinations with either CA/name field are invalid. For example, the TLS part
of a synthetic pinned configuration is:

```json
"tls_cert_sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

Pin mode replaces PKI/hostname verification with mandatory constant-time leaf
hash comparison, certificate validity-date checks and verification of its
self-signature. There is no configurable skip-verification option. An initial
certificate fetched over an unauthenticated handshake is **TOFU** (trust on
first use), not proof of provider identity; confirm the fingerprint through a
trusted independent channel when possible. A changed/renewed certificate fails
closed until its replacement fingerprint is independently checked and the
private config updated. Check the local clock; expiry and not-yet-valid
certificates fail even with the correct pin. Pinning does not add revocation
checks or establish a DNS identity.

The native `go-sql-driver/mysql` connector uses no shell, DSN string or external
client. Each attempt opens one connection, starts `START TRANSACTION READ ONLY`,
executes fixed metadata queries, and rolls back. Dial/read/write timeouts are
5 seconds each; the entire attempt has a 12-second context budget (an earlier
caller deadline wins). No table contents, configurable SQL, writes, quota
changes, schema names, addresses, credentials, certificate pins, cipher names
or raw driver/server errors enter telemetry or logs. TLS status is checked using
that same session's `Ssl_cipher`; a missing/empty value fails the whole sample.

Size is the selected schema's visible non-view `DATA_LENGTH + INDEX_LENGTH`
sum from `information_schema.TABLES`. It is an **estimate**, often cached and
engine dependent, not billed storage or all server disk usage: it excludes
other schemas, logs, free space and shared server overhead. Require schema-wide
metadata visibility; restricted table privileges can silently undercount.
Unknown/NULL statistics, numeric overflow, permissions/query errors or invalid
input yield unknown metrics, never zero. A successfully observed empty schema
has zero size. No statistics refresh or `ANALYZE TABLE` is performed.

Connections count only visible `information_schema.PROCESSLIST` sessions whose
default schema is the selected database and whose username matches the
collector session's processlist username, including the collector connection.
This remains username-filtered with `PROCESS` privileges; it is not a total of
all users/clients, and accounts with the same username but different host parts
may share that scope. Broad `PROCESS` grants are unnecessary; the account needs
schema metadata visibility and access to its own processlist/session status.
Use a dedicated account with read-only grants; the transaction is an additional
guard, not a replacement for account permissions.

References (verified for this implementation):
[driver v1.10.1 configuration](https://github.com/go-sql-driver/mysql/blob/v1.10.1/dsn.go),
[driver TLS/timeouts](https://github.com/go-sql-driver/mysql#readme),
[MySQL table statistics](https://dev.mysql.com/doc/refman/8.4/en/information-schema-tables-table.html),
[MySQL processlist visibility](https://dev.mysql.com/doc/refman/8.4/en/information-schema-processlist-table.html),
[MariaDB read-only transactions](https://mariadb.com/docs/server/reference/sql-statements/transactions/start-transaction).

## Cloudflare Tunnels

Optional `tunnels` entries define a display `name`, configured `hostnames`, a
unique `metrics_port` and `expected_connections` (default 4). Give each local
cloudflared connector a fixed metrics listener, for example
`cloudflared tunnel --metrics 127.0.0.1:20241 run ...`. Bind it only to loopback:
metrics must never be published through the tunnel or another public route.
Automatic port selection can swap connectors after restarts; use explicit ports.

The collector reads `/metrics` and `/ready` on IPv4 loopback, with a two-second
timeout, bounded response size, no redirects, proxies or Cloudflare API login.
Only connection count, active edge location codes and cumulative request/error
counters are exported. Tunnel tokens, origin URLs, connection IDs and other
Prometheus labels are excluded. Hostnames are display labels from the private
configuration, not automatically discovered routes. Changing routing requires
updating these labels separately.

Network shows connector readiness and observed/expected connection counts;
Overview alerts on degraded, failed or unknown connectors. Fewer connections
than expected is degraded; readiness HTTP 503 is failure; unreachable or invalid
metrics are unknown rather than zero. Stale snapshots are labeled in the UI.
These checks cover configured local connectors, not all replicas/account tunnels,
and do not prove origin availability, DNS health or Access policy enforcement.
Counters are since connector start, not a historical error rate. A successful
readiness check does not clear historical request errors.

Reference: [Cloudflare tunnel metrics](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/monitor-tunnels/metrics/).

## Software updates

Optional `software` enables read-only APT and explicitly configured CLI checks.
`interval_seconds` defaults to 21600 (six hours), with a range of 3600 to 604800 seconds.
Up to 24 `tools` accept a unique `name` and `kind`, plus an absolute
`executable` for non-APT sources:

- `npm`: `package`, optional dist-tag `channel` (default `latest`).
- `github`: `repository` (`owner/repo`), latest non-prerelease GitHub release.
- `node`: latest stable release in the installed major from nodejs.org.
- `go`: latest stable patch in the installed major.minor from go.dev.
- `apt`: `package`, installed Debian version and local APT candidate; no executable needed.
- `manual`: installed version only, explicitly unknown release availability.

Each executable runs with `--version` (`go` uses `version`), without a shell.
Optional `version_command: "version"` selects that fixed subcommand instead.
APT tools query dpkg-query and apt-cache, comparing full Debian versions with
dpkg; they never run the package executable. Configured APT packages get a
permanent row and are omitted from the generic APT update rows to avoid duplicates.
APT candidates use local indexes; the global APT freshness warning still applies.
Choose trusted, root-owned executables. Commands and HTTP requests have time and
output bounds; at most four tools run concurrently. Only fixed public registry
hosts are queried, without credentials, proxies or redirects. No update command
is run. An available release is informational, not a compatibility assessment.
Missing binaries, unsupported version formats and failed/rate-limited sources
remain unknown. Checks cache by configuration fingerprint and expire independently
of minute-by-minute telemetry. New installations invalidate the cache at the next
scheduled check. The Software page marks stale results and provides search and
an updates filter; Overview links to update/source warnings.

Software rows may include an optional `source_url`. npm and GitHub URLs use the
configured package/repository, independently of the display name; Node.js and
Go link to their official download pages. APT links use the exact available
version's local repository and Release metadata: Ubuntu/Debian packages link to
an exact-name search in the distribution's package catalog (across suites), and
known Tailscale/Cloudflare repositories link to their public package sites.
This identifies an available source, not the historical origin of an installed
package. Unknown, ambiguous or unavailable APT origins have no link. Only fixed
public destinations are emitted; arbitrary repository URLs, credentials and
private paths are never copied. Link lookup failure does not change update status.
Older snapshots without links remain valid; upgrading to 5.1 refreshes the
software cache at the next collection without resetting history.

`apt: true` lists all installed packages reported by local `apt list --upgradable`,
preserving Debian epochs/revisions. It neither refreshes indexes nor installs
packages. Refresh indexes separately with your normal maintenance process.
The local security index publication date is shown; missing indexes or a date
older than 48 hours make APT status unknown while retaining reported candidates.
Held/phased packages may be listed; availability does not promise an upgrade.
Distribution-managed tools should normally use APT, since upstream version
numbers do not account for distribution security backports. CLI executable paths
and package/repository configuration are not exported in telemetry.


## Backup storage measurements

`backup_stores` optionally reads small JSON status files produced by a separate
backup checker. Configure a label, absolute `status_file`, and
`max_age_seconds` (60–604800). The collector only reads these files; it does not
receive SSH keys, connect to remote stores, create backups, or delete archives.
The checker defines the scope of its own measurements; the collector does not
verify backup integrity or test restoration. The source may contain `status`, `checked_at` (RFC 3339), `bytes`, `limit_bytes`,
`backup_count`, `last_success_at`, and `latest_backup_bytes`. Use `status: unknown`
when a remote check fails. Capacity is recomputed at 80%/95% thresholds.
Missing, invalid, stale, future-dated or oversized measurements become unknown;
unavailable capacity is never reported as zero. Extra fields and raw source
errors are omitted from the published snapshot. The UI independently expires
old measurements and shows alerts in Overview and capacity in Storage.
Monitor the actual backup service/timer separately under `jobs` with category
`backup` to detect failed runs and overdue copies.

## Upgrading to 4.6.1

The agent task board integration has been removed. Existing configuration files
remain loadable; remove the unused `agent_queue` option when convenient. The
collector no longer reads its source or queries GitHub Projects, and its next
sample drops the old queue snapshot/cache while retaining resource history and
CPU peak metadata. GitHub Actions jobs and software release checks are unchanged.
MySQL/MariaDB and PostgreSQL monitoring remain supported.
