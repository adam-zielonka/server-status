// Node >=24 strips the validator's TypeScript types; no build or private data output.
import process from 'node:process'
import console from 'node:console'
import { readFileSync } from 'node:fs'
import { validEndpoint } from '../src/lib/validation.ts'

let valid = false
try {
  valid =
    process.argv.length === 3 &&
    validEndpoint('telemetry', JSON.parse(readFileSync(process.argv[2], 'utf8')))
} catch {
  // Do not expose filenames, snapshot contents or parser errors.
}
console.log(valid ? 'PASS' : 'FAIL')
process.exitCode = valid ? 0 : 1
