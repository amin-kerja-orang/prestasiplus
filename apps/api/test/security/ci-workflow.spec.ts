import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

/** BE-33 AC5/AC6: the security gates exist in .github/workflows/api.yml and in docker/api/Dockerfile (shape only; real runs are CI). */
const REPO = fileURLToPath(new URL('../../../../', import.meta.url))
const read = (p: string) => readFileSync(new URL(p, `file://${REPO}`), 'utf8')

interface Step { name?: string; uses?: string; run?: string; with?: Record<string, unknown> }
interface Job { if?: string; steps: Step[]; permissions?: Record<string, string>; services?: Record<string, unknown> }
const wf = parse(read('.github/workflows/api.yml')) as { jobs: Record<string, Job>; permissions: Record<string, string> }
const steps = (job: string): Step[] => wf.jobs[job]?.steps ?? []
const runs = (job: string): string => steps(job).map((s) => s.run ?? '').join('\n')

describe('api.yml security gates', () => {
  it('keeps the existing jobs', () => {
    for (const j of ['verify', 'openapi-diff', 'docker', 'secret-scan']) expect(wf.jobs[j], j).toBeDefined()
  })

  it('has read-only default token permissions', () => {
    expect(wf.permissions).toEqual({ contents: 'read' })
  })

  it('deps-audit installs, audits production dependencies and applies the allow-list gate', () => {
    const r = runs('deps-audit')
    expect(r).toContain('npm ci')
    expect(r).toContain('npm audit --omit=dev --json')
    expect(r).toContain('scripts/npm-audit-gate.mjs')
    // The gate decides the exit code: the audit step must not be the failing one nor swallow the gate.
    expect(r.indexOf('npm audit')).toBeLessThan(r.indexOf('npm-audit-gate'))
    expect(r).not.toMatch(/npm-audit-gate[^\n]*\|\|\s*true/)
  })

  it('docker job scans the image with Trivy: HIGH,CRITICAL, exit-code 1, unfixed ignored, .trivyignore', () => {
    const trivy = steps('docker').find((s) => s.uses?.startsWith('aquasecurity/trivy-action@'))
    expect(trivy, 'trivy step').toBeDefined()
    expect(trivy?.uses).toMatch(/@([0-9a-f]{40}|\d+\.\d+\.\d+)$/)
    expect(trivy?.with).toMatchObject({ 'image-ref': 'pretasiplus-api:ci', severity: 'HIGH,CRITICAL', 'exit-code': '1', trivyignores: '.trivyignore' })
    expect(String(trivy?.with?.['ignore-unfixed'])).toBe('true')
    const order = steps('docker').map((s) => s.name ?? s.uses ?? '')
    expect(order.indexOf('Build API image')).toBeLessThan(order.findIndex((n) => n.startsWith('aquasecurity/trivy-action') || n === 'Trivy image scan'))
  })

  it('has a dependency-review job on pull requests, failing on high, with read-only permissions', () => {
    const job = wf.jobs['dependency-review']
    expect(job?.if).toContain("github.event_name == 'pull_request'")
    expect(job?.permissions).toEqual({ contents: 'read' })
    const step = job?.steps.find((s) => s.uses?.startsWith('actions/dependency-review-action@'))
    expect(step?.with?.['fail-on-severity']).toBe('high')
  })

  it('runs the image read-only with tmpfs /tmp as the node user', () => {
    const r = runs('docker')
    expect(r).toMatch(/docker run --rm --read-only --tmpfs \/tmp --user node pretasiplus-api:ci node -v/)
  })

  it('boots the image read-only against Postgres, checks /api/health and /api/ready, and requires exit code 0 after SIGTERM', () => {
    expect(wf.jobs.docker?.services).toHaveProperty('postgres')
    const r = runs('docker')
    expect(r).toMatch(/--read-only[^\n]*--tmpfs \/var\/lib\/pretasiplus\/files/)
    expect(r).toContain('/api/health')
    expect(r).toContain('/api/ready')
    expect(r).toContain('docker stop')
    expect(r).toContain('test "$code" = "0"')
  })

  it('does not use secrets in the docker job (CI-only throw-away credentials)', () => {
    expect(JSON.stringify(wf.jobs.docker)).not.toContain('secrets.')
  })

  it('every action is pinned to a tag or SHA, never a branch', () => {
    for (const job of Object.values(wf.jobs)) {
      for (const s of job.steps) if (s.uses) expect(s.uses, s.uses).toMatch(/@(v?\d[\w.]*|[0-9a-f]{40})$/)
    }
  })
})

describe('docker/api/Dockerfile runtime stage', () => {
  const docker = read('docker/api/Dockerfile')
  const runtime = docker.slice(docker.indexOf('AS runtime'))

  it('is non-root, production, SIGTERM, and runs node directly', () => {
    expect(runtime).toMatch(/^USER node$/m)
    expect(runtime).toMatch(/NODE_ENV=production/)
    expect(runtime).toMatch(/^STOPSIGNAL SIGTERM$/m)
    expect(runtime).toMatch(/^CMD \["node", "dist\/main\.js"\]$/m)
    expect(runtime).not.toMatch(/npm (run|start)|ENTRYPOINT/)
  })

  it('ships the migration folder names that GET /api/ready compares with _prisma_migrations', () => {
    expect(runtime).toMatch(/COPY --from=build --chown=node:node \/app\/apps\/api\/prisma\/migrations \.\/apps\/api\/prisma\/migrations/)
  })

  it('has the uploads folder owned by node and no tool that writes at start', () => {
    expect(runtime).toMatch(/FILE_STORAGE_DIR=\/var\/lib\/pretasiplus\/files/)
    expect(runtime).toMatch(/chown -R node:node \/var\/lib\/pretasiplus/)
  })
})

describe('.trivyignore', () => {
  it('has only comments or ids with an exp: date', () => {
    for (const line of read('.trivyignore').split(/\r?\n/)) {
      if (line.trim() === '' || line.startsWith('#')) continue
      expect(line, line).toMatch(/^[A-Z]+-[\w-]+ exp:\d{4}-\d{2}-\d{2}$/)
    }
  })
})
