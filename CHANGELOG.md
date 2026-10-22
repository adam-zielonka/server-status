# Changelog

## 4.0.0 — 2026-10-22

- Distribute the dashboard, REST API and optional Linux collector in one Go
  executable, with the production React frontend embedded using `go:embed`.
- Modernize the dashboard with TypeScript, shadcn/ui and responsive navigation,
  including service health, history, storage, network and scheduled tasks.
- Add `serve`, `collect`, `config check`, `config check --collector`, `version`
  and command help. Support listener overrides and API-only serving.
- Move telemetry collection from Python to Go while preserving version-1
  snapshots, history, advisory locking and the separate collector permissions.
- Group processes by systemd service or application instance, including browser
  instances. Show complete rankings, expandable members, parent/service details,
  filtering and CPU/memory sorting without a top-N limit.
- Add local Cloudflare Tunnel readiness, connection and request/error metrics.
- Add optional PostgreSQL capacity and health monitoring with read-only queries.
- Keep the synthetic public demo separate from the embedded production build.
- Add repeatable builds, version metadata, migration instructions and Go tests
  for CLI/static serving, collector compatibility, failure handling and privacy.

### Upgrade notes

- Forward all paths of an HTTPS reverse proxy to the Go listener to use the
  embedded frontend. The separate static directory is optional.
- Run the collector timer with `server-status collect --config /path/to/collector.json`.
  Python is no longer required. Optional integrations still require their system
  tools, including `systemctl`, GNU `du`, `tailscale`, `gh` or `psql` as configured.
- Keep private configuration, credentials and telemetry outside the checkout and
  executable. The HTTP service and collector remain separate processes with
  different permissions.
- Existing launches with `-config` or `--config` still start the server. Existing
  API authentication, collector configuration, snapshots and history remain
  compatible. See [the collector guide](collector/README.md) for migration.
