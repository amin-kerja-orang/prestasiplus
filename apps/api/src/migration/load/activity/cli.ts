/**
 * Entry of `npm run migrate:activity -w @pp/api -- <flags>`: the kit CLI with the BE-29 command registered.
 * Exit codes are the kit's (0 ok, 1 failed or reconciliation mismatch, 2 usage / guard / preflight,
 * 3 apply refused, 4 busy).
 */
import { runCli } from '../../cli'
import './command'

process.exitCode = await runCli(['migrate:activity', ...process.argv.slice(2)])
