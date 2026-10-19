import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'

import { CloudSourceConnectError } from '../../../src/migration/cloud-source'
import { runStagingCli, STAGING_EXIT } from '../../../src/migration/staging/cli'
import { scrub, scrubbingLogger, secretsFromUrl } from '../../../src/migration/staging/log'
import { withDatabase } from '../../support/global-setup'
import { capture, REPO_ROOT, tempDir, type TempDir } from './helpers'

vi.setConfig({ testTimeout: 60_000 })

const FAKE_PASSWORD = 'Fx!Pass/word:9@fake'
const FAKE_USER = 'leaky_user_fixture'

describe('no connection string or credential in logs (AC5)', () => {
  const spies: ReturnType<typeof vi.spyOn>[] = []
  afterEach(() => {
    for (const s of spies.splice(0)) s.mockRestore()
  })

  const run = async (cloudUrl: string, argv: string[] = ['staging:load']) => {
    const io = capture()
    const consoleLines: string[] = []
    for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      spies.push(vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void consoleLines.push(a.join(' '))))
    }
    const stdout: string[] = []
    spies.push(vi.spyOn(process.stdout, 'write').mockImplementation(((c: unknown) => (stdout.push(String(c)), true)) as never))
    const code = await runStagingCli(argv, {
      env: { DATABASE_URL: 'postgresql://target_user:target_pw_fixture@127.0.0.1:1/target', CLOUD_SOURCE_URL: cloudUrl },
      pool: { connect: async () => { throw new Error('the target pool must not be used') }, end: async () => undefined } as never,
      out: io.out,
      err: io.err,
    })
    for (const s of spies.splice(0)) s.mockRestore()
    return { code, text: [io.text(), ...consoleLines, ...stdout].join('\n') }
  }

  const encoded = `postgresql://${FAKE_USER}:${encodeURIComponent(FAKE_PASSWORD)}`

  it('does not print the URL, user or password when the host is unreachable', async () => {
    const { code, text } = await run(`${encoded}@127.0.0.1:1/clouddb`)
    expect(code).toBe(STAGING_EXIT.failed)
    expect(text).toMatch(/Could not connect to the cloud source/)
    for (const secret of [FAKE_PASSWORD, encodeURIComponent(FAKE_PASSWORD), FAKE_USER, '127.0.0.1:1', 'clouddb', 'target_pw_fixture']) {
      expect(text, secret).not.toContain(secret)
    }
  })

  it('does not print them when the server rejects the login or the role can write', async () => {
    const adminUrl = inject('testDbAdminUrl')
    if (!adminUrl) throw new Error('Test database unavailable.')
    const u = new URL(withDatabase(adminUrl, 'postgres'))
    u.username = FAKE_USER
    u.password = FAKE_PASSWORD
    const { code, text } = await run(u.toString())
    // A wrong password is a connect failure (1); a server that trusts everyone then refuses the write-capable role (3).
    expect([STAGING_EXIT.failed, STAGING_EXIT.sourceRefused]).toContain(code)
    for (const secret of [FAKE_PASSWORD, encodeURIComponent(FAKE_PASSWORD), FAKE_USER, u.host]) {
      expect(text, secret).not.toContain(secret)
    }
  })

  it('does not echo a malformed URL passed as the source', async () => {
    const { code, text } = await run(`${FAKE_USER}:${FAKE_PASSWORD}-not-a-url`)
    expect(code).toBe(STAGING_EXIT.failed)
    expect(text).not.toContain(FAKE_PASSWORD)
  })

  it('scrub removes URLs, passwords and user names wherever they appear', () => {
    const url = `postgresql://${FAKE_USER}:${encodeURIComponent(FAKE_PASSWORD)}@db.example.invalid:5432/x`
    const secrets = secretsFromUrl(url)
    expect(secrets).toContain(FAKE_PASSWORD)
    const line = `connect ECONNREFUSED ${url} (user ${FAKE_USER}) pw=${FAKE_PASSWORD}; also mysql://a:b@h/db`
    const cleaned = scrub(line, secrets)
    for (const s of [FAKE_PASSWORD, FAKE_USER, 'db.example.invalid', 'a:b@h']) expect(cleaned).not.toContain(s)
    const sink: string[] = []
    scrubbingLogger({ out: (l) => sink.push(l), err: (l) => sink.push(l) }, secrets).warn(`leak ${FAKE_PASSWORD}`)
    expect(sink).toEqual(['leak [redacted]'])
    expect(new CloudSourceConnectError('x')).toBeInstanceOf(Error)
  })

  it('the shipped docs and source carry no connection string with credentials', () => {
    const files = [
      'docs/architecture/v2-migration-runbook.md',
      'apps/api/src/migration/ddl/staging_cloud.sql',
      'apps/api/src/migration/cloud-source.ts',
      'apps/api/src/migration/staging/cli.ts',
    ]
    for (const f of files) {
      expect(readFileSync(join(REPO_ROOT, f), 'utf8'), f).not.toMatch(/\b(?:postgres(?:ql)?|mysql):\/\/[^\s/@:]+:[^\s/@]+@/i)
    }
  })
})

describe('git guards for dumps and reports (AC4, BE-NFR-13)', () => {
  it.each([
    '.migration-out/profile-2026-10-19.md',
    'apps/api/.migration-out/profile-2026-10-19.json',
    'staging.dump',
    'apps/api/anonymised.sql.gz',
  ])('git ignores %s', (path) => {
    const res = spawnSync('git', ['check-ignore', '-q', '--', path], { cwd: REPO_ROOT })
    expect(res.status, `git check-ignore ${path}`).toBe(0)
  })

  it('does not ignore the committed fixture and DDL', () => {
    for (const path of ['apps/api/test/migration/fixtures/cloud-tiny/users.ndjson', 'apps/api/src/migration/ddl/staging_cloud.sql']) {
      expect(spawnSync('git', ['check-ignore', '-q', '--', path], { cwd: REPO_ROOT }).status, path).toBe(1)
    }
  })

  describe('the CI guard step of .github/workflows/api.yml', () => {
    const bash = spawnSync('bash', ['--version'])
    const hasBash = bash.status === 0
    let repo: TempDir

    function guardScript(): string {
      const yml = readFileSync(join(REPO_ROOT, '.github/workflows/api.yml'), 'utf8').replace(/\r\n/g, '\n')
      const m = /- name: Guard - no dumps[^\n]*\n\s+run: \|\n((?:\s{10}[^\n]*\n)+)/.exec(yml)
      if (!m) throw new Error('Guard step not found in api.yml')
      return (m[1] as string).split('\n').map((l) => l.slice(10)).join('\n')
    }

    beforeEach(() => {
      repo = tempDir('pp-guard-')
      spawnSync('git', ['init', '-q'], { cwd: repo.path })
    })
    afterEach(() => repo.cleanup())

    const runGuard = () => {
      const script = join(repo.path, '.guard.sh')
      writeFileSync(script, guardScript())
      return spawnSync('bash', [script], { cwd: repo.path, encoding: 'utf8' })
    }
    const stage = (path: string, content: string | Buffer) => {
      mkdirSync(join(repo.path, path, '..'), { recursive: true })
      writeFileSync(join(repo.path, path), content)
      spawnSync('git', ['add', '-f', '--', path], { cwd: repo.path })
    }

    it.runIf(hasBash)('passes on a clean tree with a small fixture', () => {
      stage('apps/api/test/migration/fixtures/cloud-tiny/users.ndjson', '{"id":1}\n')
      expect(runGuard().status).toBe(0)
    })

    it.runIf(hasBash).each([
      ['a .dump file', 'data/staging.dump', 'x'],
      ['a .sql.gz file', 'data/anonymised.sql.gz', 'x'],
      ['a file under .migration-out/', '.migration-out/profile-2026-10-19.md', 'x'],
      ['a nested .migration-out/ file', 'apps/api/.migration-out/profile.json', 'x'],
    ])('fails when %s is staged', (_label, path, content) => {
      stage(path, content)
      const res = runGuard()
      expect(res.status).toBe(1)
      expect(res.stdout).toContain('Forbidden files are tracked')
    })

    it.runIf(hasBash)('fails when a file over 1 MB is staged under apps/api/test/migration/', () => {
      stage('apps/api/test/migration/fixtures/big.ndjson', Buffer.alloc(1024 * 1024 + 1, 97))
      expect(runGuard().status).toBe(1)
    })
  })
})

describe('runbook (AC6)', () => {
  const runbook = () => readFileSync(join(REPO_ROOT, 'docs/architecture/v2-migration-runbook.md'), 'utf8')

  it('states that dumps are not committed, not attached to PRs, and deleted after the rehearsal', () => {
    const text = runbook().replace(/\s+/g, ' ')
    expect(text).toMatch(/Dumps are not committed/)
    expect(text).toMatch(/not attached to pull requests/)
    expect(text).toMatch(/deleted after the rehearsal/)
  })

  it('documents the commands and the dump format', () => {
    const text = runbook()
    for (const needle of ['staging:load', 'staging:profile', 'CLOUD_SOURCE_URL', 'manifest.json', 'pp-staging-dump/1', 'OD-2']) {
      expect(text, needle).toContain(needle)
    }
  })
})
