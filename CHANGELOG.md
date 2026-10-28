# Changelog

## 4.3.0 — 2026-10-28

- Keep mobile navigation visible together with the header when switching views
  or scrolling, and return each new view to the top without hiding its menu.
- Show the build version with release notes in the dashboard footer and login page.
- Validate optional backup storage payloads before rendering, so malformed
  measurements produce a recoverable source error instead of breaking the dashboard.
- Add optional backup storage capacity, retained-copy and verification monitoring.
- Allow CPU capacity calibration for hidden host limits, show the configured
  scale and keep retained CPU history consistent when capacity changes.

## 4.2.0 — 2026-10-26

- Add a Software page with installed/available CLI versions, APT update
  candidates, filters and independent freshness warnings.
- Check configured npm/GitHub releases and the installed Node.js/Go series
  on a bounded, read-only schedule. Failed checks remain unknown; package
  updates are never installed automatically.

## 4.1.0 — 2026-10-23

- Prioritize monitoring issues and link them to diagnostic views; add service
  and task health filters, complete-list search and process pagination.
- Restore browser navigation and keyboard focus, improve mobile layouts and
  load the dashboard after authentication.
- Distinguish stale samples, source errors and disabled monitoring; validate
  API payloads, preserve request timeouts and provide a reload recovery view.
- Correct available disk space and align collector utilization with the API.
- Bound and cancel port/virtual-host checks; probe Caddy locally with the
  correct listener, Host and SNI, and validate external TLS and response bodies.
- Read interface addresses once and fix authentication limiting by peer IP.

## 4.0.1 — 2026-10-22

- Remove the obsolete Python collector, startup script and legacy packaging.
- Simplify the CLI and configuration to the documented explicit commands and
  JSON configuration files.
- Remove legacy session conversion and telemetry compatibility paths; use the
  current process-group data format throughout the dashboard.
- Refresh public configuration examples, documentation and CI artifacts for
  the standalone application.

## 4.0.0 — 2026-10-22

- Distribute the dashboard, REST API and optional Linux collector in one Go
  executable, with the production React frontend embedded using `go:embed`.
- Modernize the dashboard with TypeScript, shadcn/ui and responsive navigation,
  including service health, history, storage, network and scheduled tasks.
- Add `serve`, `collect`, `config check`, `config check --collector`, `version`
  and command help. Support listener overrides and API-only serving.
- Collect Linux telemetry in Go with snapshots, history, advisory locking and
  separate collector permissions.
- Group processes by systemd service or application instance, including browser
  instances. Show complete rankings, expandable members, parent/service details,
  filtering and CPU/memory sorting without a top-N limit.
- Add local Cloudflare Tunnel readiness, connection and request/error metrics.
- Add optional PostgreSQL capacity and health monitoring with read-only queries.
- Keep the synthetic public demo separate from the embedded production build.
- Add repeatable builds, version metadata and tests for CLI/static serving,
  process grouping, failure handling and privacy.
