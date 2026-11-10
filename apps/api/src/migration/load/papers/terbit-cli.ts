/**
 * Entry of `migrate:terbit`: the kit CLI with the Terbit command registered. Built as `dist/migrate-terbit.js` by `vite.build.terbit.config.ts`
 * (SWC, decorator metadata on) and run with node; do not run it with tsx (Nest cannot resolve its providers without the metadata).
 * Exit codes are the kit's (0 ok, 1 failed, 2 usage / guard, 3 apply refused, 4 busy).
 */
import { runCli } from '../../cli'
import './terbit-command'

process.exitCode = await runCli(['migrate:terbit', ...process.argv.slice(2).filter((a) => a !== '--')])
