# Server Status

Go-based REST API server for retrieving server status information and web application to visualize this information.

See fake server-status on [fake-status](https://adam-zielonka.github.io/server-status/)

![Server Status dashboard with synthetic demo data](app/img/server-status.png)

*The screenshot uses fictional demo data; no private server information is shown.*

## Instruction

You can find more details by following these links:

- [REST API (Go)](api/README.md)
- [Web Application (React + TypeScript + Vite)](app/README.md), with shadcn/ui components.
- [Optional operations monitoring](collector/README.md): service health, top
  processes, container allocation, Tailscale status, resource history, directory
  growth, and scheduled tasks/backups. Host configuration and collected data
  stay outside the public repository; the demo uses synthetic examples.

## License
MIT
