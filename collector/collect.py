#!/usr/bin/env python3
"""Produce allowlisted Linux telemetry; no HTTP listener or shell commands.

Keep the real configuration and all generated files OUTSIDE the checkout.
Process metadata includes parent IDs, executable basenames and service names; never cmdline or environ.
"""
import argparse
import datetime as dt
import fcntl
import http.client
import json
import math
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess
import tempfile
import time

UTC = dt.timezone.utc
PROPERTIES = (
    'Id,LoadState,ActiveState,SubState,Result,NRestarts,ExecMainStatus,'
    'ActiveEnterTimestampMonotonic,ExecMainStartTimestamp,ExecMainExitTimestamp,'
    'LastTriggerUSec,NextElapseUSecRealtime'
)


def iso(timestamp=None):
    return dt.datetime.fromtimestamp(time.time() if timestamp is None else timestamp, UTC).isoformat(timespec='seconds')


def timestamp(value):
    if not value or value in ('n/a', 'infinity'):
        return None
    try:
        return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()
    except ValueError:
        try:
            return dt.datetime.strptime(value, '%a %Y-%m-%d %H:%M:%S %Z').replace(tzinfo=UTC).timestamp()
        except ValueError:
            return None


def read_json(path, default):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return default


def atomic_json(path, data, mode=0o600):
    path = Path(path)
    fd, name = tempfile.mkstemp(prefix='.' + path.name, dir=path.parent)
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, 'w') as stream:
            json.dump(data, stream, separators=(',', ':'), allow_nan=False)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def command(args, timeout=12, env=None):
    # Do not include command output in errors: CLIs can print credentials.
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout, env=env)
    if result.returncode:
        raise RuntimeError('read-only query failed')
    return result.stdout


def systemd_properties(item, timer=False):
    unit = item.get('timer') if timer else item['unit']
    if not unit or not re.fullmatch(r'[A-Za-z0-9_.@:\\-]+\.(service|timer)', unit):
        raise ValueError('invalid unit name')
    args = ['/usr/bin/systemctl']
    env = dict(os.environ, LC_ALL='C', TZ='UTC')
    if item.get('user'):
        user = item['user']
        uid = pwd.getpwnam(user).pw_uid
        env.update(XDG_RUNTIME_DIR=f'/run/user/{uid}', DBUS_SESSION_BUS_ADDRESS=f'unix:path=/run/user/{uid}/bus')
        args += ['--user']
        if uid != os.geteuid():
            args = ['/usr/sbin/runuser', '-u', user, '--'] + args
    text = command(args + ['show', unit, '--property=' + PROPERTIES], env=env)
    props = dict(line.split('=', 1) for line in text.splitlines() if '=' in line)
    if props.get('LoadState') != 'loaded':
        raise RuntimeError('unit is unavailable')
    return props


def collect_services(items, previous):
    services = []
    known = {row['id']: row for row in previous}
    for item in items:
        key = item.get('user', 'system') + ':' + item['unit']
        row = {'id': key, 'name': item.get('name', item['unit']), 'unit': item['unit'],
               'scope': 'user' if item.get('user') else 'system', 'state': 'unknown'}
        old = known.get(key, {})
        row.update(last_error=old.get('last_error'), last_error_at=old.get('last_error_at'))
        try:
            p = systemd_properties(item)
            active = int(p.get('ActiveEnterTimestampMonotonic', '0')) / 1e6
            result, code = p.get('Result', 'unknown'), int(p.get('ExecMainStatus', '0'))
            row.update(state=p['ActiveState'], substate=p.get('SubState'),
                       restarts=int(p.get('NRestarts', '0')), result=result, exit_status=code,
                       uptime_seconds=max(0, int(time.clock_gettime(time.CLOCK_BOOTTIME) - active)) if active and p['ActiveState'] == 'active' else None)
            if result not in ('success', 'unknown'):
                row.update(last_error=f'{result} (exit status {code})', last_error_at=p.get('ExecMainExitTimestamp') or iso())
        except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired, KeyError):
            row['error'] = 'Service state is unavailable'
        services.append(row)
    return services


def proc_stat(text):
    # comm can contain spaces and parentheses; the final ')' ends that field.
    left, right = text.rsplit(')', 1)
    fields = right.split()
    return {'name': left.split('(', 1)[1][:80], 'ticks': int(fields[11]) + int(fields[12]),
            'ppid': int(fields[1]), 'start': int(fields[19]), 'rss_bytes': max(0, int(fields[21])) * os.sysconf('SC_PAGE_SIZE')}


def read_processes():
    result = {}
    for path in Path('/proc').glob('[0-9]*/stat'):
        try:
            row = proc_stat(path.read_text())
            try:
                row['executable'] = Path(os.readlink(path.parent / 'exe')).name.removesuffix(' (deleted)')[:80]
            except OSError:
                row['executable'] = None
            try:
                lines = (path.parent / 'cgroup').read_text().splitlines()
                cgroup = next((line.split(':', 2)[2] for line in lines if line.startswith('0::')), '')
                parts = cgroup.split('/')
                index = next((i for i in range(len(parts) - 1, -1, -1) if parts[i].endswith('.service')), None)
                row['service'] = parts[index][:120] if index is not None else None
                # Identity stays internal: equal unit names in different user
                # managers must not collapse into a single service group.
                row['service_key'] = '/'.join(parts[:index + 1]) if index is not None else None
            except OSError:
                row['service'] = None
            result[int(path.parent.name)] = row
        except (OSError, ValueError, IndexError):
            continue  # Processes may exit between directory listing and read.
    return result


def top_processes(first, second, elapsed):
    rows = []
    ticks = os.sysconf('SC_CLK_TCK')
    for pid, p in second.items():
        old = first.get(pid)
        percent = None
        if old and old['start'] == p['start'] and elapsed > 0:
            percent = round(max(0, p['ticks'] - old['ticks']) / ticks / elapsed * 100, 1)
        rows.append({'pid': pid, 'name': p['name'], 'rss_bytes': p['rss_bytes'], 'cpu_percent': percent})
    # All processes in a service, including browsers, share one resource group.
    browsers = {'chrome', 'chrome-headless-shell', 'chromium', 'chromium-browser', 'firefox', 'firefox-bin'}
    def service_key(p):
        return p.get('service_key') or p.get('service')

    service_members = {}
    for pid, p in second.items():
        if service_key(p):
            service_members.setdefault(service_key(p), set()).add(pid)
    service_roots = {}
    for key, members in service_members.items():
        roots = [pid for pid in members if second[pid].get('ppid') not in members]
        service_roots[key] = min(roots or members, key=lambda pid: (second[pid]['start'], pid))

    def executable_root(pid):
        root, seen = pid, {pid}
        executable = second[pid].get('executable')
        while executable:
            parent = second[root].get('ppid')
            ancestor = second.get(parent)
            if (not ancestor or parent in seen or ancestor.get('executable') != executable
                    or service_key(ancestor) != service_key(second[pid])
                    or ancestor['start'] > second[root]['start']):
                break
            seen.add(parent)
            root = parent
        return root

    groups = {}
    group_browsers = {}
    for row in rows:
        pid = row['pid']
        p = second[pid]
        executable = p.get('executable')
        is_browser = executable in browsers
        key = service_key(p)
        browser_root = executable_root(pid) if is_browser else None
        kind = 'browser' if is_browser else 'process'
        if key:
            root = service_roots[key]
            kind = 'service'
        else:
            root = executable_root(pid)
            if is_browser:
                parent = second[root].get('ppid')
                owner = second.get(parent)
                if (parent and parent > 1 and owner and owner.get('executable')
                        and owner.get('executable') not in browsers
                        and not service_key(owner) and owner['start'] <= second[root]['start']):
                    root = executable_root(parent)
                    kind = 'process'
        name = p['service'] if kind == 'service' else second[root].get('executable') or second[root]['name']
        parent = second.get(p.get('ppid'), {})
        row.update(ppid=p.get('ppid'), parent_name=parent.get('executable') or parent.get('name'),
                   service=p.get('service'), instance_pid=root, instance_name=name, group_kind=kind, browser_instance_pid=browser_root)
        group_key = ('service', key) if kind == 'service' else ('instance', root)
        group = groups.setdefault(group_key, {'pid': root, 'name': name, 'group_kind': kind,
                                  'rss_bytes': 0, 'cpu_percent': 0, 'process_count': 0,
                                  'member_pids': [], 'service': second[root].get('service'),
                                  'ppid': second[root].get('ppid'),
                                  'parent_name': None})
        if browser_root is not None:
            group_browsers.setdefault(group_key, set()).add(browser_root)
        group['browser_instance_count'] = len(group_browsers.get(group_key, ()))
        group_parent = second.get(group['ppid'], {})
        group['parent_name'] = group_parent.get('executable') or group_parent.get('name')
        group['rss_bytes'] += row['rss_bytes']
        group['process_count'] += 1
        group['member_pids'].append(pid)
        if row['cpu_percent'] is None or group['cpu_percent'] is None:
            group['cpu_percent'] = None
        else:
            group['cpu_percent'] = round(group['cpu_percent'] + row['cpu_percent'], 1)
    def ranked(items, key):
        return sorted(items, key=lambda r: (r[key] or 0, -r['pid']), reverse=True)
    return {'top_cpu': ranked(rows, 'cpu_percent'),
            'top_memory': ranked(rows, 'rss_bytes'),
            'groups_cpu': ranked(groups.values(), 'cpu_percent'),
            'groups_memory': ranked(groups.values(), 'rss_bytes'),
            'sample_seconds': round(elapsed, 2), 'cpu_basis': '100% equals one logical CPU'}


def cpuset_count(value):
    count = 0
    for part in value.strip().split(','):
        if not part:
            continue
        pair = [int(x) for x in part.split('-')]
        count += pair[-1] - pair[0] + 1
    return count


def optional_int(path):
    try:
        value = Path(path).read_text().strip()
        return None if value == 'max' else int(value)
    except (OSError, ValueError):
        return None


def collect_container():
    root = Path('/sys/fs/cgroup')
    try:
        cpuset = (root / 'cpuset.cpus.effective').read_text().strip()
    except OSError:
        cpuset = ''
    cpus = cpuset_count(cpuset) or len(os.sched_getaffinity(0))
    quota = None
    try:
        maximum, period = (root / 'cpu.max').read_text().split()
        if maximum != 'max':
            quota = int(maximum) / int(period)
    except (OSError, ValueError, ZeroDivisionError):
        pass
    memory = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines())
    visible = int(memory['MemTotal'].split()[0]) * 1024
    current = optional_int(root / 'memory.current')
    working = None
    try:
        stats = dict(line.split() for line in (root / 'memory.stat').read_text().splitlines())
        if current is not None:
            working = max(0, current - int(stats.get('inactive_file', 0)))
    except (OSError, ValueError):
        pass
    boot = time.clock_gettime(time.CLOCK_BOOTTIME)
    init = proc_stat(Path('/proc/1/stat').read_text())['start'] / os.sysconf('SC_CLK_TCK')
    try:
        virtualization = command(['/usr/bin/systemd-detect-virt'], timeout=3).strip()
    except (OSError, RuntimeError, subprocess.TimeoutExpired):
        virtualization = 'none or undetected'
    return {'virtualization': virtualization, 'cpu_count': cpus, 'cpuset': cpuset,
            'cpu_quota_cores': quota, 'effective_cpu_cores': min(cpus, quota) if quota else cpus,
            'memory_limit_bytes': optional_int(root / 'memory.max'), 'visible_memory_bytes': visible,
            'memory_current_bytes': current, 'memory_working_set_bytes': working,
            'container_uptime_seconds': max(0, int(boot - init)), 'host_uptime_seconds': int(boot),
            'limit_scope': 'Visible cgroup subtree; limits imposed by ancestors may be hidden'}


def cpu_counter():
    try:
        values = dict(line.split() for line in Path('/sys/fs/cgroup/cpu.stat').read_text().splitlines())
        return int(values['usage_usec'])
    except (OSError, KeyError, ValueError):
        return None


def tunnel_http(port, path):
    # Fixed loopback destination, no proxies/redirects or account credentials.
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=2)
    try:
        connection.request('GET', path)
        response = connection.getresponse()
        body = response.read(262145)
        if len(body) > 262144:
            raise ValueError('metrics response too large')
        return response.status, body.decode('utf-8')
    finally:
        connection.close()


def tunnel_metrics(text):
    counters = {'cloudflared_tunnel_ha_connections': 'connections',
                'cloudflared_tunnel_total_requests': 'requests',
                'cloudflared_tunnel_request_errors': 'request_errors'}
    values, locations = {}, set()
    for line in text.splitlines():
        match = re.fullmatch(r'(cloudflared_tunnel_[a-z_]+)(\{[^\n]*\})?\s+(\S+)', line)
        if not match:
            continue
        name, labels, raw = match.groups()
        if name not in counters and name != 'cloudflared_tunnel_server_locations':
            continue
        value = float(raw)
        if not math.isfinite(value) or value < 0 or not value.is_integer():
            raise ValueError('invalid tunnel metric')
        if name in counters and not labels:
            values[counters[name]] = int(value)
        elif name == 'cloudflared_tunnel_server_locations' and value > 0:
            location = re.search(r'(?:\{|,)edge_location="([A-Za-z0-9_-]{1,32})"(?:,|\})', labels or '')
            if location:
                locations.add(location[1])
    if 'connections' not in values:
        raise ValueError('connection metric missing')
    return {**values, 'locations': sorted(locations)}


def collect_tunnels(items):
    rows = []
    for item in items:
        row = {'name': item['name'], 'hostnames': item.get('hostnames', []),
               'status': 'unknown', 'checked_at': iso(),
               'expected_connections': item.get('expected_connections', 4)}
        try:
            status, text = tunnel_http(item['metrics_port'], '/metrics')
            if status != 200:
                raise ValueError('metrics unavailable')
            metrics = tunnel_metrics(text)
            ready, _ = tunnel_http(item['metrics_port'], '/ready')
            if ready not in (200, 503):
                raise ValueError('readiness unavailable')
            if ready == 200 and metrics['connections'] == 0:
                raise ValueError('inconsistent connection state')
            row.update(metrics)
            row['status'] = ('failure' if ready == 503 or metrics['connections'] == 0 else
                             'healthy' if metrics['connections'] >= row['expected_connections'] else 'degraded')
        except (OSError, ValueError, UnicodeError, http.client.HTTPException):
            row['error'] = 'Local connector metrics are unavailable'
        rows.append(row)
    return rows


def collect_tailscale():
    try:
        data = json.loads(command(['/usr/bin/tailscale', 'status', '--json']))
        serve = json.loads(command(['/usr/bin/tailscale', 'serve', 'status', '--json']))
        own = data.get('Self') or {}
        expiry = own.get('KeyExpiry')
        expires = timestamp(expiry) if expiry and not expiry.startswith('0001-') else None
        services = []
        for address, web in serve.get('Web', {}).items():
            services.append({'address': address, 'paths': sorted(web.get('Handlers', {})),
                             'funnel': bool(serve.get('AllowFunnel', {}).get(address))})
        return {'state': data.get('BackendState', 'unknown'), 'online': own.get('Online', False),
                'hostname': own.get('HostName'), 'dns_name': own.get('DNSName', '').rstrip('.'),
                'addresses': data.get('TailscaleIPs', []), 'expires_at': iso(expires) if expires else None,
                'key_days_remaining': math.floor((expires - time.time()) / 86400) if expires else None,
                'services': services}
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired):
        return {'state': 'unknown', 'online': False, 'error': 'Tailscale state is unavailable'}


def collect_directories(items, previous, now, interval):
    known = {row['name']: row for row in previous}
    result = []
    for item in items:
        old = known.get(item['name'], {})
        collected = timestamp(old.get('collected_at'))
        if collected and now - collected < interval:
            result.append(old)
            continue
        row = {'name': item['name'], 'bytes': old.get('bytes'), 'collected_at': old.get('collected_at')}
        try:
            text = command(['/usr/bin/du', '-sx', '-B1', '--', item['path']], timeout=20)
            row.update(bytes=int(text.split()[0]), collected_at=iso(now))
        except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired):
            row['error'] = 'Directory size is unavailable; previous sample retained'
        result.append(row)
    return result


def systemd_job(item, old):
    row = {'name': item['name'], 'kind': 'systemd', 'category': item.get('category', 'maintenance'),
           'status': 'unknown', 'last_success_at': old.get('last_success_at'),
           'max_age_seconds': item.get('max_age_seconds', 86400)}
    try:
        p = systemd_properties(item)
        end = timestamp(p.get('ExecMainExitTimestamp'))
        started = timestamp(p.get('ExecMainStartTimestamp'))
        running = p.get('ActiveState') in ('activating', 'active') and (not end or (started and started > end))
        status = 'running' if running else ('success' if end and p.get('Result') == 'success' else ('failure' if end else 'unknown'))
        row.update(status=status, last_run_at=iso(started) if started else None,
                   completed_at=iso(end) if end else None)
        if end and p.get('Result') == 'success' and not running:
            row['last_success_at'] = iso(end)
        if status == 'failure':
            row['last_error'] = f"{p.get('Result', 'unknown')} (exit status {int(p.get('ExecMainStatus', '0'))})"
        if item.get('timer'):
            timer = systemd_properties(item, timer=True)
            next_at = timestamp(timer.get('NextElapseUSecRealtime'))
            row.update(next_run_at=iso(next_at) if next_at else None, timer_state=timer.get('ActiveState'))
    except (OSError, ValueError, RuntimeError, KeyError, subprocess.TimeoutExpired):
        row['error'] = 'Task state is unavailable'
    return row


def github_job(item, old, now, interval):
    checked = timestamp(old.get('checked_at'))
    if checked and now - checked < interval:
        return old
    row = {'name': item['name'], 'kind': 'github', 'category': item.get('category', 'maintenance'),
           'status': 'unknown', 'last_success_at': old.get('last_success_at'),
           'max_age_seconds': item.get('max_age_seconds', 86400), 'checked_at': iso(now)}
    try:
        # Fetch metadata only, never logs, artifacts, titles, secrets or env.
        args = ['/usr/bin/gh', 'run', 'list', '--repo', item['repository'], '--workflow', item['workflow'],
                '--json', 'status,conclusion,createdAt,updatedAt,url']
        env = dict(os.environ, GH_CONFIG_DIR='/root/.config/gh', GH_PROMPT_DISABLED='1', LC_ALL='C')
        runs = json.loads(command(args + ['--limit', '20'], env=env, timeout=20))
        if not runs:
            row['error'] = 'No workflow runs are available'
            return row
        latest = runs[0]
        conclusion = latest.get('conclusion')
        status = 'running' if latest['status'] != 'completed' else ('success' if conclusion == 'success' else 'failure')
        row.update(status=status, last_run_at=latest.get('createdAt'), completed_at=latest.get('updatedAt') if latest['status'] == 'completed' else None,
                   source_url=latest.get('url'))
        if status == 'failure':
            row['last_error'] = 'Workflow conclusion: ' + str(conclusion or 'unknown')
        success = next((r for r in runs if r.get('conclusion') == 'success'), None)
        if success is None:
            older = json.loads(command(args + ['--status', 'success', '--limit', '1'], env=env, timeout=20))
            success = older[0] if older else None
        if success:
            row['last_success_at'] = success['updatedAt']
    except (OSError, ValueError, RuntimeError, KeyError, subprocess.TimeoutExpired):
        row['error'] = 'Workflow metadata is unavailable'
    return row


def collect_databases(items):
    rows = []
    for item in items:
        row = {'name': item['name'], 'status': 'unknown', 'checked_at': iso(),
               'limit_bytes': item['limit_bytes']}
        started = time.monotonic()
        try:
            env = dict(os.environ, PGSERVICEFILE=item['service_file'],
                       PGCONNECT_TIMEOUT='5', PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=5000')
            query = "SELECT json_build_object('bytes', pg_database_size(current_database()), 'connections', (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()), 'tls', COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()), false))"
            data = json.loads(command(['/usr/bin/psql', '--no-psqlrc', '--no-password',
                                       '--dbname=service=' + item['service'], '-At', '-c', query], env=env, timeout=12))
            size = int(data['bytes'])
            if size < 0:
                raise ValueError('invalid size')
            percent = round(size / item['limit_bytes'] * 100, 2)
            row.update(bytes=size, available_bytes=max(0, item['limit_bytes']-size),
                       used_percent=percent, connections=int(data['connections']), tls=bool(data['tls']),
                       latency_ms=round((time.monotonic()-started)*1000),
                       status='failure' if percent >= 95 else ('warning' if percent >= 80 else 'healthy'))
        except (OSError, ValueError, TypeError, KeyError, RuntimeError, subprocess.TimeoutExpired):
            row['error'] = 'Database metrics are unavailable'
        rows.append(row)
    return rows


def retain_history(previous, point, now):
    valid = [p for p in previous if isinstance(p, dict) and (timestamp(p.get('at')) or 0) >= now - 86400
             and (timestamp(p.get('at')) or 0) < now]
    return (valid + [point])[-1441:]


def validate_config(config):
    for key in ('snapshot_file', 'state_file'):
        if not Path(config[key]).is_absolute():
            raise ValueError('output paths must be absolute')
    for item in config.get('directories', []):
        if not Path(item['path']).is_absolute():
            raise ValueError('directory paths must be absolute')
    ports = set()
    for item in config.get('tunnels', []):
        port = item['metrics_port']
        expected = item.get('expected_connections', 4)
        if type(port) is not int or not 1 <= port <= 65535 or port in ports:
            raise ValueError('invalid or duplicate tunnel metrics port')
        if type(expected) is not int or not 1 <= expected <= 100:
            raise ValueError('invalid expected connection count')
        if not isinstance(item['name'], str) or not item['name'].strip():
            raise ValueError('invalid tunnel name')
        if not isinstance(item.get('hostnames', []), list) or any(
                not isinstance(host, str) or not re.fullmatch(r'[A-Za-z0-9.-]{1,253}', host)
                for host in item.get('hostnames', [])):
            raise ValueError('invalid tunnel hostnames')
        ports.add(port)
    for item in config.get('databases', []):
        if not re.fullmatch(r'[A-Za-z0-9_-]+', item['service']) or not Path(item['service_file']).is_absolute():
            raise ValueError('invalid database service')
        if not isinstance(item['limit_bytes'], int) or item['limit_bytes'] <= 0:
            raise ValueError('invalid database capacity')
    for item in config.get('jobs', []):
        if item['kind'] not in ('systemd', 'github'):
            raise ValueError('unsupported task source')
        if item['kind'] == 'github' and (not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', item['repository']) or item['workflow'].startswith('-')):
            raise ValueError('invalid workflow configuration')


def collect(config):
    validate_config(config)
    state = read_json(config['state_file'], {})
    previous = read_json(config['snapshot_file'], {})
    now = time.time()
    container = collect_container()
    before = read_processes()
    cpu_before = cpu_counter()
    sample_at = time.monotonic()
    time.sleep(1)
    after = read_processes()
    cpu_after = cpu_counter()
    elapsed = time.monotonic() - sample_at
    cpu = None
    if cpu_before is not None and cpu_after is not None:
        cpu = round(max(0, cpu_after - cpu_before) / 1e6 / elapsed / container['effective_cpu_cores'] * 100, 2)
    directories = collect_directories(config.get('directories', []), previous.get('directories', []), now,
                                      config.get('directory_interval_seconds', 900))
    services = collect_services(config.get('units', []), previous.get('services', []))
    old_jobs = {r['name']: r for r in previous.get('jobs', [])}
    jobs = []
    for item in config.get('jobs', []):
        old = old_jobs.get(item['name'], {})
        jobs.append(systemd_job(item, old) if item['kind'] == 'systemd' else
                    github_job(item, old, now, config.get('github_interval_seconds', 300)))
    disk = shutil.disk_usage('/')
    limit = container['memory_limit_bytes'] or container['visible_memory_bytes']
    memory = container['memory_working_set_bytes']
    point = {'at': iso(now), 'cpu_percent': cpu,
             'memory_percent': round(memory / limit * 100, 2) if memory is not None and limit else None,
             'disk_percent': round(disk.used / disk.total * 100, 2), 'memory_bytes': memory,
             'disk_used_bytes': disk.used,
             'directory_bytes': {r['name']: r['bytes'] for r in directories if r.get('bytes') is not None}}
    history = retain_history(state.get('history', []), point, now)
    snapshot = {'schema_version': 1, 'enabled': True, 'collected_at': iso(), 'sample_at': iso(now),
                'sample_interval_seconds': config.get('sample_interval_seconds', 60),
                'services': services, 'processes': top_processes(before, after, elapsed),
                'container': container, 'tailscale': collect_tailscale() if config.get('tailscale', False) else None,
                'directories': directories, 'jobs': jobs, 'databases': collect_databases(config.get('databases', [])),
                'tunnels': collect_tunnels(config.get('tunnels', [])), 'history': history}
    atomic_json(config['snapshot_file'], snapshot, 0o640)
    atomic_json(config['state_file'], {'history': history})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True, help='Private configuration outside the checkout')
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    # One lock per state file, shared by manual runs and the timer.
    with open(str(config['state_file']) + '.lock', 'w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        collect(config)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Never echo private config, command output or exception contents.
        raise SystemExit('Telemetry collection failed; check configuration and local permissions')
