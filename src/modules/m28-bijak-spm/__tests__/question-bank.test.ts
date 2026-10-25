import { describe, expect, it } from 'vitest'

import { BANK } from '../data/registry'
import { REVIEW_SEEDS } from '../data/review-seed'
import { addUnit, checkPaper, moveUnit, removeUnit, unitsOf } from '../domain/paper-builder'
import { BijakServer, MemoryStorage } from '../server/store'

import { t13Tag } from './tag-fixtures'

const USER = 7
const GROUP = 'mat2-rev-g1'

// The second question of GROUP is a flagged seed (DSKP-T04: no SP matches "Luas dan trigonometri"),
// and after DSKP-T05 a flagged question cannot be published (AC-07.5; the gate is interim until then).
// This file approves GROUP, so its fixture stands in for the person who tags it in Sunting: a T1-T3
// tag (TP as authored), set before any server exists. The seed itself stays flagged
// (seed-tags.test.ts).
for (const seed of REVIEW_SEEDS)
  for (const q of seed.questions)
    if (q.id === `${GROUP}-q2`) q.curriculum = t13Tag({ tp: q.curriculum.tp })

function make(storage = new MemoryStorage()) {
  const now = { t: 1_800_000_000_000 }
  const server = new BijakServer({ storage, now: () => now.t })
  return { server, storage, now }
}

/* ------------------------------------------------------------- pure builder rules */

const groups: Record<string, string[]> = { G: ['g1', 'g2', 'g3'], H: ['h1', 'h2'] }
const groupOf = (id: string): string | undefined =>
  Object.entries(groups).find(([, m]) => m.includes(id))?.[0]
const membersOf = (g: string): string[] => groups[g] ?? []

describe('stimulus groups move as one unit', () => {
  it('adding one member adds the whole group, in published order', () => {
    expect(addUnit(['a'], 'g2', groupOf, membersOf)).toEqual(['a', 'g1', 'g2', 'g3'])
  })
  it('does not add twice', () => {
    expect(addUnit(['g1', 'g2', 'g3'], 'g3', groupOf, membersOf)).toEqual(['g1', 'g2', 'g3'])
  })
  it('removing one member removes the whole group', () => {
    expect(removeUnit(['a', 'g1', 'g2', 'g3', 'b'], 'g2', groupOf)).toEqual(['a', 'b'])
  })
  it('moving a unit never splits a group', () => {
    const ids = ['a', 'g1', 'g2', 'g3', 'b', 'h1', 'h2']
    expect(moveUnit(ids, 1, 1, groupOf)).toEqual(['a', 'b', 'g1', 'g2', 'g3', 'h1', 'h2'])
    expect(moveUnit(ids, 3, -1, groupOf)).toEqual(['a', 'g1', 'g2', 'g3', 'h1', 'h2', 'b'])
    for (const out of [moveUnit(ids, 1, 1, groupOf), moveUnit(ids, 3, -1, groupOf)])
      expect(unitsOf(out, groupOf).filter((u) => u.groupId === 'G')).toHaveLength(1)
  })
  it('refuses to move past the ends', () => {
    expect(moveUnit(['a', 'b'], 0, -1, groupOf)).toEqual(['a', 'b'])
    expect(moveUnit(['a', 'b'], 1, 1, groupOf)).toEqual(['a', 'b'])
  })
})

describe('budget check (blueprint conformance)', () => {
  const marks: Record<string, number> = { a: 3, b: 3, c: 3, g1: 2, g2: 2, g3: 2, h1: 1, h2: 1 }
  const input = (sections: string[][], live: (id: string) => boolean = () => true) => ({
    specs: [{ label: 'A', markBudget: 9, questionCount: 3, rule: { type: 'all' } as const }],
    sections: sections.map((questionIds) => ({ questionIds })),
    marksOf: (id: string) => marks[id] ?? 0,
    groupOf,
    membersOf,
    isLive: live,
  })

  it('passes when count and marks match', () => {
    const c = checkPaper(input([['a', 'b', 'c']]))
    expect(c.ok).toBe(true)
    expect(c.totalMarks).toBe(9)
  })
  it('warns about count and marks (N-11: blueprint not followed)', () => {
    const c = checkPaper(input([['a', 'b']]))
    expect(c.ok).toBe(false)
    expect(c.sections[0]!.errors.join('|')).toContain('Kurang 1 soalan')
    expect(c.sections[0]!.errors.join('|')).toContain('Markah 6 tidak sama dengan bajet 9')
  })
  it('flags an incomplete group', () => {
    const c = checkPaper(input([['g1', 'g2', 'a']]))
    expect(c.sections[0]!.errors.join('|')).toContain('tidak lengkap')
  })
  it('flags a group that is not contiguous', () => {
    const c = checkPaper(input([['g1', 'a', 'g2', 'g3']]))
    expect(c.sections[0]!.errors.join('|')).toContain('tidak berturutan')
  })
  it('flags duplicates and unpublished questions', () => {
    const dup = checkPaper(input([['a', 'a', 'b']]))
    expect(dup.errors.join('|')).toContain('berulang')
    const draft = checkPaper(input([['a', 'b', 'c']], (id) => id !== 'c'))
    expect(draft.sections[0]!.errors.join('|')).toContain('1 soalan belum Terbit')
  })
  it('choose N counts only the N largest questions', () => {
    const c = checkPaper({
      ...input([['a', 'b']]),
      specs: [{ label: 'C', markBudget: 3, questionCount: 2, rule: { type: 'choose', n: 1 } }],
    })
    expect(c.ok).toBe(true)
  })
})

/* ------------------------------------------------------------------- review flow */

describe('review queue', () => {
  it('lists the seeded questions waiting for review and filters them', async () => {
    const { server } = make()
    const all = await server.listReviewQueue()
    expect(all.items.length).toBeGreaterThanOrEqual(6)
    expect(all.items.every((i) => i.status === 'semakan')).toBe(true)
    const mat1 = await server.listReviewQueue({ subject: 'MAT', kertas: 1, kind: 'objektif' })
    expect(mat1.items.every((i) => i.subject === 'MAT' && i.kertas === 1)).toBe(true)
    expect(mat1.items.length).toBeGreaterThan(0)
    const group = all.items.find((i) => i.groupId === GROUP)!
    expect(group.questionIds).toHaveLength(2)
  })

  it('does not serve a pending question to students', async () => {
    const { server } = make()
    expect(BANK.questions.has('mat1-rev-1')).toBe(false)
    expect((await server.listBank({ status: 'terbit' })).some((r) => r.id === 'mat1-rev-1')).toBe(
      false,
    )
  })

  it('renders a group once with its scheme', async () => {
    const { server } = make()
    const d = await server.getReviewItem(GROUP)
    expect(d.questions).toHaveLength(2)
    expect(d.stimulus?.label).toBe('Rajah 1')
    expect(d.questions[0]!.scheme['mat2-rev-g1-q1-a']?.lines.length).toBeGreaterThan(0)
    expect(d.gate).toEqual([])
  })

  it('refuses to publish a question without an answer key', async () => {
    const { server } = make()
    const d = await server.getReviewItem('mat1-rev-3')
    expect(d.gate.join('|')).toContain('skema jawapan belum ada')
    const r = await server.reviewDecision('mat1-rev-3', { action: 'terbit' })
    expect(r.ok).toBe(false)
    expect((await server.getReviewItem('mat1-rev-3')).item.status).toBe('semakan')
  })

  it('Tolak and Minta Pembetulan need a reason; Lulus publishes the whole group', async () => {
    const { server } = make()
    expect((await server.reviewDecision('mat1-rev-1', { action: 'tolak' })).ok).toBe(false)
    expect(
      (await server.reviewDecision('mat1-rev-1', { action: 'betulkan', reason: 'Pilihan C kabur' }))
        .ok,
    ).toBe(true)
    expect((await server.listReviewQueue({ status: 'draf' })).items.map((i) => i.key)).toContain(
      'mat1-rev-1',
    )
    expect(
      (await server.reviewDecision('mat1-rev-2', { action: 'tolak', reason: 'Pendua' })).ok,
    ).toBe(true)
    expect((await server.reviewDecision(GROUP, { action: 'terbit' })).ok).toBe(true)
    const live = await server.listBank({ status: 'terbit', subject: 'MAT', kertas: 2 })
    expect(live.filter((r) => r.groupId === GROUP)).toHaveLength(2)
    // a second decision on a decided item is refused
    expect((await server.reviewDecision(GROUP, { action: 'terbit' })).ok).toBe(false)
  })

  it('survives a refresh (state is persisted)', async () => {
    const { server, storage } = make()
    await server.reviewDecision('mat1-rev-1', { action: 'terbit' })
    const again = new BijakServer({ storage })
    expect((await again.listBank({ q: 'mat1-rev-1' })).map((r) => r.status)).toEqual(['terbit'])
  })
})

describe('versioning after publish', () => {
  it('Sunting creates version n+1 for review while the live version keeps serving', async () => {
    const { server } = make()
    const id = 'mat1-pub-1'
    const live = (await server.getBankDetail(id)).question.stem
    expect(
      (await server.reviseQuestion(id, 'Selesaikan $3x - 5 = 10$ untuk $x$.', 'Jelaskan')).ok,
    ).toBe(true)
    expect((await server.getBankDetail(id)).question.stem).toBe(live)
    const q = await server.listReviewQueue()
    const item = q.items.find((i) => i.key === `v:${id}`)!
    expect(item.isRevision).toBe(true)
    expect(item.version).toBe(2)
    expect((await server.reviewDecision(`v:${id}`, { action: 'terbit' })).ok).toBe(true)
    const after = await server.getBankDetail(id)
    expect(after.question.stem).toContain('untuk $x$')
    expect(after.row.version).toBe(2)
    expect(after.history.map((h) => h.action).join('|')).toContain('Diarkibkan (digantikan)')
  })
})

/* ------------------------------------------------------------------ paper builder */

async function validMatK2(server: BijakServer) {
  await server.reviewDecision(GROUP, { action: 'terbit' })
  const id = await server.createPaper({ subject: 'MAT', kertas: 2, title: 'Set Ujian Ketiga' })
  const ed = await server.getPaperEditor(id)
  const [a, b, c] = ed.paper.sections
  await server.savePaper(id, {
    sections: [
      { id: a!.id, questionIds: [`${GROUP}-q1`, `${GROUP}-q2`, 'mat2-diskaun-v1'] },
      { id: b!.id, questionIds: ['mat2-garis-v1'] },
      { id: c!.id, questionIds: ['mat2-statistik-v1', 'mat2-kuadratik-v1'] },
    ],
  })
  return id
}

describe('paper builder', () => {
  it('loads the blueprint when a paper is created', async () => {
    const { server } = make()
    const id = await server.createPaper({ subject: 'MAT', kertas: 2 })
    const ed = await server.getPaperEditor(id)
    expect(ed.paper.sections.map((s) => [s.label, s.questionCount, s.markBudget])).toEqual([
      ['Bahagian A', 3, 9],
      ['Bahagian B', 1, 6],
      ['Bahagian C', 2, 6],
    ])
    expect(ed.paper.sections[2]!.rule).toEqual({ type: 'choose', n: 1 })
    expect(ed.blueprint?.durationMin).toBe(150)
  })

  it('refuses a subject and kertas without a blueprint', async () => {
    const { server } = make()
    await expect(server.createPaper({ subject: 'SEJ', kertas: 2 })).rejects.toMatchObject({
      code: 'bad_request',
    })
  })

  it('has a seeded draft paper that does not conform yet', async () => {
    const { server } = make()
    const list = await server.listAdminPapers()
    const seed = list.find((p) => p.id === 'kp-seed-1')!
    expect(seed.status).toBe('draf')
    expect(seed.ok).toBe(false)
  })

  it('refuses to publish when the blueprint is not followed, with the reasons', async () => {
    const { server } = make()
    const res = await server.publishPaper('kp-seed-1')
    expect(res.ok).toBe(false)
    expect(res.errors.join('|')).toContain('Bahagian A: Kurang 1 soalan')
    expect((await server.listAdminPapers()).find((p) => p.id === 'kp-seed-1')!.status).toBe('draf')
  })

  it('refuses a split group and an unpublished question', async () => {
    const { server } = make()
    const id = await server.createPaper({ subject: 'MAT', kertas: 2 })
    const ed = await server.getPaperEditor(id)
    await server.savePaper(id, {
      sections: [
        {
          id: ed.paper.sections[0]!.id,
          questionIds: ['mat2-segitiga-v1-q1', 'mat2-diskaun-v1', 'mat2-diskaun-v2'],
        },
        { id: ed.paper.sections[1]!.id, questionIds: ['mat2-garis-v1'] },
        { id: ed.paper.sections[2]!.id, questionIds: [GROUP + '-q1', 'mat2-kuadratik-v1'] },
      ],
    })
    const res = await server.publishPaper(id)
    expect(res.ok).toBe(false)
    expect(res.errors.join('|')).toContain('tidak lengkap')
    expect(res.errors.join('|')).toContain('belum Terbit')
  })

  it('offers only Terbit questions of the same subject and kertas as candidates', async () => {
    const { server } = make()
    const id = await server.createPaper({ subject: 'MAT', kertas: 2 })
    const ed = await server.getPaperEditor(id)
    expect(ed.questions.every((q) => q.status === 'terbit')).toBe(true)
    expect(ed.questions.every((q) => q.subject === 'MAT' && q.kertas === 2)).toBe(true)
    expect(ed.questions.some((q) => q.id.startsWith('mat1-'))).toBe(false)
  })

  it('publish makes the paper visible and playable for students', async () => {
    const { server } = make()
    const before = await server.listPapers(USER)
    const id = await validMatK2(server)
    expect(before.some((p) => p.id === id)).toBe(false)

    // a draft is not visible
    expect((await server.listPapers(USER)).some((p) => p.id === id)).toBe(false)

    const res = await server.publishPaper(id)
    expect(res).toEqual({ ok: true, errors: [] })

    const hub = await server.listPapers(USER)
    const row = hub.find((p) => p.id === id)!
    expect(row.title).toBe('Set Ujian Ketiga')
    expect(row.questionCount).toBe(6)
    expect(row.marks).toBe(9 + 6 + 6)

    const cover = await server.getCover(USER, id)
    expect(cover.sections.map((s) => s.questionCount)).toEqual([3, 1, 2])

    const { attemptId } = await server.startAttempt(USER, id, 'exam')
    const view = await server.getAttemptView(USER, attemptId)
    expect(view.questions).toHaveLength(6)
    expect(view.groups).toHaveLength(1)
    expect(view.groups[0]!.questionIds).toEqual([`${GROUP}-q1`, `${GROUP}-q2`])
    expect(view.groups[0]!.stimulus.label).toBe('Rajah 1')
    expect(JSON.stringify(view)).not.toContain('"scheme"')

    // unpublish hides it again
    await server.unpublishPaper(id)
    expect((await server.listPapers(USER)).some((p) => p.id === id)).toBe(false)
  })

  it('a published paper cannot be edited until it is withdrawn', async () => {
    const { server } = make()
    const id = await validMatK2(server)
    await server.publishPaper(id)
    await expect(server.savePaper(id, { title: 'Lain' })).rejects.toMatchObject({
      code: 'bad_request',
    })
    await expect(server.deletePaper(id)).rejects.toMatchObject({ code: 'bad_request' })
  })

  it('existing curated papers are unchanged for students', async () => {
    const { server } = make()
    const hub = await server.listPapers(USER)
    expect(hub.map((p) => p.id)).toEqual(
      expect.arrayContaining(['mat-k1-2025-a', 'mat-k2-2025-a', 'sn-k2-2025-a', 'sej-k2-2025-a']),
    )
  })
})
