#!/usr/bin/env python3
"""Exercise a native release without production configs or persistent host data."""

import argparse
import base64
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("binary", type=Path)
    parser.add_argument("--previous", type=Path)
    parser.add_argument("--validator", type=Path,
                        help="Node telemetry validator; receives a private snapshot path")
    args = parser.parse_args()
    binary = args.binary.resolve()
    previous = args.previous.resolve() if args.previous else None
    validator = args.validator.resolve() if args.validator else None
    # No host-derived telemetry leaves this mode-0700 temporary directory.
    with tempfile.TemporaryDirectory(prefix="server-status-release-") as directory:
        root = Path(directory)
        snapshot, state = root / "telemetry.json", root / "state.json"
        collector = root / "collector.json"
        collector.write_text(json.dumps({"snapshot_file": str(snapshot),
                                        "state_file": str(state),
                                        "cpu_capacity_cores": 1}))
        collector.chmod(0o600)
        at = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=2)).replace(microsecond=0)
        point = {"at": at.isoformat().replace("+00:00", "Z"), "cpu_percent": 25,
                 "cpu_capacity_cores": 1, "cpu_usage_cores": .25,
                 "memory_percent": 30, "disk_percent": 40,
                 "directory_bytes": {"Example": 1024}}
        peak = {"peak_cores": 1, "observed_since": point["at"]}
        state.write_text(json.dumps({"history": [point], "cpu_capacity": peak}))
        state.chmod(0o600)
        sequence = [binary, binary] + ([previous, binary] if previous else [])
        for candidate in sequence:
            subprocess.run([str(candidate), "config", "check", "--collector", "--config", str(collector)],
                           check=True, stdout=subprocess.DEVNULL, timeout=10)
            subprocess.run([str(candidate), "collect", "--config", str(collector)],
                           check=True, stdout=subprocess.DEVNULL, timeout=60)
            data = json.loads(snapshot.read_text())
            retained = next((p for p in data["history"] if p["at"] == point["at"]), None)
            assert retained is not None and all(retained.get(k) == v for k, v in point.items()), "retained history changed"
            assert data["cpu_capacity"]["peak_cores"] >= 1, "CPU peak lost"
            assert snapshot.stat().st_mode & 0o777 == 0o640
            assert state.stat().st_mode & 0o777 == 0o600
            if validator:
                subprocess.run(["node", str(validator), str(snapshot)], check=True, timeout=15)
            time.sleep(1)  # Avoid duplicate second-resolution sample times.
        print("Collector forward/repeat/reverse compatibility and history: passed")

        # Reserve an ephemeral loopback port, retrying startup failures is left
        # to the caller rather than terminating any other listener.
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        password = secrets.token_urlsafe(32)
        settings = {"listen": {"host": "127.0.0.1", "port": port},
                    "auth": {"secret": secrets.token_hex(32),
                             "users": [{"name": "release-test", "pass": password}]},
                    "telemetry_file": str(snapshot)}
        config = root / "api.json"
        config.write_text(json.dumps(settings)); config.chmod(0o600)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        base = f"http://127.0.0.1:{port}"

        def request(path, authorization=None):
            req = urllib.request.Request(base + path)
            if authorization:
                req.add_header("Authorization", authorization)
            try:
                with opener.open(req, timeout=10) as response:
                    return response.status, response.headers, response.read()
            except urllib.error.HTTPError as error:
                return error.code, error.headers, error.read()

        process = subprocess.Popen([str(binary), "serve", "--config", str(config)],
                                   cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                assert process.poll() is None, "candidate exited during startup"
                try:
                    status, _, body = request("/")
                    if status == 200: break
                except (urllib.error.URLError, ConnectionError):
                    pass
                time.sleep(.1)
            else:
                raise AssertionError("candidate did not become ready")
            assert b'<div id="root">' in body
            asset = re.search(rb'src="\.?(/assets/[^\"]+\.js)"', body).group(1).decode()
            status, headers, _ = request(asset)
            assert status == 200 and "immutable" in headers.get("Cache-Control", "")
            assert request("/api/ok")[0] == 401
            assert request("/api/vhosts")[0] == 404
            basic = base64.b64encode(f"release-test:{password}".encode()).decode()
            status, _, body = request("/api/auth", "Basic " + basic)
            assert status == 200
            token = json.loads(body)["data"]["token"]
            claims = json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))
            assert claims["exp"] > time.time()
            for endpoint in ["ok", "system", "memory", "load-average", "file-system", "net", "services", "telemetry"]:
                status, _, body = request("/api/" + endpoint, "Bearer " + token)
                assert status == 200 and "data" in json.loads(body), "authenticated endpoint failed: " + endpoint
        finally:
            process.terminate()
            try:
                process.wait(timeout=12)
            except subprocess.TimeoutExpired:
                process.kill(); process.wait()
                raise AssertionError("graceful shutdown timed out")
        assert process.returncode == 0, "shutdown failed"
        print("Embedded assets, authenticated API, expiry, denial and shutdown: passed")
    print("Native artifact SHA-256:", hashlib.sha256(binary.read_bytes()).hexdigest())


if __name__ == "__main__":
    main()
