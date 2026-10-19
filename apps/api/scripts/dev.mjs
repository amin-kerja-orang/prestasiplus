// `npm run be:dev`: rebuilds dist/main.js on change (vite --watch) and restarts the server
// (node --watch). Reads ../../.env.api when present. Stops both children on exit.
import { spawn } from 'node:child_process'

const children = []
const run = (cmd, args, env = {}) => {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  })
  children.push(child)
  child.on('exit', (code) => {
    if (code) process.exitCode = code
    stop()
  })
}
const stop = () => children.forEach((c) => c.exitCode === null && c.kill())

process.on('SIGINT', stop)
process.on('SIGTERM', stop)

run('npx', ['vite', 'build', '--config', 'vite.build.config.ts', '--watch'])
// Wait for the first build, then run the app with auto restart.
setTimeout(
  () =>
    run('node', ['--watch', '--env-file-if-exists=../../.env.api', 'dist/main.js'], {
      NODE_ENV: process.env.NODE_ENV ?? 'development',
    }),
  4000,
)
