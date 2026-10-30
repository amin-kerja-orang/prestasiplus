import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

/** DEPLOY-WF: the demo deploy/rollback workflows keep their approval gate, pins and secret hygiene (shape only). */
const REPO = fileURLToPath(new URL('../../../../', import.meta.url))
const read = (p: string) => readFileSync(new URL(p, `file://${REPO}`), 'utf8')

interface Step { name?: string; uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, string> }
interface Job { environment?: string; 'timeout-minutes'?: number; steps: Step[] }
interface Workflow {
  on: Record<string, unknown>
  permissions: Record<string, string>
  concurrency: { group: string; 'cancel-in-progress': boolean }
  jobs: Record<string, Job>
}

const FILES = ['.github/workflows/deploy-demo.yml', '.github/workflows/rollback-demo.yml']

describe.each(FILES)('%s', (file) => {
  const text = read(file)
  const wf = parse(text) as Workflow
  const jobs = Object.values(wf.jobs)
  const steps = jobs.flatMap((j) => j.steps)

  it('runs only on manual dispatch', () => {
    expect(Object.keys(wf.on)).toEqual(['workflow_dispatch'])
  })

  it('every job waits for approval on environment demo and has a timeout', () => {
    for (const j of jobs) {
      expect(j.environment).toBe('demo')
      expect(j['timeout-minutes']).toBeGreaterThan(0)
    }
  })

  it('shares one non-cancelling concurrency group with the other demo workflow', () => {
    expect(wf.concurrency).toEqual({ group: 'deploy-demo', 'cancel-in-progress': false })
  })

  it('has least-privilege token permissions', () => {
    expect(wf.permissions.contents).toBe('read')
    for (const [k, v] of Object.entries(wf.permissions)) expect(`${k}:${v}`).toMatch(/^(contents|actions):read$/)
  })

  it('pins every action by full commit SHA', () => {
    for (const s of steps.filter((x) => x.uses)) expect(s.uses).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/)
  })

  it('never interpolates expressions into shell code and never traces it', () => {
    for (const s of steps.filter((x) => x.run)) {
      expect(s.run).not.toMatch(/\$\{\{/)
      expect(s.run).not.toMatch(/set -x|set -o xtrace/)
    }
  })

  it('checks out without persisting the token', () => {
    const co = steps.find((s) => s.uses?.startsWith('actions/checkout@'))
    expect(co?.with?.['persist-credentials']).toBe(false)
  })
})

describe('deploy-demo.yml phases and backup artifact', () => {
  const wf = parse(read('.github/workflows/deploy-demo.yml')) as Workflow
  const deployJob = wf.jobs.deploy
  if (!deployJob) throw new Error('deploy-demo.yml has no deploy job')
  const steps = deployJob.steps
  const idx = (pred: (s: Step) => boolean) => steps.findIndex(pred)
  const at = (i: number): Step => {
    const s = steps[i]
    if (!s) throw new Error(`deploy-demo.yml has no step at index ${i}`)
    return s
  }
  const phase = (p: string) => idx((s) => s.env?.PP_PHASE === p)
  const upload = idx((s) => Boolean(s.uses?.startsWith('actions/upload-artifact@')))

  it('runs build, backup, upload, apply in that order', () => {
    expect(phase('build')).toBeGreaterThan(-1)
    expect(phase('build')).toBeLessThan(phase('backup'))
    expect(phase('backup')).toBeLessThan(upload)
    expect(upload).toBeLessThan(phase('apply'))
  })

  it('creates the CA file and runs backup/apply only after the build, with the trusted PATH', () => {
    const ca = idx((s) => s.name === 'Supabase CA certificate')
    expect(ca).toBeGreaterThan(phase('build'))
    for (const p of ['backup', 'apply']) {
      expect(at(phase(p)).env?.PP_TRUSTED_PATH).toBe('${{ steps.trust.outputs.path }}')
      expect(String((at(phase(p)) as Step & { shell?: string }).shell)).toContain('-u BASH_ENV')
    }
  })

  it('gives the build phase (npm ci, vite, wrangler install) no secret', () => {
    const env = at(phase('build')).env ?? {}
    for (const v of Object.values(env)) expect(String(v)).not.toMatch(/secrets\./)
  })

  it('uploads only the out/ dir of the backup phase, kept 7 days, named per attempt', () => {
    const up = at(upload)
    expect(up.with?.['retention-days']).toBe(7)
    expect(String(up.with?.path)).toBe('${{ steps.backup.outputs.backup_dir }}')
    expect(String(up.with?.name)).toContain('${{ github.run_attempt }}')
    expect(up.with?.['if-no-files-found']).toBe('error')
  })

  it('the script refuses to continue without a GPG key and keeps the plain dump out of out/', () => {
    const sh = read('scripts/deploy-demo.sh')
    expect(sh).toMatch(/BACKUP_GPG_PUBLIC_KEY is not configured/)
    expect(sh).toMatch(/DUMP="\$WORK\/private\//)
    expect(sh).toMatch(/out="\$WORK\/out\/\$\(basename "\$DUMP"\)\.gpg"/)
    expect(sh).toMatch(/gh_output backup_dir "\$WORK\/out"/)
    expect(sh).not.toMatch(/^\s*set -x/m)
  })
})

describe('rollback-demo.yml backup provenance', () => {
  const text = read('.github/workflows/rollback-demo.yml')
  it('accepts only a deploy-demo workflow_dispatch run of this repository', () => {
    expect(text).toContain('(.path | startswith(".github/workflows/deploy-demo.yml"))')
    expect(text).toContain('.event == "workflow_dispatch"')
    expect(text).toContain('.repository.full_name == $repo')
  })
})
