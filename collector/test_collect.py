import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('collector', Path(__file__).with_name('collect.py'))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class CollectorTests(unittest.TestCase):
    tunnel = {'name': 'Example tunnel', 'metrics_port': 20241, 'hostnames': ['app.example.com']}

    def test_tunnel_metrics_excludes_inactive_locations_and_private_labels(self):
        metrics = '''cloudflared_tunnel_ha_connections 4
cloudflared_tunnel_total_requests 12
cloudflared_tunnel_request_errors 2
cloudflared_tunnel_server_locations{connection_id="private-id",edge_location="ams01"} 1
cloudflared_tunnel_server_locations{connection_id="old-id",edge_location="fra01"} 0
unrelated_metric{token="never-export"} 99
'''
        with patch.object(collector, 'tunnel_http', side_effect=[(200, metrics), (200, 'ready')]):
            row = collector.collect_tunnels([self.tunnel])[0]
        self.assertEqual(row['status'], 'healthy')
        self.assertEqual(row['locations'], ['ams01'])
        self.assertEqual(row['connections'], 4)
        self.assertEqual(row['request_errors'], 2)
        for forbidden in ['private-id', 'old-id', 'never-export', 'metrics_port']:
            self.assertNotIn(forbidden, json.dumps(row))

    def test_tunnel_distinguishes_degraded_and_disconnected(self):
        for connections, ready, expected in [(2, 200, 'degraded'), (0, 503, 'failure'), (4, 503, 'failure')]:
            with self.subTest(connections=connections, ready=ready):
                with patch.object(collector, 'tunnel_http', side_effect=[
                        (200, f'cloudflared_tunnel_ha_connections {connections}'), (ready, '')]):
                    row = collector.collect_tunnels([self.tunnel])[0]
                self.assertEqual(row['status'], expected)

    def test_unreachable_metrics_do_not_report_zero_or_leak_errors(self):
        with patch.object(collector, 'tunnel_http', side_effect=OSError('private-details')):
            row = collector.collect_tunnels([self.tunnel])[0]
        self.assertEqual(row['status'], 'unknown')
        self.assertNotIn('connections', row)
        self.assertNotIn('private-details', json.dumps(row))

    def test_tunnel_invalid_metrics_and_readiness_are_unknown(self):
        for metrics, ready in [('other_metric 4', 200), ('cloudflared_tunnel_ha_connections NaN', 200),
                               ('cloudflared_tunnel_ha_connections -1', 200),
                               ('cloudflared_tunnel_ha_connections 0', 200),
                               ('cloudflared_tunnel_ha_connections 4', 302)]:
            with self.subTest(metrics=metrics, ready=ready):
                with patch.object(collector, 'tunnel_http', side_effect=[(200, metrics), (ready, '')]):
                    row = collector.collect_tunnels([self.tunnel])[0]
                self.assertEqual(row['status'], 'unknown')
                self.assertNotIn('connections', row)

    def test_tunnel_metrics_connection_is_loopback_and_does_not_follow_redirects(self):
        with patch.object(collector.http.client, 'HTTPConnection') as connection:
            response = connection.return_value.getresponse.return_value
            response.status = 302
            response.read.return_value = b''
            self.assertEqual(collector.tunnel_http(20241, '/metrics'), (302, ''))
            connection.assert_called_once_with('127.0.0.1', 20241, timeout=2)
            connection.return_value.request.assert_called_once_with('GET', '/metrics')
            response.read.return_value = b'x' * 262145
            with self.assertRaises(ValueError):
                collector.tunnel_http(20241, '/metrics')

    def test_tunnel_config_rejects_invalid_or_duplicate_ports(self):
        base = {'snapshot_file': '/private/snapshot', 'state_file': '/private/state'}
        for items in [[{**self.tunnel, 'metrics_port': 'https://example.com'}],
                      [{**self.tunnel, 'metrics_port': True}], [self.tunnel, self.tunnel],
                      [{**self.tunnel, 'expected_connections': 0}],
                      [{**self.tunnel, 'hostnames': ['https://example.com/private']}]]:
            with self.subTest(items=items), self.assertRaises(ValueError):
                collector.validate_config({**base, 'tunnels': items})

    def test_process_identity_and_pid_reuse(self):
        first = {10: {'name': 'worker', 'start': 1, 'ticks': 100, 'rss_bytes': 1}}
        second = {10: {'name': 'worker', 'start': 2, 'ticks': 10000, 'rss_bytes': 2}}
        row = collector.top_processes(first, second, 1)['top_cpu'][0]
        self.assertIsNone(row['cpu_percent'])
        self.assertNotIn('cmdline', row)
        self.assertEqual(row['instance_pid'], 10)

    def test_browser_instances_are_separate_and_include_small_children(self):
        def proc(parent, start, rss, executable='chrome-headless-shell'):
            return {'name': 'chrome-headless', 'ppid': parent, 'start': start,
                    'ticks': 100, 'rss_bytes': rss, 'executable': executable,
                    'service': None}
        processes = {1: proc(0, 1, 1, 'init'), 10: proc(1, 10, 100),
                     11: proc(10, 11, 200), 12: proc(11, 12, 1),
                     20: proc(1, 20, 400), 21: proc(20, 21, 5)}
        result = collector.top_processes(processes, processes, 1)
        groups = {r['pid']: r for r in result['groups_memory']}
        self.assertEqual(groups[10]['rss_bytes'], 301)
        self.assertEqual(groups[10]['process_count'], 3)
        self.assertEqual(groups[20]['rss_bytes'], 405)
        self.assertEqual(groups[20]['process_count'], 2)
        self.assertEqual(groups[10]['browser_instance_count'], 1)
        child = next(r for r in result['top_memory'] if r['pid'] == 12)
        self.assertEqual(child['instance_pid'], 10)
        self.assertEqual(child['ppid'], 11)
        self.assertEqual(child['parent_name'], 'chrome-headless-shell')
        del processes[11]
        orphan = collector.top_processes(processes, processes, 1)
        self.assertEqual(next(r for r in orphan['top_memory'] if r['pid'] == 12)['instance_pid'], 12)

    def test_group_cpu_is_sum_and_unknown_for_incomplete_samples(self):
        def proc(parent, ticks):
            return {'name': 'chrome', 'executable': 'chrome', 'ppid': parent,
                    'start': 1, 'ticks': ticks, 'rss_bytes': 1}
        first = {10: proc(0, 0), 11: proc(10, 0)}
        second = {10: proc(0, 10), 11: proc(10, 20)}
        group = collector.top_processes(first, second, 1)['groups_cpu'][0]
        self.assertAlmostEqual(group['cpu_percent'], 30 / collector.os.sysconf('SC_CLK_TCK') * 100)
        del first[11]
        self.assertIsNone(collector.top_processes(first, second, 1)['groups_cpu'][0]['cpu_percent'])
        second[10]['ppid'] = 11  # A malformed cycle must terminate.
        collector.top_processes(first, second, 1)

    def test_service_groups_include_browser_instances_once(self):
        def proc(parent, start, exe, service='example.service', scope='system/example.service'):
            return {'name': exe, 'executable': exe, 'ppid': parent, 'start': start,
                    'ticks': 0, 'rss_bytes': 10, 'service': service, 'service_key': scope}
        processes = {10: proc(1, 10, 'node'), 11: proc(10, 11, 'sh'),
                     12: proc(11, 12, 'python'), 20: proc(10, 20, 'chrome'),
                     21: proc(20, 21, 'chrome'), 30: proc(10, 30, 'chrome'),
                     40: proc(1, 40, 'node', scope='user/example.service')}
        result = collector.top_processes(processes, processes, 1)
        groups = {g['pid']: g for g in result['groups_memory']}
        self.assertEqual(set(groups), {10, 40})
        self.assertEqual(groups[10]['name'], 'example.service')
        self.assertEqual(groups[10]['rss_bytes'], 60)
        self.assertEqual(groups[10]['process_count'], 6)
        self.assertEqual(groups[10]['group_kind'], 'service')
        self.assertEqual(groups[10]['browser_instance_count'], 2)
        child = next(r for r in result['top_memory'] if r['pid'] == 21)
        self.assertEqual(child['instance_pid'], 10)
        self.assertEqual(child['browser_instance_pid'], 20)
        members = [pid for g in groups.values() for pid in g['member_pids']]
        self.assertEqual(sorted(members), sorted(processes))
        self.assertTrue(all('service_key' not in r for r in result['top_memory']))

    def test_browser_without_service_joins_launching_application(self):
        def proc(parent, start, exe):
            return {'name': exe, 'executable': exe, 'ppid': parent, 'start': start,
                    'ticks': 0, 'rss_bytes': 10}
        processes = {10: proc(1, 10, 'node'), 20: proc(10, 20, 'chrome'),
                     21: proc(20, 21, 'chrome'), 30: proc(10, 30, 'chrome'),
                     40: proc(1, 40, 'chrome')}
        groups = {g['pid']: g for g in collector.top_processes(processes, processes, 1)['groups_memory']}
        self.assertEqual(set(groups), {10, 40})
        self.assertEqual(groups[10]['rss_bytes'], 40)
        self.assertEqual(groups[10]['browser_instance_count'], 2)
        self.assertEqual(groups[40]['group_kind'], 'browser')
        del processes[10]
        groups = collector.top_processes(processes, processes, 1)['groups_memory']
        self.assertEqual(len(groups), 3)

    def test_no_service_groups_only_related_equal_executables(self):
        def proc(parent, start, exe):
            return {'name': exe, 'executable': exe, 'ppid': parent, 'start': start,
                    'ticks': 0, 'rss_bytes': 10}
        processes = {10: proc(1, 10, 'postgres'), 11: proc(10, 11, 'postgres'),
                     20: proc(1, 20, 'postgres'), 30: proc(10, 30, 'python')}
        groups = {g['pid']: g for g in collector.top_processes(processes, processes, 1)['groups_memory']}
        self.assertEqual(groups[10]['process_count'], 2)
        self.assertEqual(set(groups), {10, 20, 30})
        processes[10]['executable'] = None
        groups = collector.top_processes(processes, processes, 1)['groups_memory']
        self.assertEqual(len(groups), 4)

    def test_complete_rankings_and_group_members_have_no_top_n_limit(self):
        def proc(pid, service=None):
            return {'name': 'worker', 'executable': 'worker', 'ppid': 1,
                    'start': pid, 'ticks': 0, 'rss_bytes': pid, 'service': service}
        processes = {pid: proc(pid, 'example.service') for pid in range(10, 135)}
        processes.update({pid: proc(pid) for pid in range(200, 215)})
        result = collector.top_processes(processes, processes, 1)
        self.assertEqual(len(result['top_cpu']), 140)
        self.assertEqual(len(result['top_memory']), 140)
        self.assertEqual(len(result['groups_memory']), 16)
        self.assertEqual(len(result['groups_cpu']), 16)
        group = next(g for g in result['groups_memory'] if g['group_kind'] == 'service')
        self.assertEqual(len(group['member_pids']), 125)
        self.assertEqual(group['process_count'], 125)
        self.assertEqual(group['rss_bytes'], sum(range(10, 135)))
        self.assertEqual(set(group['member_pids']), set(range(10, 135)))
        self.assertEqual(result['top_memory'][0]['pid'], 214)
        self.assertEqual(result['top_memory'][-1]['pid'], 10)

    def test_process_names_with_parentheses(self):
        fields = ['S'] + ['0'] * 21
        fields[11], fields[12], fields[19], fields[21] = '10', '5', '123', '2'
        stat = collector.proc_stat('42 (example (worker)) ' + ' '.join(fields))
        self.assertEqual(stat['name'], 'example (worker)')
        self.assertEqual(stat['ticks'], 15)
        self.assertEqual(stat['start'], 123)

    def test_cpu_core_ranges(self):
        self.assertEqual(collector.cpuset_count('0-3,8,10-11'), 7)
        self.assertEqual(collector.cpuset_count(''), 0)

    def test_history_retention_and_no_fabricated_samples(self):
        now = 100000
        rows = [{'at': collector.iso(1)}, {'at': collector.iso(now-60)}, {'at': collector.iso(now+5)}]
        point = {'at': collector.iso(now), 'cpu_percent': None}
        self.assertEqual(collector.retain_history(rows, point, now), [rows[1], point])

    def test_atomic_snapshot_permissions_and_no_partial_write(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'snapshot.json'
            collector.atomic_json(path, {'generation': 1}, 0o640)
            with self.assertRaises(ValueError):
                collector.atomic_json(path, {'value': float('nan')})
            self.assertEqual(json.loads(path.read_text()), {'generation': 1})
            self.assertEqual(path.stat().st_mode & 0o777, 0o640)
            self.assertEqual(len(list(Path(directory).iterdir())), 1)

    def test_tailscale_exports_no_peers_keys_users_or_proxy_targets(self):
        status = {'BackendState': 'Running', 'TailscaleIPs': ['100.64.0.10'],
                  'Self': {'Online': True, 'HostName': 'example-node', 'KeyExpiry': '0001-01-01T00:00:00Z', 'PrivateKey': 'do-not-export'},
                  'Peer': {'private-peer': {}}, 'User': {'private-user': {}}}
        serve = {'Web': {'example-node.example.ts.net:443': {'Handlers': {'/': {'Proxy': 'http://private-target'}}}}}
        with patch.object(collector, 'command', side_effect=[json.dumps(status), json.dumps(serve)]):
            result = collector.collect_tailscale()
        body = json.dumps(result)
        for forbidden in ('do-not-export', 'private-peer', 'private-user', 'private-target'):
            self.assertNotIn(forbidden, body)
        self.assertIsNone(result['expires_at'])

    def test_cli_errors_do_not_expose_output(self):
        class Result:
            returncode = 1
            stdout = 'private-token'
            stderr = 'private-password'
        with patch.object(collector.subprocess, 'run', return_value=Result()):
            with self.assertRaises(RuntimeError) as context:
                collector.command(['example'])
        self.assertNotIn('private', str(context.exception))

    def test_inactive_oneshot_success_is_not_failure(self):
        props = {'ExecMainStartTimestamp': 'Mon 2026-01-05 01:00:00 UTC',
                 'ExecMainExitTimestamp': 'Mon 2026-01-05 01:01:00 UTC',
                 'ActiveState': 'inactive', 'Result': 'success'}
        with patch.object(collector, 'systemd_properties', return_value=props):
            row = collector.systemd_job({'name': 'Maintenance', 'unit': 'example.service'}, {})
        self.assertEqual(row['status'], 'success')
        self.assertEqual(row['last_success_at'], '2026-01-05T01:01:00+00:00')

    def test_failed_job_retains_known_success(self):
        props = {'ExecMainExitTimestamp': 'Mon 2026-01-05 01:01:00 UTC', 'ActiveState': 'failed', 'Result': 'exit-code', 'ExecMainStatus': '1'}
        with patch.object(collector, 'systemd_properties', return_value=props):
            row = collector.systemd_job({'name': 'Maintenance', 'unit': 'example.service'}, {'last_success_at': '2026-01-04T00:00:00Z'})
        self.assertEqual(row['status'], 'failure')
        self.assertEqual(row['last_success_at'], '2026-01-04T00:00:00Z')

    def test_github_selects_only_metadata(self):
        runs = [{'status': 'completed', 'conclusion': 'failure', 'updatedAt': '2026-01-05T01:00:00Z', 'createdAt': '2026-01-05T00:00:00Z', 'url': 'https://github.com/example/project/actions/runs/2', 'secret': 'do-not-export'},
                {'status': 'completed', 'conclusion': 'success', 'updatedAt': '2026-01-04T01:00:00Z'}]
        with patch.object(collector, 'command', return_value=json.dumps(runs)):
            row = collector.github_job({'name': 'Backup', 'repository': 'example/project', 'workflow': 'backup.yml'}, {}, 100000, 300)
        self.assertEqual(row['status'], 'failure')
        self.assertEqual(row['last_success_at'], '2026-01-04T01:00:00Z')
        self.assertNotIn('do-not-export', json.dumps(row))

    def test_directory_scan_failure_does_not_report_zero(self):
        with patch.object(collector, 'command', side_effect=RuntimeError()):
            row = collector.collect_directories([{'name': 'Data', 'path': '/srv/example'}], [], 1000, 900)[0]
        self.assertIsNone(row['bytes'])
        self.assertIn('error', row)

    def test_invalid_unit_cannot_be_used_as_command_option(self):
        with self.assertRaises(ValueError):
            collector.systemd_properties({'unit': '--help'})

    def test_database_capacity_and_no_secrets(self):
        item = {'name': 'Shared database', 'service': 'example', 'service_file': '/private/services.conf', 'limit_bytes': 200_000_000}
        with patch.object(collector, 'command', return_value=json.dumps({'bytes': 170_000_000, 'connections': 3, 'tls': True, 'password': 'never-export'})) as query:
            row = collector.collect_databases([item])[0]
        self.assertEqual(row['status'], 'warning')
        self.assertEqual(row['used_percent'], 85)
        self.assertEqual(row['available_bytes'], 30_000_000)
        self.assertTrue(row['tls'])
        self.assertNotIn('never-export', json.dumps(row))
        self.assertIn('default_transaction_read_only=on', query.call_args.kwargs['env']['PGOPTIONS'])

    def test_failed_database_does_not_report_zero_usage(self):
        item = {'name': 'Database', 'service': 'example', 'service_file': '/private/service', 'limit_bytes': 200_000_000}
        with patch.object(collector, 'command', side_effect=RuntimeError('private-message')):
            row = collector.collect_databases([item])[0]
        self.assertEqual(row['status'], 'unknown')
        self.assertNotIn('bytes', row)
        self.assertNotIn('private-message', json.dumps(row))


if __name__ == '__main__':
    unittest.main()
