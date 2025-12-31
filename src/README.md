# Server Status - Go Implementation

Go-based HTTP server for retrieving server status information through RESTful API endpoints.

## Build

Build the application:
```bash
$ go build -o build/status
```

Build for Linux (cross-compilation):
```bash
$ env GOOS=linux GOARCH=amd64 go build -o build/status
```

## Configuration

Create a `config.jsonc` file in the same directory as the executable:

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

## Run

```bash
$ ./build/status
```

The server will start and display the listening address:
```
http://localhost:4000/
```

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

## Project Structure

```
src/
├── status.go          # Main entry point, HTTP handlers
├── config.jsonc       # Configuration file
├── go.mod            # Go module definition
├── auth/             # Authentication module
│   └── auth.go       # JWT authentication logic
├── config/           # Configuration module
│   └── config.go     # Configuration loader and types
├── mods/             # Information modules
│   ├── fs.go         # File system information
│   ├── loadavg.go    # Load average information
│   ├── memory.go     # Memory information
│   ├── net.go        # Network information
│   ├── services.go   # Services status
│   ├── system.go     # System information
│   └── vhosts.go     # Virtual hosts information
└── utils/            # Utility functions
    ├── types.go      # Common types
    └── utils.go      # Helper functions
```

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
