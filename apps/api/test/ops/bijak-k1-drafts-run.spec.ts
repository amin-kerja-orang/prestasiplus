import { describe, expect, it } from 'vitest'

import {
  errorText,
  planTarget,
  ScriptError,
  runK1Drafts,
  type BlueprintBody,
  type BlueprintInfo,
  type ExistingPaper,
  type Gateway,
  type RunOptions,
} from '../../src/ops/bijak-k1-drafts/run'
import type { Candidate } from '../../src/ops/bijak-k1-drafts/select'
import { K1_TARGETS, paperTitle } from '../../src/ops/bijak-k1-drafts/targets'

const target = (subject: string) => K1_TARGETS.find((t) => t.subject === subject)!

const stock = (stratum: string, n: number, from: number): Candidate[] =>
  Array.from({ length: n }, (_, i) => ({ id: String(700000 + from + i), legacyId: String(from + i), stratum, dedupeKey: `k${String(from + i)}` }))

const k1Blueprint = (over: Partial<BlueprintInfo> = {}): BlueprintInfo => ({
  source: 'spec',
  code: '4531/1',
  sections: [{ ruleType: 'all', questionCount: 40, markBudget: 40 }],
  ...over,
})

/** In-memory gateway: records what the script writes, and shows it again on the next run (state survives between runs). */
class Fake implements Gateway {
  blueprints = new Map<string, BlueprintInfo>()
  paperRows: ExistingPaper[] = []
  writes: string[] = []
  private nextPaper = 1
  private sections = new Map<string, string[]>()
  failFill = false

  constructor(
    public stockBySubject: Record<string, Candidate[]>,
    private names: Record<string, string> = { MAT: 'Matematik', SEJ: 'Sejarah', PHY: 'Fizik', SN: 'Sains' },
  ) {}

  async subject(code: string) {
    return this.names[code] ? { name: this.names[code] } : null
  }
  async eligible(code: string) {
    return this.stockBySubject[code] ?? []
  }
  async blueprint(code: string) {
    return this.blueprints.get(code) ?? null
  }
  async writeBlueprint(body: BlueprintBody, replace: boolean) {
    this.writes.push(`${replace ? 'blueprint-version' : 'blueprint'}:${body.subject}`)
    this.blueprints.set(body.subject, {
      source: 'spec',
      code: body.code,
      sections: body.sections.map((s) => ({ ruleType: s.rule.type, questionCount: s.questionCount, markBudget: s.markBudget })),
    })
  }
  async papers(code: string) {
    return this.names[code] ? this.paperRows : []
  }
  async createPaper(_code: string, _kertas: number, title: string) {
    const id = String(this.nextPaper++)
    this.writes.push(`paper:${title}`)
    this.paperRows.push({ id, title, status: 'draft', questionIds: [] })
    this.sections.set(id, [`s${id}`])
    return { id, sectionIds: [`s${id}`] }
  }
  async sectionIds(paperId: string) {
    return this.sections.get(paperId) ?? []
  }
  async fillSection(paperId: string, _sectionId: string, questionIds: string[]) {
    if (this.failFill) throw new Error('boom')
    this.writes.push(`fill:${paperId}`)
    const row = this.paperRows.find((p) => p.id === paperId)!
    row.questionIds = questionIds
  }
  async draftsPassingCheck(paperIds: string[]) {
    return paperIds.length
  }
}

const opts = (over: Partial<RunOptions> = {}): RunOptions => ({ apply: false, sets: 2, subjects: ['PHY'], replaceBlueprints: false, ...over })
const lines = async (gw: Gateway, o: RunOptions) => {
  const out: string[] = []
  const summary = await runK1Drafts(gw, o, (l) => out.push(l))
  return { out, summary }
}

describe('dry-run', () => {
  it('writes nothing and prints aggregates only', async () => {
    const gw = new Fake({ PHY: [...stock('t4', 120, 1000), ...stock('t5', 120, 5000)] })
    const { out, summary } = await lines(gw, opts())
    expect(gw.writes).toEqual([])
    expect(summary.exit).toBe(0)
    const text = out.join('\n')
    expect(text).toContain('DRY-RUN')
    expect(text).toContain('eligible stock: 240 (t4 120, t5 120)')
    expect(text).toContain('would create Spec, 40 questions, 75 min')
    expect(text).toContain('would create 2')
    // No id of a question or paper, and no title, in the output.
    expect(text).not.toMatch(/70\d{4}/)
    expect(text).not.toContain('Latihan SPM')
  })
})

describe('apply', () => {
  const full = () => new Fake({ PHY: [...stock('t4', 120, 1000), ...stock('t5', 120, 5000)] })

  it('creates the blueprint and two disjoint drafts of 40, and publishes nothing', async () => {
    const gw = full()
    const { summary, out } = await lines(gw, opts({ apply: true }))
    expect(summary).toMatchObject({ exit: 0, blueprintsCreated: 1, papersCreated: 2, failures: 0 })
    expect(gw.writes.filter((w) => w.startsWith('paper:'))).toHaveLength(2)
    expect(gw.paperRows.every((p) => p.status === 'draft' && p.questionIds.length === 40)).toBe(true)
    const all = gw.paperRows.flatMap((p) => p.questionIds)
    expect(new Set(all).size).toBe(80)
    expect(out.join('\n')).toContain('publish check on the drafts written now: 2 of 2 pass')
  })

  it('is idempotent: a second run creates nothing', async () => {
    const gw = full()
    await lines(gw, opts({ apply: true }))
    const before = gw.writes.length
    const { summary } = await lines(gw, opts({ apply: true }))
    expect(gw.writes).toHaveLength(before)
    expect(summary).toMatchObject({ exit: 0, blueprintsCreated: 0, papersCreated: 0, papersExisting: 2 })
  })

  it('finds a draft that was renamed by the questions it holds', async () => {
    const gw = full()
    await lines(gw, opts({ apply: true }))
    for (const p of gw.paperRows) p.title = `Nama lain ${p.id}`
    const before = gw.writes.length
    const { summary } = await lines(gw, opts({ apply: true }))
    expect(gw.writes).toHaveLength(before)
    expect(summary.papersExisting).toBe(2)
  })

  it('resumes an empty draft left by a failed run, without creating a second one', async () => {
    const gw = full()
    gw.failFill = true
    const first = await lines(gw, opts({ apply: true }))
    expect(first.summary.exit).toBe(1)
    expect(first.summary.failures).toBe(2)
    expect(gw.paperRows).toHaveLength(2)
    gw.failFill = false
    const again = await lines(gw, opts({ apply: true }))
    expect(again.summary).toMatchObject({ exit: 0, papersCreated: 0, papersFilled: 2 })
    expect(gw.paperRows).toHaveLength(2)
    expect(gw.paperRows.every((p) => p.questionIds.length === 40)).toBe(true)
  })

  it('prints only the name of an unexpected error (it could hold data), but the text of the script own errors', async () => {
    const gw = full()
    gw.failFill = true
    const { out } = await lines(gw, opts({ apply: true }))
    expect(out.join('\n')).toContain('FAILED paper 1: Error')
    expect(out.join('\n')).not.toContain('boom')
    const err = Object.assign(new Error('Kertas ini sudah diterbitkan'), { code: 'VALIDATION_ERROR', getStatus: () => 422 })
    expect(errorText(err)).toBe('VALIDATION_ERROR Kertas ini sudah diterbitkan')
    expect(errorText(Object.assign(new Error('insert ... values (1, 2)'), { code: 'P2002' }))).toBe('P2002')
    expect(errorText(new ScriptError('the draft has no section'))).toBe('the draft has no section')
  })

  it('builds one paper when the stock allows one, and reports a short stock without failing', async () => {
    const one = new Fake({ PHY: [...stock('t4', 30, 1), ...stock('t5', 30, 500)] })
    const r1 = await lines(one, opts({ apply: true }))
    expect(r1.summary).toMatchObject({ exit: 0, papersCreated: 1 })
    const none = new Fake({ PHY: stock('t4', 10, 1) })
    const r0 = await lines(none, opts({ apply: true }))
    expect(r0.summary).toMatchObject({ exit: 0, papersCreated: 0, blueprintsCreated: 0 })
    expect(r0.out.join('\n')).toContain('SKIPPED')
    expect(none.writes).toEqual([])
  })

  it('--sets=1 builds one paper', async () => {
    const gw = full()
    const { summary } = await lines(gw, opts({ apply: true, sets: 1 }))
    expect(summary.papersCreated).toBe(1)
  })
})

describe('the blueprint', () => {
  const stockOk = { PHY: [...stock('t4', 120, 1000), ...stock('t5', 120, 5000)] }

  it('keeps an active Spec blueprint of the K1 shape', async () => {
    const gw = new Fake(stockOk)
    gw.blueprints.set('PHY', k1Blueprint())
    const { summary } = await lines(gw, opts({ apply: true }))
    expect(summary.blueprintsCreated).toBe(0)
    expect(summary.papersCreated).toBe(2)
  })

  it('blocks (exit 3) a blueprint that does not fit, and changes nothing', async () => {
    const gw = new Fake(stockOk)
    gw.blueprints.set('PHY', k1Blueprint({ sections: [{ ruleType: 'all', questionCount: 10, markBudget: 10 }] }))
    const { summary, out } = await lines(gw, opts({ apply: true }))
    expect(summary.exit).toBe(3)
    expect(gw.writes).toEqual([])
    expect(out.join('\n')).toContain('--replace-blueprints')
  })

  it('adds a new version over a Spec blueprint that does not fit, only with --replace-blueprints', async () => {
    const gw = new Fake(stockOk)
    gw.blueprints.set('PHY', k1Blueprint({ sections: [{ ruleType: 'all', questionCount: 10, markBudget: 10 }] }))
    const { summary } = await lines(gw, opts({ apply: true, replaceBlueprints: true }))
    expect(summary).toMatchObject({ exit: 0, blueprintsCreated: 1, papersCreated: 2 })
    expect(gw.writes[0]).toBe('blueprint-version:PHY')
  })

  it('never replaces a Disahkan blueprint', async () => {
    const gw = new Fake(stockOk)
    gw.blueprints.set('PHY', k1Blueprint({ source: 'verified', sections: [{ ruleType: 'all', questionCount: 10, markBudget: 10 }] }))
    const { summary } = await lines(gw, opts({ apply: true, replaceBlueprints: true }))
    expect(summary.exit).toBe(3)
    expect(gw.writes).toEqual([])
  })

  it('treats a Draf blueprint as not fitting (the API cannot make a paper from it)', () => {
    const plan = planTarget(
      target('PHY'),
      { name: 'Fizik', candidates: stockOk.PHY, blueprint: k1Blueprint({ source: 'draft' }), existing: [] },
      { sets: 2, replaceBlueprints: false },
    )
    expect(plan.state).toBe('blocked')
  })
})

describe('Sains', () => {
  const sn = { SN: [...stock('t4', 100, 1), ...stock('t5', 100, 500)] }

  it('is blocked when neither the repo nor a blueprint gives the paper code', async () => {
    const gw = new Fake(sn)
    const { summary, out } = await lines(gw, opts({ apply: true, subjects: ['SN'] }))
    expect(summary.exit).toBe(3)
    expect(gw.writes).toEqual([])
    expect(out.join('\n')).toContain('--sn-code')
  })

  it('is built with --sn-code, and uses the code of an existing blueprint without it', async () => {
    const withFlag = new Fake(sn)
    const a = await lines(withFlag, opts({ apply: true, subjects: ['SN'], snCode: '1511/1' }))
    expect(a.summary).toMatchObject({ exit: 0, blueprintsCreated: 1, papersCreated: 2 })
    const existing = new Fake(sn)
    existing.blueprints.set('SN', k1Blueprint({ code: '9999/1' }))
    const b = await lines(existing, opts({ apply: true, subjects: ['SN'] }))
    expect(b.summary).toMatchObject({ exit: 0, blueprintsCreated: 0, papersCreated: 2 })
  })

  it('is skipped, not blocked, when the stock is short', async () => {
    const gw = new Fake({ SN: stock('t4', 12, 1) })
    const { summary } = await lines(gw, opts({ apply: true, subjects: ['SN'] }))
    expect(summary.exit).toBe(0)
    expect(gw.writes).toEqual([])
  })
})

describe('overlap guard', () => {
  it('blocks a new paper that would share a question with an earlier draft', () => {
    const candidates = [...stock('t4', 100, 1), ...stock('t5', 100, 500)]
    const planned = planTarget(target('PHY'), { name: 'Fizik', candidates, blueprint: k1Blueprint(), existing: [] }, { sets: 2, replaceBlueprints: false })
    const first = planned.papers[0]!
    const second = planned.papers[1]!
    // Set 1 exists with the planned questions of set 2 (an older run picked differently).
    const existing: ExistingPaper[] = [{ id: '9', title: paperTitle('Fizik', 1), status: 'draft', questionIds: second.ids }]
    const plan = planTarget(target('PHY'), { name: 'Fizik', candidates, blueprint: k1Blueprint(), existing }, { sets: 2, replaceBlueprints: false })
    expect(plan.papers[0]?.action).toBe('exists')
    expect(plan.papers[1]?.action).toBe('exists') // set 2 holds exactly those questions (found by content)
    expect(first.ids).not.toEqual(second.ids)
  })

  it('blocks when the earlier draft overlaps but does not equal the new set', () => {
    const candidates = [...stock('t4', 100, 1), ...stock('t5', 100, 500)]
    const planned = planTarget(target('PHY'), { name: 'Fizik', candidates, blueprint: k1Blueprint(), existing: [] }, { sets: 2, replaceBlueprints: false })
    const overlap = [planned.papers[1]!.ids[0]!, '1', '2']
    const existing: ExistingPaper[] = [{ id: '9', title: paperTitle('Fizik', 1), status: 'draft', questionIds: overlap }]
    const plan = planTarget(target('PHY'), { name: 'Fizik', candidates, blueprint: k1Blueprint(), existing }, { sets: 2, replaceBlueprints: false })
    expect(plan.papers[0]?.action).toBe('exists')
    expect(plan.papers[1]?.action).toBe('blocked')
  })
})
