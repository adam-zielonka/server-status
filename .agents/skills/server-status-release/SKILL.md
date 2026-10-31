---
name: server-status-release
description: Build, verify and publish Server Status releases with embedded frontend assets, Linux binaries and checksums. Use for release preparation or publication, not production deployment or ordinary UI changes.
---

Use the task's existing authorization for commit, push and publication. This
workflow does not authorize changing a running server or its configuration.

Read the current [build and CLI guide](../../../api/README.md),
[workflow](../../../.github/workflows/pages.yml) and [VERSION](../../../VERSION).

- Build the real frontend before compiling Go: it lives outside the Go module
  and `build.sh` stages it into `api/web/dist`. Wait for staging to finish before
  any Go builds; staging replaces that directory and concurrent embedding can
  fail or read inconsistent assets.
- Keep the production build separate from the synthetic demo. The workflow
  embeds real API mode first, then builds the demo into `app/dist` for Pages.
  Build release assets with the repository's general UI settings, rather than
  inheriting private deployment overrides such as a hidden Caddy panel.
- Read the requested version from `VERSION`, update the changelog, and test the
  final source. Go compilation and tests need staged assets. Run frontend checks
  and Go tests/vet; CI also runs `go test -race ./...`. A machine without a C
  compiler cannot run the race detector, so verify the matching CI run rather
  than claiming it ran locally.
- For browser checks after a version bump, restart an owned reused Vite server:
  the configuration captures `VERSION` at startup. Finish coverage generation
  before browser checks against the dev server; its generated HTML files can
  trigger Vite full-page reloads during a test. Neither a build nor an interrupted
  browser run is evidence that a responsive scenario passed.
- Compile release binaries from the intended clean commit for Linux amd64 and
  arm64 with `CGO_ENABLED=0`, `-trimpath`, and `-X main.version=<version>`.
  Check `version` on the native binary and `go version -m` for both architectures:
  revision, architecture and clean VCS state must match the release source.
- Smoke-test the native executable from a temporary directory using synthetic
  credentials: embedded assets, JWT API access, collection and shutdown. Keep
  any collected host telemetry outside the checkout and remove the temporary
  data. Public fixtures and demo assets must remain synthetic.
- Generate `SHA256SUMS` from the final executable bytes, using plain filenames.
  Upload the two binaries and checksums to a draft release with the existing tag
  verified. Compare downloaded assets with the checksums before publication.
  Verify the workflow for the release commit, including the Pages deployment.
- Confirm the published release is public, has the intended tag and assets,
  and is Latest when requested. Report its URL and actual validation outcome.

A published tag identifies its original source. Repository cleanup on `main`
does not change that source. Do not silently move a published tag or replace its
binaries; use a new version when releasing changed code. Release prose can be
edited without altering the tag or executable assets.
