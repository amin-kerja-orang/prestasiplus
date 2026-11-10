/**
 * Entry of `migrate:structured`: the kit CLI with the structured/subjective/canonical loader registered.
 * Exit codes are the kit's (0 ok, 1 failed or reconciliation mismatch, 2 usage / guard, 3 apply refused, 4 busy).
 */
import { runCli } from '../../cli'
import './structured-command'

process.exitCode = await runCli(['migrate:structured', ...process.argv.slice(2)])
