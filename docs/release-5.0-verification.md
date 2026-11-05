# 5.0.0 audit resolution and verification

This release implements the [release plan](release-5.0-plan.md). The original
[audit](consistency-audit-2026-11-05.md) remains a historical record of 4.6.1.

## Resolution

1. **Empty credentials:** startup validates individual accounts, uniqueness and
   Basic-auth-compatible identities; the authentication path rejects empty
   passwords. Configuration rejects unknown, duplicate and ambiguous fields.
2. **Permanent JWTs:** typed, expiring sessions use per-account signing keys.
   Password/key changes and user removal invalidate existing sessions after
   restart. Legacy JWTs are rejected. Stateless restoration and lifetime policy
   are documented and regression-tested.
3. **Telemetry boundary:** consumed timestamps and nullable values are checked;
   malformed job dates fail validation and null database sizes remain unavailable.
   Go-produced synthetic fixtures are checked by the frontend validator in CI.
4. **Backup claims:** copy size no longer implies download verification or a
   restore test; UI and public docs use neutral descriptions.
5. **Installation permissions:** the complete guide and API unit use systemd
   credentials for root-only configuration and a separate snapshot-reading group.
6. **Source states:** service summaries share availability/freshness handling;
   route exposure badges mark stale observations.
7. **Collector portability:** trusted command overrides and optional GitHub config
   directory are supported. Normal invoking-account defaults are preserved.
   Explicit Software executable paths remain independent of these overrides.
8. **Static hosting:** same-origin proxy requirements are explicit; a configured
   URL does not promise built-in CORS support.
9. **Overlay root:** root usage is retained when the physical-partition filter
   omits overlayfs, without including other pseudo mounts or duplicating `/`.

Historical documentation links, the 4.6.1 retirement notes, disabled-state
descriptions, minimal configuration and API envelope documentation were also
updated. Existing API paths and telemetry schema 1 remain supported.

## Verification

- Frontend: typecheck, lint, formatting and **189 tests** pass. Coverage for the
  configured library/auth/hooks scope is 96.32% statements and 97.8% lines;
  this is not coverage of every dashboard component.
- Go: package tests pass with the race detector; vet passes. Focused regression
  tests also cover stateless credential restoration and session lifetime policy.
- Chromium: all 28 scenarios complete across phone, small-phone, landscape and
  desktop. One phone chart-keyboard scenario hit its 15-second focus timeout on
  the first attempt and passed the configured retry; two isolated repetitions
  then passed with retries disabled. No assertions or timeouts were relaxed.
- Synthetic Go/frontend contract checks pass for available and unavailable
  source fixtures. The validator emits only PASS/FAIL for private inputs.
- Native smoke checks pass for embedded assets, authenticated endpoints, session
  expiry metadata, unauthorized denial and graceful shutdown.
- Candidate/previous/candidate collector runs retain the seeded history point
  and CPU peak metadata. Temporary host-derived samples are deleted afterwards.
- A transient unprivileged systemd process successfully validates a synthetic
  API configuration delivered through `LoadCredential`.
- Dependency audit reports no known vulnerabilities after the development-only
  minimatch override for GHSA-g3hv-75wg-m249.
- Independent source review found no release-blocking issue. Stateless revocation
  limits are explicit in the migration guide.

The native checks used Linux amd64, Node 24 and Go 1.27. This is not a fresh-host
test on every distribution. The arm64 artifact is cross-compiled, not executed
on this amd64 host. Production deployment evidence belongs in the operator's
private documentation; it is separate from these source/release checks.
