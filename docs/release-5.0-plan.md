# Server Status 5.0.0 release plan

Scope: resolve the [2026-11-05 audit](consistency-audit-2026-11-05.md), publish
Linux amd64/arm64 binaries with checksums, and verify an authorized deployment.

## Implementation

1. Validate API users and configuration; issue bounded JWT sessions and revoke
   tokens when credentials change. Reject legacy nonexpiring tokens. Preserve
   the existing endpoint paths and response envelope unless a concrete benefit
   requires changing them. Document the required sign-in after upgrade.
2. Align runtime telemetry validation, nullable values and display semantics.
   Cover malformed timestamps, disabled/error/stale source states and backup
   measurements that do not establish verification.
3. Support configured trusted collector tool paths and the invoking account's
   GitHub config; include root disk measurements on overlayfs. Preserve telemetry
   schema 1 and resource history/CPU peak compatibility.
4. Provide minimal examples, an unprivileged API service with systemd credentials,
   complete installation/migration instructions, API/telemetry contract guidance
   and supported same-origin proxy topology. Update historical references.
5. Add focused regression and cross-language contract checks. Keep optional
   integrations optional; do not introduce remote service-control endpoints.

## Release gates

- Integrate isolated changes sequentially; inspect the combined diff.
- Pass TypeScript, lint, formatting, frontend coverage, Go race tests/vet and
  Chromium E2E tests. Check dependency audit and clean source builds.
- Validate existing private configurations and telemetry without exposing their
  contents. Smoke-test the candidate with synthetic credentials, authentication,
  embedded assets and collector data outside the checkout. Verify forward,
  repeated and reverse collector compatibility with the previous executable.
- Update VERSION, changelog, migration notes and audit resolution evidence.
- Build Linux amd64/arm64 from the clean release commit, verify VCS metadata,
  generate SHA256SUMS, upload a draft and verify downloaded bytes before
  publication. Verify the release commit's CI and public demo.
- Preserve a private rollback executable and deployment manifest, pause the
  collector, atomically install the exact release asset, verify API readiness
  and authenticated requests, collect through systemd, and check retained
  history, CPU metadata, permissions, HTTPS and timer recovery.
- Record the actual deployment and rollback procedure in private server
  knowledge. Do not publish host configuration, credentials or real telemetry.

## Compatibility decisions

5.0.0 deliberately changes session validity: users sign in again after upgrade;
legacy JWTs are not migrated. Configuration additions should have safe defaults.
No telemetry/history format conversion is planned. Direct cross-origin browser
hosting is not implied by a configurable API URL; document the same-origin
reverse proxy arrangement. Public artifact bytes should also serve the authorized
host deployment, without a separate private application variant.

This file records the implementation plan. The release changelog, test results
and deployment evidence establish which steps have actually completed.
