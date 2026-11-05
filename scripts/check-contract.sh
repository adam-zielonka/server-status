#!/bin/sh
set -eu
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
fixture_dir=$(mktemp -d)
trap 'rm -rf "$fixture_dir"' EXIT HUP INT TERM
cd "$repo_root/api"
SERVER_STATUS_CONTRACT_DIR="$fixture_dir" "${GO:-go}" test -count=1 -run '^TestFrontendContractFixtures$' ./collector
for fixture in "$fixture_dir"/*.json; do
    "${NODE:-node}" "$repo_root/app/scripts/validate-telemetry.mjs" "$fixture"
done
