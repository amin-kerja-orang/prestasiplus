/**
 * Entry of `npm run migrate:repair-stimuli -w @pp/api -- <flags>`: the kit CLI with the stimulus repair registered.
 * Exit codes are the kit's (0 ok, 1 failed, 2 usage / guard, 3 apply refused, 4 busy).
 */
import { runCli } from '../../cli'
import './repair-stimuli-command'

process.exitCode = await runCli(['migrate:repair-stimuli', ...process.argv.slice(2)])
