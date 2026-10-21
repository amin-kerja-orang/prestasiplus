import { type ChildProcess, spawn } from 'node:child_process'
import { Agent, request as httpRequest } from 'node:http'
import { createRequire } from 'node:module'
import { connect } from 'node:net'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

// Run tsx through the current Node binary: `node_modules/.bin/tsx` is a shell script, which spawn cannot start on Windows.
const TSX_CLI = createRequire(import.meta.url).resolve('tsx/cli')
const CHILD = fileURLToPath(new URL('./fixtures/shutdown-child.ts', import.meta.url))
const API_DIR = fileURLToPath(new URL('../..', import.meta.url))

interface Child {
  proc: ChildProcess
  port: number
  output: string[]
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>
}

const running: ChildProcess[] = []
afterEach(() => {
  for (const p of running.splice(0)) if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL')
})

async function startChild(env: Record<string, string> = {}): Promise<Child> {
  const proc = spawn(process.execPath, [TSX_CLI, CHILD], { cwd: API_DIR, env: { ...process.env, NODE_ENV: 'test', ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  running.push(proc)
  const output: string[] = []
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => proc.once('exit', (code, signal) => resolve({ code, signal })))
  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`child did not start: ${output.join('')}`)), 20_000)
    proc.stdout!.on('data', (chunk: Buffer) => {
      output.push(chunk.toString())
      const m = /listening (\d+)/.exec(output.join(''))
      if (m) {
        clearTimeout(timer)
        resolve(Number(m[1]))
      }
    })
    proc.stderr!.on('data', (chunk: Buffer) => output.push(chunk.toString()))
    proc.once('exit', () => reject(new Error(`child exited early: ${output.join('')}`)))
  })
  return { proc, port, output, exited }
}

function get(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, agent: false }, (res) => {
      let body = ''
      res.on('data', (c: Buffer) => (body += c.toString()))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = connect({ host: '127.0.0.1', port }, () => {
      s.destroy()
      resolve(true)
    })
    s.on('error', () => resolve(false))
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// POSIX only: on Windows `kill('SIGTERM')` terminates the child at once (TerminateProcess), so no handler can drain.
// CI (Linux) runs these.
describe.skipIf(process.platform === 'win32')('graceful shutdown (BE-33 AC5)', () => {
  it('SIGTERM lets the in-flight request finish with 200 and the full body, runs the module destroy hooks and exits 0', async () => {
    const child = await startChild({ SLOW_MS: '800' })
    const inFlight = get(child.port, '/slow')
    await sleep(250) // the request is now being handled
    child.proc.kill('SIGTERM')
    const res = await inFlight
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ data: { done: true, waitedMs: 800 } })
    const exit = await child.exited
    expect(exit).toEqual({ code: 0, signal: null })
    const out = child.output.join('')
    expect(out).toContain('SIGTERM received')
    expect(out).toContain('module-destroyed')
    // Modules are destroyed only after the in-flight response was delivered: destroy is the last thing printed.
    expect(out.indexOf('SIGTERM received')).toBeLessThan(out.indexOf('module-destroyed'))
  }, 30_000)

  it('refuses new connections after SIGTERM while the in-flight request is still draining', async () => {
    const child = await startChild({ SLOW_MS: '1200' })
    const inFlight = get(child.port, '/slow')
    await sleep(250)
    child.proc.kill('SIGTERM')
    await sleep(250)
    expect(await canConnect(child.port)).toBe(false)
    expect((await inFlight).status).toBe(200)
    expect((await child.exited).code).toBe(0)
  }, 30_000)

  it('exits 1 after the grace period when a request never finishes', async () => {
    const child = await startChild({ GRACE_MS: '1000' })
    const hung = get(child.port, '/hang').catch(() => null)
    await sleep(250)
    child.proc.kill('SIGTERM')
    const exit = await child.exited
    expect(exit.code).toBe(1)
    await hung
  }, 30_000)

  it('exits 0 promptly when only an idle keep-alive connection (a finished request) is open', async () => {
    const child = await startChild()
    const agent = new Agent({ keepAlive: true, maxSockets: 1 })
    const status = await new Promise<number>((resolve, reject) => {
      httpRequest({ host: '127.0.0.1', port: child.port, path: '/slow', agent }, (res) => {
        res.resume()
        res.on('end', () => resolve(res.statusCode ?? 0))
      })
        .on('error', reject)
        .end()
    })
    expect(status).toBe(200)
    await sleep(100) // the socket is now idle but still open
    child.proc.kill('SIGTERM')
    const started = Date.now()
    expect((await child.exited).code).toBe(0)
    expect(Date.now() - started).toBeLessThan(3000) // well below the 5 s grace of the fixture
    agent.destroy()
  }, 30_000)
})
