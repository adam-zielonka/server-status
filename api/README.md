# Server Status - Go Implementation

Go-based HTTP server for retrieving server status information through RESTful API endpoints.

## Build the standalone application

From the repository root, install frontend dependencies and build:

```bash
cd app && pnpm install --frozen-lockfile && cd ..
./build.sh
```

The result is `build/server-status`: a Go executable with the production React
frontend embedded using `go:embed`. Go, Node.js and pnpm are build dependencies;
none is required to run the resulting executable. The optional Linux collector
is included as the `collect` subcommand and runs as a separate process.
Configuration and collected data remain external.

`./build.sh` forces real API mode with the same-origin `/api/` base URL, even if
`VITE_FAKE_API` or `VITE_API_URL` is set in the build environment. Other frontend
build options, such as `VITE_SHOW_VHOSTS=false`, are supported. Builds use the
repository's `VERSION` file by default; set the `VERSION` environment variable to
override it. A frontend change requires rebuilding the executable.

Cross-compile, for example:

```bash
GOOS=linux GOARCH=arm64 VERSION=1.0.0 ./build.sh
```

To prepare embedded assets before Go development or tests, run `./build.sh frontend`.
Then use `go build -o build/status .` or `go test ./...` from `api/`.
Compile the complete package (`.`), since the HTTP router is in a separate file.
The generated `api/web/dist/` directory is ignored by Git; a fresh checkout needs
this frontend build before Go compilation. Optional Make targets provide the same
workflow: `make install`, `make build`, and `make test`.
CI additionally uses `go test -race ./...`, which needs cgo and a C compiler.

## Configuration

By default, the server looks for `config.jsonc` first, then `config.json` in the
**current working directory**. Both names currently expect JSON syntax. Use
`--config` for an explicit path, and keep production configuration outside the
checkout. The executable never embeds configuration or telemetry.

Example `config.jsonc`:

```jsonc
{
  "listen": {
    "host": "localhost",
    "port": 4000
  },
  "auth": {
    "users": [
      {
        "name": "dragon",
        "pass": "dragon"
      }
    ],
    "secret": "pancake-is-the-best-dragon"
  },
  "services": [
    {
      "name": "Web",
      "port": "80"
    },
    {
      "name": "SSH",
      "port": "22"
    },
    {
      "name": "Server Status",
      "port": "4000"
    }
  ],
  "hosts": [
    "localhost"
  ],
  "external": ""
}
```

## Run and CLI

```bash
./build/server-status serve --config /etc/server-status/config.json
./build/server-status serve --config /etc/server-status/config.json --listen 127.0.0.1:8080
./build/server-status config check --config /etc/server-status/config.json
./build/server-status config check --collector --config /etc/server-status/collector.json
./build/server-status collect --config /etc/server-status/collector.json
./build/server-status version
./build/server-status --help
./build/server-status serve --help
```

`serve` exposes the embedded dashboard at `/` and the existing authenticated API
at `/api/*` on the same listener. No static directory, Node server, or second
frontend port is needed. Configure HTTPS or your existing reverse proxy to forward
**all paths** to this listener. Keep the API's configured loopback bind when using
Tailscale Serve or another local proxy. Authentication requirements are unchanged.

`--listen` overrides the configured bind address; bracket IPv6 addresses, for
example `[::1]:4000`. `--api-only` disables static serving for Vite development
or deployments that intentionally keep separate frontend hosting.

`config check` validates API configuration by default; add `--collector` to
validate collector configuration with an explicit `--config` path. Neither opens
a listener, starts collection, prints credentials, or checks external services
and telemetry file availability.
Validation failures and unknown commands exit with a nonzero status. `version`
and help do not require a configuration file. SIGINT/SIGTERM stop the HTTP server
with up to ten seconds to complete active requests.

For compatibility, running without a subcommand starts `serve`, and both
`-config` and `--config` are supported. Existing systemd `ExecStart` lines continue
to work; new units can use the explicit `serve` subcommand.

`collect` takes one Linux telemetry sample without opening an HTTP listener.
Run it from the existing systemd timer with its own permissions. The same Go
executable implements both roles; the HTTP service remains unprivileged and
never invokes collection. No Python interpreter is needed. Existing collector
configuration, snapshot schema, history and locking are compatible. Optional
integrations still use system tools such as `systemctl`, `du`, `tailscale`, `gh`
and `psql`; see the [collector guide](../collector/README.md).

## API Endpoints

All endpoints except `/api/auth` require authentication via JWT token.

### Authentication
**GET** `/api/auth`
- Authenticate using HTTP Basic Auth and receive JWT token
- Use Basic Authentication with username and password in the Authorization header
- Returns: JWT token for subsequent requests

### System Information
**GET** `/api/ok`
- Health check endpoint
- Returns: `"ok"`

**GET** `/api/system`
- Retrieve system information
- Returns: OS, platform, hostname, architecture, CPU info

**GET** `/api/memory`
- Retrieve memory usage information
- Returns: Total, used, free memory

**GET** `/api/load-average`
- Retrieve system load average
- Returns: 1, 5, and 15-minute load averages

**GET** `/api/file-system`
- Retrieve file system information
- Returns: Disk usage for mounted filesystems

**GET** `/api/net`
- Retrieve network interface information
- Returns: Network interfaces and their statistics

**GET** `/api/vhosts`
- Retrieve virtual hosts information
- Returns: List of configured virtual hosts

**GET** `/api/services`
- Retrieve services status
- Returns: Status of configured services (listening on specified ports)

## Optional operations telemetry

**GET** `/api/telemetry` requires JWT authentication. It reads a snapshot from
`telemetry_file` in the private API configuration. Without that option it returns
`{"data":{"enabled":false}}`. Missing or invalid snapshots produce a generic
error without exposing filesystem paths. See the [collector guide](../collector/README.md)
for setup, data semantics, privacy boundaries, and the versioned snapshot format.

## Project structure

- `status.go`: CLI, configuration flags, listener and graceful shutdown.
- `server.go`: API routes and optional embedded dashboard handler.
- `web/web.go`: embedded frontend and static-file serving.
- `web/dist/`: generated production build, not tracked in Git.
- `collector/`: Linux collection and optional integrations, invoked only by CLI.
- `auth/`: JWT authentication.
- `config/`: configuration loading and standalone validation.
- `mods/`: system metrics and optional telemetry snapshot reader.
- `utils/`: shared response types and helpers.

## Authentication

The server uses JWT (JSON Web Tokens) for authentication. To access protected endpoints:

1. Obtain a token by sending credentials to `/api/auth`
2. Include the token in the `Authorization` header for subsequent requests:
   ```
   Authorization: Bearer <token>
   ```

## Dependencies

- Native Go standard library for most functionality
- Third-party packages as specified in `go.mod`

## Licence

MIT
