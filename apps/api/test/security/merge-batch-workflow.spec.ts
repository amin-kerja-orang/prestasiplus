import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * merge-batch workflow: shape of .github/workflows/merge-batch.yml, static rules for scripts/merge-batch.sh, and the offline parts of the
 * script run against REAL checker comments from issue #67 (fixtures/merge-batch). Real merges are never run here.
 */
const REPO = fileURLToPath(new URL('../../../../', import.meta.url))
const read = (p: string) => readFileSync(new URL(p, `file://${REPO}`), 'utf8')
const SCRIPT = `${REPO}scripts/merge-batch.sh`
const WF_TEXT = read('.github/workflows/merge-batch.yml')
const SCRIPT_TEXT = read('scripts/merge-batch.sh')

interface Step { name?: string; uses?: string; run?: string; env?: Record<string, string>; with?: Record<string, unknown> }
interface Job { if?: string; environment?: string; permissions?: Record<string, string>; steps: Step[]; 'runs-on'?: string; 'timeout-minutes'?: number }
const wf = parse(WF_TEXT) as {
  on: Record<string, { inputs?: Record<string, { default?: unknown; type?: string; required?: boolean }> }>
  permissions: Record<string, string>
  concurrency: { group: string; 'cancel-in-progress': boolean }
  jobs: Record<string, Job>
}

interface Comment { id: number; created_at: string; updated_at: string; user: { login: string; type: string; id: number }; author_association: string; body: string }
const comments = JSON.parse(read('apps/api/test/security/fixtures/merge-batch/issue-67-comments.json')) as Comment[]
const byId = (id: number): Comment => {
  const c = comments.find((x) => x.id === id)
  if (!c) throw new Error(`fixture ${id} missing`)
  return c
}

const BASE_ENV = { PATH: process.env.PATH ?? '', GH_REPO: 'amin-kerja-orang/prestasiplus' }
const sh = (args: string[], input = '', env: Record<string, string> = {}) =>
  spawnSync('bash', [SCRIPT, ...args], { input, encoding: 'utf8', env: { ...BASE_ENV, ...env } })
const ok = (args: string[], input = '', env: Record<string, string> = {}): string => {
  const r = sh(args, input, env)
  expect(r.status, r.stderr).toBe(0)
  return r.stdout
}

const BE = 'feature/v2-backend'
const FE = 'be/integration-frontend'
type Row = [pr: number, sha: string, base: string, flag: 'merge' | 'signoff', note?: 'warn']
const tsv = (rows: Row[]) => rows.map((r) => [...r.slice(0, 4), r[4] ?? '-'].join('\t')).join('\n') + '\n'
const parseSummary = (id: number) => ok(['parse-summary'], byId(id).body)

describe('merge-batch.yml shape', () => {
  it('is workflow_dispatch only, with the three inputs and dry_run defaulting to true', () => {
    expect(Object.keys(wf.on)).toEqual(['workflow_dispatch'])
    const inputs = wf.on.workflow_dispatch!.inputs!
    expect(Object.keys(inputs).sort()).toEqual(['dry_run', 'exclude', 'source', 'summary_id'])
    expect(inputs.summary_id!.required).toBeFalsy()
    expect(inputs.dry_run!.type).toBe('boolean')
    expect(inputs.dry_run!.default).toBe(true)
    expect(inputs.source!.default).toBe('checker')
    expect(inputs.exclude!.required).toBeFalsy()
  })

  it('has read-only top permissions, one serialised concurrency group, and never pull_request_target', () => {
    expect(wf.permissions).toEqual({ contents: 'read' })
    expect(wf.concurrency).toEqual({ group: 'merge-batch', 'cancel-in-progress': false })
    expect(WF_TEXT).not.toContain('pull_request_target')
  })

  it('runs one job on environment merge with exactly contents read, pull-requests read, issues write', () => {
    const jobs = Object.values(wf.jobs)
    expect(jobs).toHaveLength(1)
    const job = jobs[0]!
    expect(job.environment).toBe('merge')
    expect(job.if).toBe("github.ref == 'refs/heads/feature/v2-backend'")
    expect(job['runs-on']).toBe('ubuntu-24.04')
    expect(job['timeout-minutes']).toBe(45)
    expect(job.permissions).toEqual({ contents: 'read', 'pull-requests': 'read', 'issues': 'write' })
  })

  it('pins every action to a 40-hex SHA and checks out without persisted credentials', () => {
    const steps = Object.values(wf.jobs).flatMap((j) => j.steps)
    const uses = steps.filter((s) => s.uses)
    expect(uses.length).toBeGreaterThan(0)
    for (const s of uses) expect(s.uses, s.uses).toMatch(/@[0-9a-f]{40}$/)
    const checkout = uses.find((s) => s.uses?.startsWith('actions/checkout@'))
    expect(checkout?.with?.['persist-credentials']).toBe(false)
  })

  it('never puts inputs or event data inside a run: string; inputs reach the script through env only', () => {
    const steps = Object.values(wf.jobs).flatMap((j) => j.steps)
    for (const s of steps) {
      if (!s.run) continue
      expect(s.run).not.toMatch(/\$\{\{\s*inputs\./)
      expect(s.run).not.toMatch(/\$\{\{\s*github\.event/)
    }
    const step = steps.find((s) => s.run === 'bash scripts/merge-batch.sh run')
    expect(step, 'run step').toBeDefined()
    expect(step?.env).toMatchObject({
      GH_REPO: '${{ github.repository }}',
      READ_TOKEN: '${{ github.token }}',
      MERGE_TOKEN: '${{ secrets.MERGE_TOKEN }}',
      MB_SOURCE: '${{ inputs.source }}',
      MB_EXCLUDE: '${{ inputs.exclude }}',
      MB_SUMMARY_ID: '${{ inputs.summary_id }}',
      DRY_RUN: "${{ inputs.dry_run && '1' || '0' }}",
    })
  })

  it('mentions secrets.MERGE_TOKEN exactly once and no other secret', () => {
    expect(WF_TEXT.match(/secrets\.MERGE_TOKEN/g)).toHaveLength(1)
    expect(WF_TEXT.match(/secrets\./g)).toHaveLength(1)
  })
})

describe('merge-batch.sh static rules', () => {
  it('has no branch update, delete, close or force', () => {
    expect(SCRIPT_TEXT).not.toContain('update-branch')
    expect(SCRIPT_TEXT).not.toContain('-X DELETE')
    expect(SCRIPT_TEXT).not.toMatch(/"state"\s*:\s*"closed"|state=closed/)
    expect(SCRIPT_TEXT).not.toContain('--force')
  })

  it('uses PUT only on /merge and POST only for issue comments', () => {
    const puts = SCRIPT_TEXT.split('\n').filter((l) => /-X PUT\b/.test(l))
    expect(puts.length).toBeGreaterThan(0)
    for (const l of puts) expect(l).toContain('/merge')
    expect(SCRIPT_TEXT).not.toMatch(/-X (PATCH|DELETE)/)
    const posts = SCRIPT_TEXT.split('\n').filter((l) => /-X POST\b/.test(l))
    for (const l of posts) expect(l).toContain('/comments')
  })

  it('never puts a token on a curl command line', () => {
    expect(SCRIPT_TEXT).toMatch(/-H @<\(printf 'Authorization: Bearer %s\\n' "\$tok"\)/)
    expect(SCRIPT_TEXT).not.toMatch(/curl[^\n]*(MERGE_TOKEN|READ_TOKEN)/)
  })
})

describe('select-summary on the real issue #67 comments', () => {
  const select = (list: unknown[]): number => (JSON.parse(ok(['select-summary'], JSON.stringify(list))) as Comment).id

  it('picks the newest checker summary, never the LEAD merge log', () => {
    expect(select(comments)).toBe(6353019407)
    expect(select(comments.filter((c) => c.id !== 6353019407))).toBe(6349412884)
  })

  it('exits non-zero when there is no checker summary', () => {
    expect(sh(['select-summary'], JSON.stringify([byId(6346247518)])).status).not.toBe(0)
    expect(sh(['select-summary'], '[]').status).not.toBe(0)
  })

  it('ignores newer copies posted by another login or by a Bot', () => {
    const real = byId(6353019407)
    const spoof: Comment = { ...real, id: 9999999999, created_at: '2030-01-01T00:00:00Z', updated_at: '2030-01-01T00:00:00Z', user: { ...real.user, login: 'someone-else' } }
    const bot: Comment = { ...real, id: 9999999998, created_at: '2030-01-02T00:00:00Z', updated_at: '2030-01-02T00:00:00Z', user: { ...real.user, type: 'Bot' } }
    const renamed: Comment = { ...real, id: 9999999997, created_at: '2030-01-03T00:00:00Z', updated_at: '2030-01-03T00:00:00Z', user: { ...real.user, id: 1 } }
    expect(select([...comments, spoof, bot, renamed])).toBe(6353019407)
  })

  it('breaks created_at ties by the highest id', () => {
    const real = byId(6353019407)
    expect(select([real, { ...real, id: real.id + 1 }])).toBe(real.id + 1)
  })

  it('refuses (no fallback) when the newest summary was edited after posting', () => {
    const real = byId(6353019407)
    const r = sh(['select-summary'], JSON.stringify([...comments.filter((c) => c.id !== real.id), { ...real, updated_at: '2026-10-23T00:00:00Z' }]))
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('edited after posting')
  })

  it('accepts several pages concatenated as separate arrays', () => {
    const out = ok(['select-summary'], JSON.stringify(comments.slice(0, 3)) + '\n' + JSON.stringify(comments.slice(3)))
    expect((JSON.parse(out) as Comment).id).toBe(6353019407)
  })

  it('does not fall back when the newest summary is the 6349404388 addendum: select returns it and parse refuses', () => {
    const list = comments.filter((c) => c.id !== 6353019407)
    const withAddendum = list.filter((c) => c.id !== 6349412884)
    const picked = JSON.parse(ok(['select-summary'], JSON.stringify(withAddendum))) as Comment
    expect(picked.id).toBe(6349404388)
    const r = sh(['parse-summary'], picked.body)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain("no '### SEDIA MERGE (safe order)' section")
    expect(r.stdout).toBe('')
  })
})

describe('parse-summary on the real checker summaries', () => {
  it('6353019407 (06:50 MYT): backend and frontend merge items, sign-off items flagged', () => {
    expect(parseSummary(6353019407)).toBe(
      tsv([
        [215, 'b48779c217f7ab150c78b2e1f5f70d50851cad8d', BE, 'merge'],
        [206, 'ea91d76013fbc623b5ca7a2102a6f99221a2ea01', BE, 'merge'],
        [204, '4d272ac054cf301ee7a7d0eee649b356be85c2e4', BE, 'merge'],
        [200, '7b7b0d36ca984972de970df66689133731e02229', BE, 'merge'],
        [210, 'e88718d3d0a7f4bb94e2a99ea200da52bf0ef839', BE, 'merge'],
        [184, '7f559734e3ad389ef0e40094f6402fead6fa8dd7', BE, 'merge', 'warn'],
        [203, 'fb593a1acdd235cb46f26a8b663fa106c7a54db8', BE, 'merge', 'warn'],
        [145, '5a08a6463dfd9d8decc766c34cb37e8281d10033', BE, 'signoff'],
        [124, 'b16756072a5d9f1c83c575e8163e91336eb24a38', BE, 'signoff'],
        [207, '03da49a6f2ee72846daf784433663b19b092c3a2', BE, 'signoff'],
        [169, '441af3981469139aaea1a9d8a7421fef5876e2c7', FE, 'merge'],
        [211, 'c2a8dbe374c37969b13c9084426b09e8bd71c6f5', FE, 'merge'],
        [146, 'c7cf59fbbf5c281b11b15f3b3298bd56ed0660f3', FE, 'merge'],
        [202, '83a354403275b50cf65f13685c7eb5065d49b3a4', FE, 'merge'],
        [213, '77f4b117551aa868abbd823762b5d0be66006253', FE, 'merge'],
        [183, 'f4a1febdfe8ba3fa59a85553c6357f4c7499d3c5', FE, 'merge'],
        [180, '87d64d668535d5b20962d653486645c48e6b75c2', FE, 'signoff'],
        [208, 'bde4021862edae6736975bdeac48814a0e42372a', FE, 'signoff'],
      ]),
    )
  })

  it('6353019407: prose with short shas (#175 0790f8d7 ...) and "LEAD chooses" items are not sign-off or commands', () => {
    const rows = parseSummary(6353019407).trim().split('\n')
    const prs = rows.map((r) => r.split('\t')[0])
    for (const stale of ['175', '201', '199', '177']) expect(prs).not.toContain(stale)
    expect(rows.find((r) => r.startsWith('203\t'))).toMatch(/\tmerge\twarn$/)
  })

  it('6348496951 (03:40 MYT): backend 163 145 184 175 177 + sign-off 143; frontend 180 181 183 169', () => {
    expect(parseSummary(6348496951)).toBe(
      tsv([
        [163, 'dfbf89f49465c1690fb3e9913be36a2d5cf59c3e', BE, 'merge'],
        [145, '41a0597be858126ec2f06bf510f864a6f95d25bd', BE, 'merge'],
        [184, '740b91f1f299252133f0fc14dc5c86c48fb1aac5', BE, 'merge', 'warn'],
        [175, '0790f8d769b0e1bf7013e4d25dbede6aff1c0892', BE, 'merge', 'warn'],
        [177, '1258501d5c0c47e22f787f71f8dacc90d505eb09', BE, 'merge', 'warn'],
        [143, '9ec78b75b019a884497e6c059d84f3a44a29c28b', BE, 'signoff'],
        [180, 'b310f2a32d6f832c0eca7ce88d0a27c32dc8f23d', FE, 'merge'],
        [181, 'f26434c627e2d26213e62909062d94bcece83127', FE, 'merge'],
        [183, 'f4a1febdfe8ba3fa59a85553c6357f4c7499d3c5', FE, 'merge'],
        [169, '441af3981469139aaea1a9d8a7421fef5876e2c7', FE, 'merge'],
      ]),
    )
  })

  it('6345697865 (22 Oct): frontend section first, backend after, sign-off block at the end', () => {
    expect(parseSummary(6345697865)).toBe(
      tsv([
        [172, 'ec4d249c78ff795ae92ff57305e876e2c6afc355', FE, 'merge'],
        [171, 'd78fc525ad55092be8affa4356a7e729624f5ad4', FE, 'merge'],
        [174, '3de116fd4d82ebd3a3c9aafd465c5b1fa9d7bb6d', FE, 'merge'],
        [147, '6c2195331fc38f405849dc27604b137d073e8915', FE, 'merge'],
        [126, '2b439b25d2dea42e097973ada2f16f4847c46fd2', FE, 'merge'],
        [128, '7c65a1dc8e482dafbb120cd726ca6a3e66322bcb', FE, 'merge'],
        [142, '4df50741d0a8f0fa2c19c35da56ee9dedc2cfc10', FE, 'merge'],
        [148, '16be7e5506ef1ce656653869f7a81f17ca6b6e27', FE, 'merge'],
        [152, '58362be6d10fcc48f0dec6655f24069c6067f1fc', FE, 'merge'],
        [182, '04ce21895426724ee2bb54f24989204c82e36206', FE, 'merge'],
        [170, '02bfb91b5f5a1a8720df03c73abf2f33e0da27b0', BE, 'merge'],
        [185, 'f5e915dab7e2d24af1d7019b6b8fc779b1f078be', BE, 'merge'],
        [143, '9ec78b75b019a884497e6c059d84f3a44a29c28b', BE, 'signoff'],
        [145, 'b85a9b4f1487c88f96eb8487099d3a787c236f6b', BE, 'signoff'],
        [163, 'dfbf89f49465c1690fb3e9913be36a2d5cf59c3e', BE, 'signoff'],
      ]),
    )
  })

  it('6349412884 (03:45 MYT): inline sign-off on item 5, sign-off sub-bullets on item 11', () => {
    expect(parseSummary(6349412884)).toBe(
      tsv([
        [206, 'ea91d76013fbc623b5ca7a2102a6f99221a2ea01', BE, 'merge'],
        [204, '597cba74c9ee9c1d638e6a9af229bc5bc4bebd51', BE, 'merge'],
        [175, '0790f8d769b0e1bf7013e4d25dbede6aff1c0892', BE, 'merge'],
        [210, 'e88718d3d0a7f4bb94e2a99ea200da52bf0ef839', BE, 'merge'],
        [124, 'b16756072a5d9f1c83c575e8163e91336eb24a38', BE, 'signoff'],
        [169, '441af3981469139aaea1a9d8a7421fef5876e2c7', FE, 'merge'],
        [211, 'c2a8dbe374c37969b13c9084426b09e8bd71c6f5', FE, 'merge'],
        [202, '474f15daa89b08c1c3d63a907d3bd936e536010b', FE, 'merge'],
        [146, 'c7cf59fbbf5c281b11b15f3b3298bd56ed0660f3', FE, 'merge'],
        [183, 'f4a1febdfe8ba3fa59a85553c6357f4c7499d3c5', FE, 'merge'],
        [180, '87d64d668535d5b20962d653486645c48e6b75c2', FE, 'signoff'],
        [208, 'cdcd6b31d2b91a45543b444dcf61df0f36d4ae05', FE, 'signoff'],
      ]),
    )
  })

  it('6349404388 (addendum "### New SEDIA MERGE") is refused', () => {
    const r = sh(['parse-summary'], byId(6349404388).body)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain("no '### SEDIA MERGE (safe order)' section")
  })
})

describe('parse-summary edge cases (synthetic)', () => {
  const sha = (c: string) => c.repeat(40)
  const raw = (n: number, s: string, repo = 'amin-kerja-orang/prestasiplus') => `gh pr merge ${n} --repo ${repo} --merge --match-head-commit ${s}`
  const cmd = (n: number, s: string, repo?: string) => '`' + raw(n, s, repo) + '`'
  const doc = (lines: string[]) => ['Merge-ready checker summary', '', '### SEDIA MERGE (safe order)', ...lines, '### Not ready', cmd(999, sha('9'))].join('\n')

  it('marks a command before any base heading with base "-"', () => {
    expect(ok(['parse-summary'], doc([`1. #5 ${cmd(5, sha('a'))}`]))).toBe(`5\t${sha('a')}\t-\tmerge\t-\n`)
  })

  it('refuses the same PR twice', () => {
    const r = sh(['parse-summary'], doc([`**${BE}**`, cmd(5, sha('a')), cmd(5, sha('b'))]))
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('#5')
  })

  it('refuses a command for another repo, a short sha, an uppercase sha, or a 41-char sha', () => {
    for (const bad of [cmd(5, sha('a'), 'someone/else'), cmd(5, 'abc1234'), cmd(5, sha('A')), cmd(5, sha('a') + 'b')]) {
      expect(sh(['parse-summary'], doc([`**${BE}**`, bad])).status, bad).not.toBe(0)
    }
  })

  it('refuses a command that is not exactly one backticked span, and any other gh pr merge text', () => {
    for (const bad of [raw(5, sha('a')), `$ ${raw(5, sha('a'))}`, '`' + raw(5, sha('a')) + ' --admin`', 'run gh pr merge 5 later', `${cmd(5, sha('a'))} and gh pr merge 6`]) {
      const r = sh(['parse-summary'], doc([`**${BE}**`, `1. ${bad}`]))
      expect(r.status, bad).not.toBe(0)
    }
  })

  it('refuses an HTML comment anywhere in the SEDIA section', () => {
    const r = sh(['parse-summary'], doc([`**${BE}**`, `1. ${cmd(5, sha('a'))}`, '<!-- hidden -->']))
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('HTML comment')
  })

  it('decides sign-off over the WHOLE numbered item: command first, then a "sign off" sub-bullet', () => {
    const out = ok(
      ['parse-summary'],
      doc([`**${BE}**`, `1. #5 ${cmd(5, sha('a'))}`, '   - needs LEAD sign off first', `   - ${cmd(6, sha('b'))}`, `2. #7 ${cmd(7, sha('c'))}`, `3. #8 ${cmd(8, sha('d'))} (needs sign‑off)`, `4. #9 ${cmd(9, sha('e'))}`]),
    )
    expect(out).toBe([`5\t${sha('a')}\t${BE}\tsignoff\t-`, `6\t${sha('b')}\t${BE}\tsignoff\t-`, `7\t${sha('c')}\t${BE}\tmerge\t-`, `8\t${sha('d')}\t${BE}\tsignoff\t-`, `9\t${sha('e')}\t${BE}\tmerge\t-`].join('\n') + '\n')
  })

  it('ignores other bold lines; the marker line before sub-bullets covers them; a base heading ends the item', () => {
    const out = ok(
      ['parse-summary'],
      doc([`**${BE}**`, '1. **After LEAD sign-off:**', `   - ${cmd(5, sha('a'))}`, '**Verification**', `2. next ${cmd(6, sha('b'))}`, `**${FE}.** note`, `3. After LEAD sign-off ${cmd(7, sha('c'))}`, `**${BE}**`, `- ${cmd(8, sha('d'))}`]),
    )
    expect(out).toBe([`5\t${sha('a')}\t${BE}\tsignoff\t-`, `6\t${sha('b')}\t${BE}\tmerge\t-`, `7\t${sha('c')}\t${FE}\tsignoff\t-`, `8\t${sha('d')}\t${BE}\tmerge\t-`].join('\n') + '\n')
  })

  it('adds a warn note for an item with the warning sign or "LEAD chooses" (not sign-off)', () => {
    const out = ok(['parse-summary'], doc([`**${BE}**`, `1. ⚠ order matters ${cmd(5, sha('a'))}`, `2. **LEAD chooses** which goes first. ${cmd(6, sha('b'))}`, `3. plain ${cmd(7, sha('c'))}`, '   - ⚠ sub-bullet warning', `   - ${cmd(8, sha('d'))}`]))
    expect(out).toBe([`5\t${sha('a')}\t${BE}\tmerge\twarn`, `6\t${sha('b')}\t${BE}\tmerge\twarn`, `7\t${sha('c')}\t${BE}\tmerge\twarn`, `8\t${sha('d')}\t${BE}\tmerge\twarn`].join('\n') + '\n')
  })

  it('treats a plain column-0 line right after an item as a lazy continuation of that item', () => {
    const out = ok(['parse-summary'], doc([`**${BE}**`, `1. #5 ${cmd(5, sha('a'))}`, 'needs LEAD sign-off (wrapped line)', '', `2. #6 ${cmd(6, sha('b'))}`, 'plain wrap', `- #7 ${cmd(7, sha('c'))}`]))
    expect(out).toBe([`5\t${sha('a')}\t${BE}\tsignoff\t-`, `6\t${sha('b')}\t${BE}\tmerge\t-`, `7\t${sha('c')}\t${BE}\tmerge\t-`].join('\n') + '\n')
  })

  it('does not parse commands outside the SEDIA section', () => {
    expect(sh(['parse-summary'], `Merge-ready checker summary\n${cmd(5, sha('a'))}\n### Other\n`).status).not.toBe(0)
  })
})

describe('parse-manual', () => {
  const a = 'a'.repeat(40)
  const b = 'b'.repeat(40)
  it('parses N:sha pairs with base * and flag merge, trimming whitespace', () => {
    expect(ok(['parse-manual', `172:${a}, 171:${b} `])).toBe(`172\t${a}\t*\tmerge\t-\n171\t${b}\t*\tmerge\t-\n`)
  })
  it('refuses short shas, uppercase, junk, duplicates and empty lists or items', () => {
    for (const bad of ['', '172:abc1234', `172:${'A'.repeat(40)}`, 'junk', `172:${a}x`, `172:${a},172:${b}`, `172:${a},`, `,172:${a}`, `172:${a},,171:${b}`, ` `, `#172:${a}`]) {
      expect(sh(['parse-manual', bad]).status, JSON.stringify(bad)).not.toBe(0)
    }
  })
})

describe('blocking-text', () => {
  const blocking = (t: string): boolean => sh(['blocking-text'], t).status === 0
  it.each([
    ['Major 1'],
    ['Major 2'],
    ['Blocker: 2'],
    ['a Major finding'],
    ['Changes needed'],
    ['G4 verdict: CHANGES NEEDED on the head'],
    ['void'],
    ['every command there is void.'],
    ['Blocker 0, Major 1'],
    ['**Major** left'],
  ])('blocks: %s', (t) => expect(blocking(t)).toBe(true))
  it.each([
    ['Blocker 0, Major 0'],
    ['Approve. Blocker: 0 Major: 0 Minor 2'],
    ['Majors 1–2 are fixed'],
    ['Minor 3'],
    ['avoid the voided path'],
    ['LGTM'],
    [''],
  ])('does not block: %s', (t) => expect(blocking(t)).toBe(false))
})

describe('run guards (no network)', () => {
  const dead = { GITHUB_API: 'http://127.0.0.1:9', READ_TOKEN: '', POLL_INTERVAL: '0', POLL_MAX: '0' }
  it('refuses DRY_RUN=0 with an empty MERGE_TOKEN before any request', () => {
    const r = sh(['run'], '', { ...dead, DRY_RUN: '0', MERGE_TOKEN: '' })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('MERGE_TOKEN')
    expect(r.stderr).not.toMatch(/curl|Failed to connect/)
  })
  it('treats an unset DRY_RUN as a dry run (fails on the unroutable API, never at the token check)', () => {
    const r = sh(['run'], '', dead)
    expect(r.status).not.toBe(0)
    expect(r.stderr).not.toContain('MERGE_TOKEN is empty')
  })
  it('rejects a non-numeric exclude and a malformed manual list before any request', () => {
    expect(sh(['run'], '', { ...dead, MB_EXCLUDE: '12,abc' }).stderr).toContain('exclude')
    expect(sh(['run'], '', { ...dead, MB_SOURCE: '172:short' }).stderr).toContain('manual')
  })
  it('does not leak a token into its output', () => {
    const r = sh(['run'], '', { ...dead, DRY_RUN: '0', MERGE_TOKEN: 'fake-merge-token-value', MB_SOURCE: 'junk' })
    expect(r.stdout + r.stderr).not.toContain('SECRETVALUE')
  })
})

describe('execFileSync smoke', () => {
  it('exits 2 with usage on an unknown subcommand', () => {
    expect(() => execFileSync('bash', [SCRIPT, 'nope'], { stdio: 'pipe' })).toThrow()
  })
})

/** Drives `run` end to end against a fake GitHub API on loopback (real flow: DRY_RUN=0, fake tokens). */
describe('run against a fake GitHub API', () => {
  const READ = 'readtok_AAAA1111'
  const MERGE = 'mergetok_BBBB2222'
  const REPO_PATH = '/repos/amin-kerja-orang/prestasiplus'
  const shaOf = (n: number): string => n.toString(16).padStart(2, '0').repeat(20)
  const baseOf = (n: number): string => (n < 20 ? BE : FE)
  const command = (n: number): string => '`' + `gh pr merge ${n} --repo amin-kerja-orang/prestasiplus --merge --match-head-commit ${shaOf(n)}` + '`'
  const SUMMARY_ID = 5550001
  const summaryBody = [
    'Merge-ready checker summary, fake.',
    '',
    '### SEDIA MERGE (safe order)',
    '',
    `**${BE}**`,
    `1. #11 ${command(11)}`,
    `2. #12 ${command(12)}`,
    `3. #13 ${command(13)}`,
    '',
    `**${FE}**`,
    `4. #21 ${command(21)}`,
    `5. #22 ${command(22)}`,
    `6. ⚠ #23 ${command(23)}`,
    `7. #24 ${command(24)}`,
    '',
    '### Not ready',
    '| #99 | nope | AZ |',
  ].join('\n')

  interface Req { method: string; path: string; auth: string; body: string }
  let reqs: Req[] = []
  let server: Server
  let port = 0
  let summaryUpdated = '2026-10-22T10:00:00Z'
  let lostPut = false
  let prCreated = '2026-10-22T12:00:00Z'
  const putDone = new Set<number>()

  const json = (res: import('node:http').ServerResponse, code: number, obj: unknown) => {
    const b = JSON.stringify(obj)
    res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) })
    res.end(b)
  }
  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((resolve) => {
      let d = ''
      req.on('data', (c: Buffer) => (d += c.toString()))
      req.on('end', () => resolve(d))
    })

  beforeAll(async () => {
    server = createServer((req, res) => {
      void (async () => {
        const body = await readBody(req)
        const url = new URL(req.url ?? '/', 'http://x')
        const path = url.pathname
        reqs.push({ method: req.method ?? '', path, auth: String(req.headers.authorization ?? ''), body })
        if (req.method === 'POST') return json(res, 201, { html_url: `https://example.test${path}#c1` })
        if (req.method === 'PUT') {
          const n = Number(path.split('/')[5])
          putDone.add(n)
          if (n === 12 && lostPut) return json(res, 502, { message: 'Bad Gateway' })
          if (n === 12) return json(res, 405, { message: 'Base branch was modified. Review and try the merge again.' })
          return json(res, 200, { sha: '9'.repeat(40), merged: true, message: 'merged' })
        }
        if (path === `${REPO_PATH}/issues/67/comments`) {
          return json(res, 200, [
            { id: SUMMARY_ID, created_at: '2026-10-22T10:00:00Z', updated_at: summaryUpdated, html_url: 'https://example.test/67#s', user: { login: 'azarulhakim', type: 'User', id: 47310631 }, author_association: 'MEMBER', body: summaryBody },
          ])
        }
        let m = /^\/repos\/amin-kerja-orang\/prestasiplus\/pulls\/(\d+)$/.exec(path)
        if (m) {
          const n = Number(m[1])
          if (n === 12 && putDone.has(12) && lostPut) return json(res, 200, { state: 'closed', draft: false, merged: true, merge_commit_sha: '7'.repeat(40), base: { ref: BE }, head: { sha: shaOf(12) } })
          return json(res, 200, { state: 'open', draft: false, merged: false, created_at: prCreated, base: { ref: baseOf(n) }, head: { sha: n === 24 ? 'f'.repeat(40) : shaOf(n) }, mergeable: true, mergeable_state: 'clean' })
        }
        m = /^\/repos\/amin-kerja-orang\/prestasiplus\/issues\/(\d+)\/comments$/.exec(path)
        if (m) {
          const n = Number(m[1])
          const c = (assoc: string) => [{ html_url: `https://example.test/c${n}`, updated_at: '2026-10-22T11:00:00Z', body: 'Major 1 remains', author_association: assoc }]
          return json(res, 200, n === 22 ? c('MEMBER') : n === 23 ? c('NONE') : [])
        }
        if (/\/pulls\/\d+\/(comments|reviews)$/.test(path)) return json(res, 200, [])
        m = /^\/repos\/amin-kerja-orang\/prestasiplus\/branches\/(.+)$/.exec(path)
        if (m) return json(res, 200, { commit: { sha: (m[1] === BE ? 'a1' : 'b2').repeat(20) } })
        return json(res, 404, { message: 'Not Found' })
      })()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as AddressInfo).port
  })
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  const runScript = (env: Record<string, string>): Promise<{ code: number | null; stdout: string; stderr: string; reqs: Req[] }> => {
    reqs = []
    return new Promise((resolve) => {
      const child = spawn('bash', [SCRIPT, 'run'], {
        env: { ...BASE_ENV, GITHUB_API: `http://127.0.0.1:${port}`, READ_TOKEN: READ, MERGE_TOKEN: MERGE, POLL_INTERVAL: '0', POLL_MAX: '1', RUN_ID: '42', RUN_URL: 'https://example.test/run/42', ...env },
      })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (c: Buffer) => (stdout += c.toString()))
      child.stderr.on('data', (c: Buffer) => (stderr += c.toString()))
      child.on('close', (code) => resolve({ code, stdout, stderr, reqs: [...reqs] }))
    })
  }

  it('real run: merges, FAILED cascade, association filter, moved head, auth split, posts, exit 1', async () => {
    summaryUpdated = '2026-10-22T10:00:00Z'
    const r = await runScript({ DRY_RUN: '0', MB_SOURCE: 'checker' })
    expect(r.code, r.stderr).toBe(1)
    const row = (n: number) => r.stdout.split('\n').find((l) => l.includes(`| #${n} |`)) ?? ''
    expect(row(11)).toContain('MERGED')
    expect(row(12)).toContain('FAILED')
    expect(row(12)).toContain('Base branch was modified')
    expect(row(13)).toContain('not attempted: an earlier merge on feature/v2-backend failed')
    expect(row(21)).toContain('MERGED')
    expect(row(22)).toContain('later comment blocks: https://example.test/c22')
    expect(row(23)).toContain('MERGED')
    expect(row(23)).toContain('summary warns')
    expect(row(24)).toContain('head moved: ffffffff')
    expect(r.stdout).toContain('Warnings: #23')
    expect(r.stdout).toContain('body sha256')

    const puts = r.reqs.filter((q) => q.method === 'PUT')
    expect(puts.map((q) => q.path)).toEqual([11, 12, 21, 23].map((n) => `${REPO_PATH}/pulls/${n}/merge`))
    expect(JSON.parse(puts[0]!.body)).toEqual({ merge_method: 'merge', sha: shaOf(11) })
    for (const q of puts) expect(q.auth).toBe(`Bearer ${MERGE}`)
    for (const q of r.reqs.filter((x) => x.method !== 'PUT')) expect(q.auth, `${q.method} ${q.path}`).toBe(`Bearer ${READ}`)
    expect(new Set(r.reqs.map((q) => q.method))).toEqual(new Set(['GET', 'PUT', 'POST']))

    const posts = r.reqs.filter((q) => q.method === 'POST').map((q) => q.path)
    expect(posts).toEqual([`${REPO_PATH}/issues/67/comments`, `${REPO_PATH}/issues/113/comments`, `${REPO_PATH}/issues/109/comments`])
    const notice = (JSON.parse(r.reqs.filter((q) => q.method === 'POST')[1]!.body) as { body: string }).body
    expect(notice).toContain('merged #11, #21, #23')
    expect(notice).toContain('failed #12')
    expect(notice).toContain('`feature/v2-backend` @ `a1a1a1a1`')
    expect(notice).toContain('Log: https://example.test')
    expect(r.stdout + r.stderr).not.toContain(READ)
    expect(r.stdout + r.stderr).not.toContain(MERGE)
  }, 60000)

  it('dry run: plan only, no PUT and no POST, prints the summary id to pin', async () => {
    summaryUpdated = '2026-10-22T10:00:00Z'
    const r = await runScript({ DRY_RUN: '1', MB_SOURCE: '', MB_SUMMARY_ID: String(SUMMARY_ID) })
    expect(r.code, r.stderr).toBe(0)
    expect(r.reqs.filter((q) => q.method !== 'GET')).toEqual([])
    expect(r.stdout).toContain('DRY RUN plan')
    expect(r.stdout).toContain('WOULD MERGE')
    expect(r.stdout).toContain(`summary_id=${SUMMARY_ID}`)
  }, 60000)

  it('refuses an edited summary and a summary_id mismatch, before any merge or post', async () => {
    summaryUpdated = '2026-10-22T10:30:00Z'
    const edited = await runScript({ DRY_RUN: '0' })
    expect(edited.code).not.toBe(0)
    expect(edited.stderr).toContain('edited after posting')
    expect(edited.reqs.filter((q) => q.method !== 'GET')).toEqual([])
    summaryUpdated = '2026-10-22T10:00:00Z'
    const wrong = await runScript({ DRY_RUN: '0', MB_SUMMARY_ID: '123' })
    expect(wrong.code).not.toBe(0)
    expect(wrong.stderr).toContain('summary_id')
    expect(wrong.reqs.filter((q) => q.method !== 'GET')).toEqual([])
  }, 60000)

  it('a lost PUT response is re-read: the PR is reported MERGED when GitHub says merged', async () => {
    lostPut = true
    putDone.clear()
    try {
      const r = await runScript({ DRY_RUN: '0', MB_EXCLUDE: '21 22 23 24 13' })
      const row = r.stdout.split('\n').find((l) => l.includes('| #12 |')) ?? ''
      expect(row).toContain('MERGED')
      expect(row).toContain('PUT response lost')
      expect(r.code, r.stderr).toBe(0)
    } finally {
      lostPut = false
    }
  }, 60000)

  it('manual mode: cutoff is the PR created_at (no commit lookup); the real base shows once the PR is read', async () => {
    const list = `22:${shaOf(22)}`
    prCreated = '2026-10-22T12:00:00Z' // after the comment (11:00): the comment is older than the PR, so it cannot block
    const late = await runScript({ DRY_RUN: '1', MB_SOURCE: list })
    expect(late.stdout.split('\n').find((l) => l.includes('| #22 |'))).toContain('WOULD MERGE')
    expect(late.reqs.some((q) => q.path.includes('/commits/'))).toBe(false)
    prCreated = '2026-10-22T10:00:00Z' // before the comment: it blocks
    const early = await runScript({ DRY_RUN: '1', MB_SOURCE: list })
    const row = early.stdout.split('\n').find((l) => l.includes('| #22 |')) ?? ''
    expect(row).toContain('later comment blocks')
    expect(row).toContain(`\`${FE}\``)
    prCreated = '2026-10-22T12:00:00Z'
  }, 60000)

  it('ignores GITHUB_API and other overrides when GITHUB_ACTIONS=true', async () => {
    const r = await runScript({ DRY_RUN: '1', GITHUB_ACTIONS: 'true', GH_REPO: 'someone/else' })
    expect(r.code).not.toBe(0)
    expect(r.stderr).toContain('GH_REPO')
    expect(r.reqs).toEqual([])
    const r2 = await runScript({ DRY_RUN: '1', GITHUB_ACTIONS: 'true' })
    expect(r2.reqs).toEqual([]) // the loopback API is ignored, the real one is unreachable without a proxy
    expect(r2.code).not.toBe(0)
  }, 60000)
})
