# Migrating to 5.0

Back up the executable and private configuration and retain collector state and
snapshots for rollback. Validate configuration with the new executable before
restarting services; see the [installation guide](installation.md) for systemd
credential delivery and account permissions. Correct any rejected usernames,
passwords, signing secret or other configuration values. The example secret is
a placeholder and must be replaced with a random private value.

Existing sessions, including legacy nonexpiring tokens, are rejected: users must
sign in again. `auth.session_ttl_seconds` defaults to 43200 seconds (12 hours) and
accepts 300–604800 seconds. Changing a user's password, removing the user or
rotating the signing key invalidates affected tokens. Local sign-out clears the
browser session but does not revoke a copied token; rotate credentials if needed.

Telemetry schema 1, retained resource history and CPU peak metadata continue
without a format conversion. Preserve the collector's private state and snapshot
permissions. Optional integrations remain optional; review executable paths and
GitHub identity in the [collector guide](../collector/README.md). Backup size is
a measurement, not evidence of integrity or restore testing. For a separate
frontend retain a same-origin `/api/` proxy. Rollback to an older executable may
require signing in again; keep your previous configuration and executable.

The removal of virtual-host monitoring and the agent task board shipped in
4.6.1 (originally planned as 4.6.0); see the component guides.
