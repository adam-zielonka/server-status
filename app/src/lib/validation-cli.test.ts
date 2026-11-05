import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { expect, it } from 'vitest'
import { demoTelemetry } from './demo'

it('validates a file without exposing private values or parser errors', () => {
  const dir = mkdtempSync(join(tmpdir(), 'telemetry-validator-'))
  const path = join(dir, 'private.json')
  const run = (args: string[]) =>
    spawnSync(process.execPath, ['scripts/validate-telemetry.mjs', ...args], { encoding: 'utf8' })
  try {
    writeFileSync(path, JSON.stringify(demoTelemetry()))
    expect(run([path])).toMatchObject({ status: 0, stdout: 'PASS\n', stderr: '' })
    for (const content of [
      'private incomplete JSON',
      '{"private":"secret"}',
      JSON.stringify({
        ...demoTelemetry(),
        jobs: [
          {
            name: 'private task',
            kind: 'systemd',
            status: 'success',
            last_success_at: { toString: 0 },
          },
        ],
      }),
    ]) {
      writeFileSync(path, content)
      expect(run([path])).toMatchObject({ status: 1, stdout: 'FAIL\n', stderr: '' })
    }
    for (const args of [[], [join(dir, 'missing.json')], [path, path]])
      expect(run(args)).toMatchObject({ status: 1, stdout: 'FAIL\n', stderr: '' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
