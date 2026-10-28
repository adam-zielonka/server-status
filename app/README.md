# Server Status App

A React + TypeScript dashboard for the [Go API](../api/README.md), built with
[shadcn/ui](https://ui.shadcn.com), Radix UI, Tailwind CSS and Lucide icons.
All product text, examples and source documentation are in English.

![Server Status dashboard with synthetic demo data](img/server-status.png)

_The screenshot shows the synthetic demo, not a connected server._

## Getting started

Requires Node.js 24+ (below 27) and pnpm 12. The exact package-manager version is
pinned in `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm fake
```

Demo mode uses synthetic data only and never contacts the API. For a real backend,
run `pnpm dev`; Vite binds to loopback and proxies `/api` to `127.0.0.1:4000`.
To reach a remote backend through SSH without publishing its API port:

```bash
ssh -N -L 4000:127.0.0.1:4000 user@server.example.com
```

## Build and configuration

```bash
pnpm build
```

The output is `dist/`. For the standalone Go executable, run `./build.sh` from
the repository root after installing dependencies. It embeds the production
frontend and serves it together with `/api/*`; Node.js is only needed to build.
See the [CLI and build guide](../api/README.md). Frontend changes require rebuilding
the executable. Static hosting and the separate public demo remain supported.

The dashboard footer and sign-in page show the version from the repository's
`VERSION` file and link to its release notes. The `VERSION` environment override
also applies to the frontend when building the standalone executable.

Build-time options:

| Variable           | Default | Purpose                                          |
| ------------------ | ------- | ------------------------------------------------ |
| `VITE_API_URL`     | `/api/` | API base URL, including trailing slash           |
| `VITE_FAKE_API`    | unset   | Set to exactly `true` to use synthetic demo data |
| `VITE_SHOW_VHOSTS` | `true`  | Set to `false` to hide the optional Caddy panel  |

```bash
VITE_SHOW_VHOSTS=false pnpm build
```

`VITE_*` values are public frontend configuration. Never put credentials,
private host details, tokens or real monitoring snapshots into these variables,
source files, fixtures or public demo assets. Keep real API/collector configuration
outside the checkout. See the [collector privacy guide](../collector/README.md).

## Application structure

- `src/types.ts`: API and monitoring contracts.
- `src/lib/`: typed API client, formatting, health/history rules, session storage
  and synthetic demo data.
- `src/hooks/use-api.ts`: shared TanStack Query fetching, cancellation, retries,
  cache and automatic refresh.
- `src/features/auth/`: sign-in, session validation and logout.
- `src/features/dashboard/`: overview, services, processes, storage, network,
  system, software and scheduled tasks.
- `src/components/`: shared shell, cards, tables and status indicators.
- `src/components/ui/`: locally owned TypeScript shadcn/ui components from the
  official registry. Components use the shared `cn` utility and CSS theme tokens.
- `src/index.css`: Tailwind setup, light/dark themes and reduced-motion defaults.

The interface uses one card/table/navigation system throughout, with responsive
navigation, keyboard-accessible controls and a stored light/dark theme preference.
The authenticated dashboard and history charts are loaded separately. History charts preserve recording gaps and never synthesize
missing samples. Metrics refresh every 30 seconds while the dashboard is active.
Issues link to diagnostic views and are prioritized by severity. Services and
tasks support search and health filters. Process rankings are paged in groups of
50; filtering still searches every recorded entry. Browser navigation restores
views and page focus. Collector loading, failures and disabled integrations have
distinct states, and stale readings are labeled. Current resource cards fall back
to basic API readings when their collector samples are old. API data is validated
before rendering; requests retain a 15-second timeout alongside cancellation.

JWT login persists only the username and token, never passwords. Corrupted or
blocked browser storage is handled. Logout and HTTP 401 clear
session state and the query cache. An optional collector failure does not hide
basic API metrics, and disabled collectors have explicit empty states.

## Validation

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:coverage
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

`pnpm test` runs once; use `pnpm test:watch` during development. Vitest and Testing
Library cover login/logout, expired sessions, network failures, API validation, navigation, filtering/sorting, disabled collectors,
theme switching, browser history, actionable issues, pagination, source recovery, task freshness, chart gaps, formatting and synthetic-only demo
requests. Test fixtures contain example data only.

Playwright checks all eight views in Chromium at phone, small-phone, landscape
and desktop sizes. It verifies that navigation stays visible after view changes
and scrolling, avoids page-wide horizontal overflow, and exercises browser
history, deep links, keyboard focus, theme persistence, sign-out and version
links. CI installs Chromium and runs these checks against the synthetic demo.

Use `pnpm format` to apply Prettier. Add or update shadcn components using
`pnpm dlx shadcn@latest add <component>`; review generated changes and keep imports
pointing to `@/lib/utils` for class composition.

## License

MIT. shadcn/ui component source is also MIT licensed; see `THIRD_PARTY_NOTICES.md`.
