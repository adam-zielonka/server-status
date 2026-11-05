# Application consistency, documentation and reuse audit — 2026-11-05

Reviewed version: **4.6.1**, commit `d6b18f5`.

Scope: application source, API/frontend contracts, public documentation,
configuration examples, build workflow and portability to an independent Linux
installation. This is an audit, not an implementation or deployment. Findings
below describe the reviewed revision; none is marked fixed by this report.

## Assessment

The single Go executable, embedded frontend, external configuration and optional
collector provide a useful foundation for reuse. Shared React components, query
handling and synthetic fixtures already reduce duplication. The application does
not need a framework rewrite to address the findings.

The main weaknesses are authentication lifecycle and validation, disagreement
between data contracts and displayed claims, and incomplete installation guidance.
Passing tests do not cover all of these conditions. Reuse on another host needs
explicit documentation of executable paths, account permissions and browser/API
deployment topology.

## Confirmed findings

### 1. P1 — Empty credentials pass configuration validation and authentication

Evidence: `api/config/config.go:70`, `api/config/config.go:99`.

The loader checks the listening port, a nonempty signing secret and a nonempty
users array, but does not validate individual users. An entry `{}` therefore
creates an account with an empty name and password. A synthetic configuration
with this entry loaded successfully, and the real authentication handler returned
HTTP 200 for empty Basic credentials in an in-memory HTTP test.

Impact: a configuration mistake can permit authentication with empty credentials.
This does not demonstrate that any deployed configuration has that mistake.

Remedy: reject empty usernames/passwords, duplicate usernames and usernames that
cannot be represented by the Basic-auth format. Add configuration and handler
regression tests. Check signing-secret policy and accidental example values as
part of the same configuration review.

### 2. P1 — Issued JWTs never expire and survive password changes

Evidence: `api/auth/auth.go:195`, `api/auth/auth.go:223`,
`app/src/features/auth/auth-context.tsx:33`, `app/src/lib/session.ts:3`.

Tokens contain a username but no expiration. Validation checks the signature and
whether that username still exists. A synthetic test obtained a token through
the real handler, reinitialized configuration with a different password and
confirmed that the original token was still accepted. Logout clears browser
state, not the validity of an already copied token.

Impact: an acquired token remains usable while its signing key and username are
valid. The frontend's expired-session message handles HTTP 401, but the current
issuer does not implement time-based expiry.

Remedy: define and document a session lifetime, issue and require expiration,
and define a revocation strategy for password changes. Cover expiry, key rotation,
user removal and password changes with backend tests. Document that local logout
alone does not revoke a bearer token.

### 3. P2 — Runtime validation does not fully protect the dashboard

Evidence: `app/src/lib/validation.ts:120`, `app/src/lib/monitoring.ts:30`,
`api/mods/telemetry.go:37`, `app/src/features/dashboard/storage.tsx:23`.

A synthetic snapshot with a successful job and
`last_success_at: {"toString": 0}` passes `validEndpoint('telemetry', ...)`.
Calling `monitoringIssues` then throws `TypeError: Cannot convert object to
primitive value`. This was reproduced using the actual TypeScript functions.
The API only validates the snapshot envelope, so it does not reject this field.

There is also inconsistent null handling: the frontend validator accepts
`bytes: null` for a database, while its local formatter treats only `undefined`
as unavailable and converts `null` to `0 MB`.

Impact: malformed or independently produced telemetry can cause a render failure
or misleading values instead of a recoverable source error. This is not evidence
that the bundled collector currently emits the malformed timestamp.

Remedy: validate every consumed timestamp and align nullability across types,
validators and formatters. Add synthetic negative contract tests at the network
boundary, including these cases.

### 4. P2 — Backup size is presented as proof of verification

Evidence: `app/src/features/dashboard/backup-stores.tsx:76`,
`api/collector/backup_stores.go:66`, `collector/README.md:338`, `README.md:46`.

The UI prints “verified after download” whenever `latest_backup_bytes` is present.
The collector merely accepts a nonnegative size from the external status file;
the documented contract does not require a verification result for that field.

Impact: an independent checker reporting only archive size gets a stronger claim
in the dashboard than its data establishes. This does not assess the behavior of
the existing private backup checker.

Remedy: use a neutral size label, or define a separate verification result,
verification time and method with explicit producer obligations. Keep backup-job
success, storage availability, integrity verification and restore testing distinct.

### 5. P2 — Installation instructions conflict with API account permissions

Evidence: `collector/README.md:42`, `api/README.md:52`.

The collector guide creates a separate API account and `/etc/server-status`
with mode `0700`. The API examples place its config under that directory.
If the directory is created by root, an API running as `server-status` cannot
traverse it to read its configuration. The guide does not resolve this conflict.

Remedy: document exact ownership and permissions for both configurations, using
separate private locations or a traversable parent with appropriately restricted
files. Add an API service example showing its user, group and config path, and a
configuration-read check performed as that account. Preserve the collector's
private state and credentials.

### 6. P2 — Source availability and freshness are inconsistent across views

Evidence: `app/src/features/dashboard/dashboard.tsx:50`,
`app/src/features/dashboard/overview.tsx:98`,
`app/src/features/dashboard/services.tsx:107`,
`app/src/features/dashboard/network.tsx:153` and `:215`.

After the first telemetry request fails without cached data, Overview shows
“Not enabled”; the Services header can show a green “0 active”. A global error
is also displayed, so this is contradictory presentation rather than a completely
hidden failure. Both disabled telemetry and unavailable telemetry become an
undefined snapshot at these call sites.

For an old snapshot, the Tailscale connection badge receives `stale`, but the
shared-route exposure badge does not. Its “tailnet” or “public” label therefore
looks current while the adjacent connection is explicitly stale.

Remedy: reuse one source-state model for card bodies, metric cards and headers,
and apply freshness consistently to exposure information. Test disabled,
initial-error, cached-error and stale states separately.

### 7. P2 — Collector integration paths and GitHub identity are not portable

Evidence: `api/collector/sources_linux.go:203`, `:204`, `:304`, `:317`;
`collector/README.md:25` and `:36`.

The collector uses fixed paths such as `/usr/bin/gh`, `/usr/bin/psql` and
`/usr/bin/tailscale`. Installing these tools elsewhere does not satisfy those
calls. It also forces `GH_CONFIG_DIR=/root/.config/gh`, despite documentation
describing the collector user's existing login. An alternative config directory
or a different invoking user is not honored for this integration.

Remedy: either document these exact supported paths and identity assumptions,
or allow trusted absolute executable paths and an explicit private GitHub
configuration directory. Avoid replacing these restrictions with an unrestricted
root PATH lookup. Add diagnostic checks that report missing prerequisites without
printing credentials.

### 8. P2 — Separate frontend hosting needs an explicit browser/API topology

Evidence: `app/README.md:39` and `:49`, `api/README.md:69`,
`app/src/lib/api.ts:26`, `api/server.go:10`.

The docs support static hosting and a configurable API URL but do not explain
that the Go API has no CORS handling. Requests carrying `Authorization` to a
different browser origin require a preflight; the GET-only route rejects OPTIONS
and does not supply CORS headers.

Impact: setting `VITE_API_URL` to a directly accessed API on another origin is
insufficient. The documented same-origin embedded mode and Vite proxy are not
affected.

Remedy: document the supported same-origin reverse-proxy layout for a separately
hosted frontend. If direct cross-origin use is intended, implement and test a
restricted origin policy. This finding follows from the request and route code;
no browser or deployed proxy was exercised during this audit.

### 9. P2 — Root disk discovery excludes overlayfs

Evidence: `api/mods/fs.go:18`, `app/src/features/dashboard/storage.tsx:29`,
`api/collector/collect_linux.go:83`.

The API calls `disk.Partitions(false)`. Inspection of the pinned gopsutil
v4.26.10 implementation confirms that its Linux partition filter excludes
`nodev` filesystems such as overlayfs. Storage then looks for an exact `/` mount.
On a system with an overlay root, root capacity can therefore be unavailable even
though the collector reads `/` directly with `Statfs`.

Remedy: explicitly include a valid root usage measurement while retaining useful
filters for other mounts, or clearly document the unsupported topology. Add an
overlay-root fixture for partition selection. The conditional behavior was
verified in source, not by deploying a new container.

## Documentation and reuse improvements

- Keep the current architecture. Prioritize a shared, tested telemetry contract
  and shared source-state handling over a broad refactor. Go's dynamic row maps,
  handwritten TypeScript interfaces and runtime validation currently evolve
  independently.
- Provide a minimal configuration and a complete fresh-host API installation
  example before the catalog of optional integrations. The collector example
  currently enables several integrations that need operator customization.
- Mark the main README's historical review link as historical at the entry
  point. The review already identifies itself as version 4.1.0 at its end.
- Clarify that the removals prepared as 4.6.0 shipped in 4.6.1: the changelog says
  this, but the API and collector migration text still points to 4.6.0.
- Correct the collector guide's statement that disabled operations monitoring is
  hidden: the frontend retains navigation and presents disabled/empty states.
- Document the API response envelope and stable telemetry contract for external
  producers/clients. Add cross-language fixture checks to CI.
- Treat configurable project/release links as an optional fork improvement;
  `app/src/components/app-version.tsx:4` intentionally points to upstream today.

## Verification and limits

Completed successfully on the existing checkout:

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`.
- `pnpm test`: **95 tests in 11 files**.
- `go test -race -count=1 ./...` and `go vet ./...`.
- `./build.sh`, executable version output and configuration checks for both
  tracked example configs.
- Isolated synthetic authentication and malformed-telemetry probes described
  above. Temporary probe files were removed; no real credentials or snapshots
  were used.

The local build used Node.js 24.22.2, pnpm 12.16.1 and Go 1.27.3. This does not
establish compatibility with every supported toolchain or a clean host. Browser
E2E tests, a new-host installation and a current dependency vulnerability audit
were not run. No production services, private configurations or deployed assets
were changed. Build output was regenerated locally in ignored directories.

Suggested order: fix authentication validation and session lifetime; resolve
contract/verification claims; make installation reproducible; unify source states
and address the documented portability cases. Add targeted regression tests with
each fix rather than treating the currently passing suite as coverage of these
findings.
