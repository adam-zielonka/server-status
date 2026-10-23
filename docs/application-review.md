# Application review — 2026-10-23

Scope: all seven dashboard views, authentication and session handling, shared
fetching and navigation, the Go API, optional Linux collection, build and tests.
Browser checks use synthetic monitoring data. Private production configuration
and monitoring snapshots are not part of this report.

## Product structure

The seven views serve distinct diagnostic questions and remain in place:

- **Overview:** current pressure and the most important problems. Compact service
  and task tables provide entry points to details. The mobile resource summary
  uses two columns, and recent tasks are limited to the five latest attempts.
- **Services:** systemd state and port connectivity answer different questions.
  Keep both, make open/closed results explicit in text, and sort services needing
  attention first. Search includes name, unit, scope and state; a health filter
  narrows the table to problems.
- **Processes:** retain service/instance grouping, CPU/memory rankings, expansion
  and full-list search. Page rankings in sets of 50 so large hosts do not render
  every row on each update. All recorded entries remain accessible.
- **Storage:** keep filesystems, database capacity and directory growth together.
  Report space available to ordinary processes, excluding reserved disk blocks.
  Treat future observations and an empty filtered mount list correctly.
- **Network:** keep interfaces, local connector readiness, Tailscale exposure and
  optional virtual hosts together. Color is accompanied by readable status;
  failed HTTP probes read “Not reachable.” Local Caddy and external checks have
  distinct destinations and documented semantics.
- **System:** retain relatively stable OS/allocation details and live memory/load
  breakdowns here, separate from the process investigation view.
- **Tasks & backups:** add full-list search and a health filter; show stopped
  schedulers next to task status, including when the last execution succeeded.
  Keep the existing distinction between a successful backup job and a verified
  restore.

## Reliability and interaction changes

- Prioritized, expandable issues link to the relevant view; the desktop sidebar
  counts issues per destination. Active basic-source failures also affect the
  overall health indicator. Long lists initially show four issues.
- Browser Back/Forward restore views. Modified link clicks retain normal browser
  behavior. Skip-to-content links preserve the active view. Navigation updates
  the document title and moves keyboard focus to the page heading. The mobile
  navigation scrolls the active link into view.
- Shared collector cards distinguish loading, disabled/unconfigured sources and
  request errors. Basic API information remains available during collector
  failures. Cached readings remain visible with the global refresh error.
- Snapshot publication and resource sample freshness are checked separately.
  Old CPU readings are not presented as current; memory and disk can fall back
  to basic API readings. Stale service, database, task, tunnel and Tailscale
  statuses are labeled, with the last reported state available on hover.
- History is ordered chronologically, retains gaps, and reports observations and
  elapsed span within the selected range. Time since the last reading does not
  increase the reported recording span. Future observations cannot become the
  current sample beyond the existing one-minute clock tolerance.
- Every API response is checked before rendering, including nested telemetry
  rows and optional integrations. Malformed sources become recoverable errors.
  A render or dynamic-import failure has a reload action.
- The 15-second browser request timeout remains active when TanStack Query or
  session validation supplies an abort signal. Cancellation still propagates.
- The dashboard loads after authentication; chart code remains a separate chunk.
  The first visit to the sign-in page does not download the dashboard code.
  Theme selection defaults to the system preference when no preference is saved.

## Backend changes

- Port checks use up to 16 workers, two-second connection timeouts, an eight-second
  request budget and the HTTP cancellation context. An incomplete batch reports
  an error rather than returning untested ports as closed.
- Virtual-host checks use up to eight workers, two-second HTTP timeouts and an
  eight-second budget. Configuration and external response bodies are bounded.
  Hosts are deduplicated, sorted and discovered across all TCP listeners and
  nested Caddy routes. A failed or unstarted probe uses the existing `0` status.
- Local probes dial IPv4 loopback at the configured listener port and retain the
  virtual host in HTTP Host/TLS SNI. They return the first response, including
  redirects. Local TLS accepts local certificates only on this loopback-only
  transport; the external checker verifies TLS certificates normally.
- Network interface addresses are collected once and indexed, replacing one
  interface enumeration for every traffic counter.
- Missing CPU information returns a source error instead of indexing an empty
  list. Filesystem responses add `available`; older API builds retain the UI's
  previous fallback. New collector disk percentages use used plus available
  space, matching the basic API's reserved-block semantics.
- Authentication limiting keys by the direct peer IP, excluding ephemeral source
  ports. Untrusted forwarding headers cannot change the bucket. A reverse proxy
  consequently shares a bucket for clients using the same direct peer address.

## Architecture decisions

The standalone Go executable, embedded React app, shared query cache, optional
read-only collector and bounded 24-hour history fit the current single-server
monitor. Keep this structure. The work improves the existing implementation and
introduces no additional runtime dependency or external service.

Database capacity belongs in Storage and connector readiness belongs in Network.
A separate page would be useful only after those integrations acquire additional
workflows. Process expansion and complete rankings remain useful; pagination
controls rendering cost without dropping observations. Production controls such
as restart, kill and restore remain outside the read-only dashboard's purpose.

## Verification

- Frontend: TypeScript, ESLint, Prettier and 78 passing tests. Coverage for the
  configured library/auth/hooks scope: 95.8% statements and 96.97% lines.
- Go: all package tests pass with the race detector; `go vet ./...` passes.
- The standalone build succeeds. Moving dashboard code behind authentication
  reduces the initial JavaScript chunk from approximately 416 kB to 326 kB
  (gzip: 130.28 kB to 104.76 kB, about 20% less). This measures the entry chunk,
  not the total JavaScript downloaded after signing in.
- The built binary was started on an isolated loopback listener with temporary
  test credentials. Its collector ran against temporary paths. Eight native
  endpoint responses, including the generated collector snapshot, passed the
  frontend validators. JWT access, unauthorized requests, port connectivity,
  embedded assets, immutable asset caching and unknown API paths were checked.
- Browser checks cover all seven views at phone width and the built app at
  desktop width: sign-in, lazy chunks, issue links, service/task filters, database
  capacity, Back/Forward, keyboard focus, dark mode and sign-out. Synthetic issue
  fixtures cover a failed service, a stopped scheduler and database pressure.
  No uncaught browser exceptions occurred during the built-app checks.
- Host-derived samples used by the isolated collector smoke test were held only
  in a temporary directory outside the checkout. Test listeners and temporary
  configurations are removed after verification.

The reviewed changes are included in version 4.1.0. Production deployment
state is tracked separately in the operator's private documentation.
