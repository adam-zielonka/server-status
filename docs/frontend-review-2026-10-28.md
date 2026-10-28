# Frontend review — 2026-10-28

Reviewed the shared shell and all eight dashboard views with synthetic demo
data, plus authentication, browser history, focus, theme selection and version
display. The changes are included in version 4.3.0.

## Findings and fixes

- Switching views scrolled the main content into position beneath the sticky
  header, leaving mobile navigation partially hidden behind that header.
  The header and navigation now share one sticky container. View changes
  return to the page top and retain heading focus; the skip link has an offset
  that accounts for both rows on small screens.
- Optional backup storage payloads bypassed frontend validation. A malformed
  row could throw during issue generation or rendering. These rows now pass
  through the same API boundary checks as other telemetry; missing monitoring
  and unknown measurements with a null check time remain supported.
- Backup storage errors now have an explicit dark-theme text color.
- The dashboard footer and login page display the build version and link to
  its release notes. Builds read `VERSION` and honor its environment override.

## Verification

- TypeScript, ESLint, Prettier and 84 Vitest tests pass. The dependency audit
  reports no known vulnerabilities.
- Eight Chromium browser tests pass at 390×844, 320×568, 844×390 and 1280×900.
  They check all eight views, full visibility of the active navigation item,
  navigation below the header after page changes and scrolling, absence of
  page-wide horizontal overflow, Back/Forward, direct links and reloads,
  skip-to-content focus, theme persistence, sign-out and version links.
- No uncaught browser exceptions were recorded while traversing the views.
- Production frontend compilation, all Go package tests with the race
  detector, and `go vet ./...` pass.

The browser checks run in CI against synthetic data. They verify Chromium
layouts and behavior, not a physical iPhone or Safari. Production deployment
is separate from publishing the release.
