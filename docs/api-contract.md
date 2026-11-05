# API and telemetry contract

The API uses GET endpoints listed in the [API guide](../api/README.md). Send
HTTP Basic credentials to `/api/auth`; a successful JSON response has
`data.token`. Send that JWT as `Authorization: Bearer <token>` on all other
endpoints, including `/api/ok` and `/api/telemetry`. Use HTTPS outside a trusted
local connection. Sessions default to 12 hours; configuration and invalidation
rules are in the [migration guide](migration-5.0.md).

Successful API responses wrap the result as `{"data": ...}`. Failures from
authentication or endpoint handlers use `{"errors":["..."]}` with an HTTP
error status: 401 for authentication, 429 for rate limiting and 500 for source
errors. Empty `errors` and absent `data` may be omitted. Unsupported methods
return 405 with `Allow: GET`; unknown paths return 404. These routing errors need
not use the JSON envelope. Do not depend on error text as a stable identifier.

When no telemetry file is configured, `/api/telemetry` returns
`{"data":{"enabled":false}}`. An enabled snapshot uses schema version 1,
`enabled: true` and a `collected_at` timestamp. Missing, unreadable or invalid
snapshot envelopes produce an error rather than a disabled response. The API
checks the envelope, not every producer field; the dashboard validates fields it
consumes. See [frontend types](../app/src/types.ts) and the
[collector guide](../collector/README.md) for fields and measurement semantics.
Producers should use RFC 3339 timestamps, preserve unknown or unavailable
measurements as null or omitted where supported by those types, and never
substitute zero for an unknown value. Disabled, failed and stale sources are
distinct states. Resource history contains observed samples and gaps, not
interpolated values. A backup size does not establish verification or restoreability.

The embedded dashboard and API share an origin. For a separate static frontend,
serve it at the same origin as a reverse proxy forwarding `/api/` to the API.
Changing `VITE_API_URL` does not add CORS support to the API.

Run `sh scripts/check-contract.sh` from the source checkout to generate synthetic
Go collector fixtures and validate them with the dashboard's runtime validator.
The same check runs in CI. To validate an existing snapshot privately, use
`node app/scripts/validate-telemetry.mjs /private/path/telemetry.json` with Node 24+;
it prints only `PASS` or `FAIL` and exits 0 or 1. It does not collect or upload data.
