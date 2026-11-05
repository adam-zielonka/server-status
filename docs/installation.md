# Installing Server Status 5.0

This Linux installation uses the downloaded executable for both the embedded
frontend/API and the optional collector. It requires systemd with `LoadCredential`
support; collector metrics also require cgroup v2. Run the following as root on
the target host. Obtain the matching Linux amd64 or arm64 binary and SHA256SUMS
from the [release](https://github.com/adam-zielonka/server-status/releases),
verify the downloaded binary against that release's checksum, and substitute its
local filename below. Obtain the example configs and units from the same release
source tree.

```sh
sha256sum -c SHA256SUMS --ignore-missing
systemctl --version
getent group server-status >/dev/null || groupadd --system server-status
id server-status >/dev/null 2>&1 || useradd --system --gid server-status --no-create-home --shell /usr/sbin/nologin server-status
install -d -o root -g root -m 0755 /opt/server-status
install -o root -g root -m 0755 ./server-status-linux-amd64 /opt/server-status/server-status
install -d -o root -g root -m 0700 /etc/server-status
install -o root -g root -m 0600 api/config.example.json /etc/server-status/config.json
install -o root -g root -m 0600 collector/config.minimal.json /etc/server-status/collector.json
install -d -o root -g server-status -m 2750 /var/lib/server-status
install -o root -g root -m 0644 deploy/server-status.service /etc/systemd/system/
install -o root -g root -m 0644 collector/server-status-collector.service collector/server-status-collector.timer /etc/systemd/system/
```

Check that `sha256sum` actually checked the intended binary, and use the filename
for your architecture. Edit the private API config before starting: replace the
example username and password with unique, nonempty credentials; use a unique,
random signing secret in place of the placeholder. For example, generate one
with `openssl rand -hex 32` in a private session and put it directly in the JSON
without recording or sharing it. Do not echo secrets or pass them as command
arguments. Set `telemetry_file` to `/var/lib/server-status/telemetry.json` when
using the collector. Keep the listener on loopback behind an HTTPS proxy.
Review both configurations and set up any optional sources before enabling their
units; the minimal collector configuration needs no optional sources and records
core samples. The longer [collector example](../collector/config.example.json)
is a catalog, not a ready-to-run configuration.

Validate the collector and validate the API as its actual service account using
the same systemd credential delivery as the service. The transient service reads
the root-only source file through systemd, not through directory traversal by
the API account:

```sh
/opt/server-status/server-status config check --collector --config /etc/server-status/collector.json
systemd-run --wait --pipe --collect --property=User=server-status --property=Group=server-status --property=LoadCredential=config.json:/etc/server-status/config.json /bin/sh -c 'exec /opt/server-status/server-status config check --config "$CREDENTIALS_DIRECTORY/config.json"'
systemctl daemon-reload
systemctl start server-status-collector.service
systemctl enable --now server-status-collector.timer
systemctl enable --now server-status.service
systemctl status server-status.service server-status-collector.timer
journalctl -u server-status-collector.service -n 20 --no-pager
```

The collector service creates private `/var/lib/server-status-collector` state;
its state/history is 0600. The snapshot directory is root-owned, setgid
`server-status` and 2750; snapshots are 0640. Only the API group can read the
snapshot, while the API cannot traverse `/etc/server-status` or read collector
state. Root must own and control installed executables and configuration.
Systemd supplies a private API config copy through `LoadCredential`. After a
configuration change, validate and restart the API; restart the collector timer
or run a sample as appropriate. The API reads host `/proc` metrics and the
snapshot; the supplied service does not hide `/proc` or grant write access to
the snapshot. Local process visibility still depends on host `/proc` permissions.

Configure an HTTPS reverse proxy to forward all paths to the loopback listener.
For separately hosted static assets, serve them and proxy `/api/` under the same
browser origin. `VITE_API_URL` alone does not enable cross-origin requests; the
API does not provide CORS. See [API contract](api-contract.md),
[collector guide](../collector/README.md), and [migration](migration-5.0.md).
