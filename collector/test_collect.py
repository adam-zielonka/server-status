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
    def test_process_identity_and_pid_reuse(self):
        first = {10: {'name': 'worker', 'start': 1, 'ticks': 100, 'rss_bytes': 1}}
        second = {10: {'name': 'worker', 'start': 2, 'ticks': 10000, 'rss_bytes': 2}}
        row = collector.top_processes(first, second, 1)['top_cpu'][0]
        self.assertIsNone(row['cpu_percent'])
        self.assertEqual(set(row), {'pid', 'name', 'rss_bytes', 'cpu_percent'})

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


if __name__ == '__main__':
    unittest.main()
