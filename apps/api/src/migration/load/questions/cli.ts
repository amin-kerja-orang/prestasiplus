/**
 * Entry of `npm run migrate:questions -w @pp/api -- <flags>`: the kit CLI with the QLOAD command registered.
 * Exit codes are the kit's (0 ok, 1 failed or reconciliation mismatch, 2 usage / guard, 3 apply refused, 4 busy).
 */
import { runCli } from '../../cli'
import './command'

process.exitCode = await runCli(['migrate:questions', ...process.argv.slice(2)])
