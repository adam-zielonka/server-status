# Changelog

## 5.1.1 — 2026-11-05

- Retain observed systemd task outcomes, attempt/completion dates and errors when
  systemd forgets execution timestamps after a restart or unit unloading. Keep
  interrupted attempts unknown and continue refreshing timer state and schedules.
- Preserve observed failures across `reset-failed` and report failures that occur
  before the main process starts without inventing a successful completion.

## 5.1.0 — 2026-11-05

- Link Software names to their configured npm package or GitHub repository,
  with official download pages for Node.js and Go. Links remain available when
  version checks fail and open in a new tab.
- Resolve APT links from the exact available version's repository metadata,
  including Ubuntu/Debian mirrors and known Tailscale/Cloudflare repositories.
  Unknown or ambiguous origins remain unlinked; private repository URLs are
  never copied into telemetry. APT links describe the available package source,
  not proof of the installed package's historical origin.
- Keep older snapshots compatible through optional source URLs and refresh the
  software cache once after upgrading. Version checks and history are unchanged.

## 5.0.0 — 2026-11-05

- Require a new sign-in after upgrading: JWT sessions expire after 12 hours by
  default and become invalid when the user's password or signing key changes.
  Reject empty or ambiguous accounts and invalid API configuration before startup.
- Validate consumed telemetry fields and nullable measurements consistently.
  Malformed timestamps become source errors; unavailable database sizes remain
  unavailable. Distinguish failed, disabled and stale monitoring throughout the UI,
  including service summaries and Tailscale route exposure.
- Describe backup sizes without claiming an integrity check or restore test that
  the source data does not establish.
- Support trusted absolute collector command overrides and an optional GitHub CLI
  configuration directory. Omitted GitHub configuration uses the invoking account
  and environment. Include root filesystem metrics when `/` is overlayfs.
- Add complete installation, API contract and migration guides, a minimal
  collector configuration and an unprivileged API systemd service using
  credential delivery. Document same-origin proxy requirements for static hosting.
- Add regression and synthetic Go/frontend contract checks and a repeatable
  native release smoke test with history compatibility checks. Update the
  development minimatch dependency to address GHSA-g3hv-75wg-m249.

The existing API paths and response envelope remain supported. Telemetry schema 1,
retained history and CPU peak metadata need no conversion. See the
[5.0 migration guide](docs/migration-5.0.md) before upgrading.

## 4.6.1 — 2026-11-05

- Include the retired Agent tasks/GitHub Projects and Caddy/Virtual hosts
  removals prepared for 4.6.0, retaining MySQL/MariaDB and PostgreSQL monitoring.
- Make the existing Software inventory extension generally available: permanent
  APT package rows with full Debian versions, update-row deduplication and a
  fixed `version_command: "version"` option for compatible CLIs.
- Integrate the merged Dependabot updates: gopsutil 4.26.10, purego 0.11.2,
  React Query 5.105.0, Lucide 1.66.0, Node types 26.6.6, ESLint 10.14.0 and
  typescript-eslint 8.72.1.


## 4.6.0 — unreleased preparation, 2026-11-05

- Remove Agent tasks cards and the GitHub Projects queue collector, including
  its configuration, cache, data contracts and synthetic fixtures. GitHub Actions
  job monitoring and software release checks remain available.
- Remove Caddy/Virtual hosts monitoring, the `/api/vhosts` endpoint, external
  status checker configuration and the frontend visibility build option.
- Preserve MySQL/MariaDB and PostgreSQL monitoring, scheduled jobs, backups,
  resource history and CPU peak metadata. Older configuration files remain
  loadable; removed options are ignored and no longer trigger collection.

## 4.5.0 — 2026-11-02

- Add optional MySQL/MariaDB database monitoring alongside PostgreSQL: estimated
  schema data/index usage, configured capacity, visible user connections, TLS
  status and response time in the existing Storage view.
- Require verified TLS using a CA and server name or an explicit self-signed
  certificate pin. Keep credentials in private files and expose only allowlisted
  metrics; failed measurements remain unavailable rather than reporting zero.
- Bound read-only metadata collection and transaction cleanup by one deadline.
  Preserve existing PostgreSQL configuration and snapshot compatibility.

## 4.4.0 — 2026-10-31

- Add optional read-only GitHub Project issue counts through the existing collector.
  Validate status IDs, paginate and deduplicate, retain complete results on errors,
  and expire the source independently of other telemetry.
- Show Agent tasks in Overview and Tasks with disjoint groups, exact status
  details, timestamps and a safe board link. Missing data remains unavailable;
  public demo data and screenshots are synthetic.

## 4.3.3 — 2026-10-29

- Distinguish CPU, memory and disk history with line patterns and symbols in the
  chart, legend and tooltip. Isolate a series when curves overlap, and inspect
  recorded values in a collapsible, paginated sample table with explicit gaps.
- Improve history axis and storage error text contrast in light and dark themes.
- Report an empty service monitoring configuration without claiming all services
  are healthy. Keep stale monitoring warnings and CPU calculations unchanged.

## 4.3.2 — 2026-10-29

- Keep the CPU card compact with a short relative-scale label. Show its full
  reference in an information panel available by hover, keyboard focus or tap,
  with Escape and outside-click dismissal. CPU calculations are unchanged.

## 4.3.1 — 2026-10-29

- Scale CPU capacity and CPU history against the highest observed use, with a
  durable reference, observation start date, and explicit unavailable states.
  Keep allocation-based CPU readings for resource alerts and per-process metrics.
- Update the Go module inspection dependency (`golang.org/x/mod` to 0.42.0).

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
