#!/bin/sh
set -eu

build_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$build_root"

case "${1:-build}" in
    build|frontend) ;;
    *) echo 'Usage: ./build.sh [build|frontend]' >&2; exit 1 ;;
esac
if [ "$#" -gt 1 ]; then
    echo 'Usage: ./build.sh [build|frontend]' >&2
    exit 1
fi

# The binary always uses the real same-origin API. Build the public synthetic
# demo separately; never copy its output over api/web/dist.
(
    cd app
    VITE_FAKE_API=false VITE_API_URL=/api/ "${PNPM:-pnpm}" build
)
rm -rf api/web/dist
cp -R app/dist api/web/dist

if [ "${1:-build}" = frontend ]; then
    exit 0
fi

mkdir -p build
build_version=${VERSION:-$(cat VERSION)}
cd api
CGO_ENABLED=0 "${GO:-go}" build -trimpath \
    -ldflags "-s -w -X main.version=${build_version}" \
    -o ../build/server-status .
