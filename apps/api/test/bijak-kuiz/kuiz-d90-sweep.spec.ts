/**
 * D90 sweep of the pupil Simulasi Kuiz (lane A3): a stimulus group is ONE unit, shown once with all its members, never a question of its own and
 * never marked. Real wiring (auth + BijakIntegrationModule + the BE-09 seed); HTTP only.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootIntegrationApp, type Client, type IntegrationApp, loginAs, START, STUDENT } from '../bijak-integration/helpers'

process.env.THROTTLE_BIJAK_KUIZ_START_PER_MINUTE = '60'

let t: IntegrationApp
let student: Client
const ids = new Map<string, string>()
const id = (ref: string): string => {
  const v = ids.get(ref)
  if (!v) throw new Error(`seed question ${ref} not found`)
  return v
}
const SECRET = 'Penjelasan-rahsia-'

beforeAll(async () => {
  t = await bootIntegrationApp()
  student = await loginAs(t, STUDENT)
  const rows = await t.db.query<{ id: string; ref: string }>(
    `select q.id::text as id, v.number_label as ref from questions q
       join question_versions v on v.question_id = q.id and v.version_no = q.latest_version_no
      where v.number_label like 'SEED-%'`,
  )
  for (const r of rows) ids.set(r.ref, r.id)
  // a distinctive explanation on every seed question: it must never appear before the answer is checked
  await t.db.query(`update question_versions set explanation_ms = '${SECRET}' || question_id::text`)
}, 180_000)
afterAll(async () => {
  await t.close()
})

async function createPaper(title: string, sections: { label: string; questionIds: string[] }[]): Promise<string> {
  const subject = await t.db.prisma.subject.findFirstOrThrow({ where: { code: 'MATH' } })
  const paper = await t.db.prisma.paper.create({
    data: {
      kind: 'pilihan',
      title,
      subjectId: subject.id,
      kertas: 1,
      paperCode: '1449/1',
      printedDurationMin: 60,
      status: 'published',
      publishedAt: new Date(START),
      sections: {
        create: sections.map((s, i) => ({
          position: i + 1,
          label: s.label,
          instruction: null,
          questionCount: s.questionIds.length,
          markBudget: 0,
          placements: { create: s.questionIds.map((q, j) => ({ questionId: BigInt(q), position: j + 1 })) },
        })),
      },
    },
  })
  return paper.id.toString()
}
type Raw = { items: Record<string, unknown>[]; groups: { id: string; stimuli: Record<string, unknown>[] }[]; pageCount: number; markableTotal: number }
const page = async (paper: string, n = 1): Promise<Raw> => {
  const res = await student.get(`/api/bijak/kuiz/papers/${paper}?page=${String(n)}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body.data as Raw
}
const PASSAGE = 'Pasar tani di pekan kecil itu dibuka setiap hujung minggu'
const count = (raw: unknown, text: string): number => JSON.stringify(raw).split(text).length - 1
const ITEM_KEYS = ['groupId', 'id', 'kind', 'lead', 'markable', 'marks', 'options', 'path', 'prompt', 'stem', 'stimuli', 'subjectName']
const STIMULUS_KEYS = ['alt', 'body', 'caption', 'imageToken', 'kind', 'label', 'source', 'table']

describe('per-paper quiz: a mixed paper (a group, solo MCQs and a structured question)', () => {
  it('serves the group stimulus ONCE, its members contiguous in group order at the first member, solos with no stimulus, and the stimulus with no marks or number', async () => {
    // placed apart and out of group order on purpose: solo, member 3, solo, member 1, structured, member 2
    const paper = await createPaper('Kertas campuran', [
      {
        label: 'Bahagian A',
        questionIds: [id('SEED-MCQ-MATH-T4'), id('SEED-GRP-PASAR-3'), id('SEED-MCQ-BM-T4'), id('SEED-GRP-PASAR-1'), id('SEED-STR-ECF'), id('SEED-GRP-PASAR-2')],
      },
    ])
    const p = await page(paper)
    const order = p.items.map((i) => String(i.id))
    const structured = order.filter((x) => x.startsWith(`${id('SEED-STR-ECF')}:`))
    expect(structured.length).toBeGreaterThan(0)
    // the group sits at the place of its first PLACED member (after the first solo), members in published order, then the rest in placement order
    expect(order).toEqual([id('SEED-MCQ-MATH-T4'), id('SEED-GRP-PASAR-1'), id('SEED-GRP-PASAR-2'), id('SEED-GRP-PASAR-3'), id('SEED-MCQ-BM-T4'), ...structured])
    // the stimulus is on the page ONCE (the group entry), never on an item
    expect(p.groups).toHaveLength(1)
    expect(p.groups[0]!.stimuli).toHaveLength(1)
    expect(count(p, PASSAGE)).toBe(1)
    expect(p.items.every((i) => (i.stimuli as unknown[]).length === 0)).toBe(true)
    // members carry the group id, solos and the structured question none
    const groupOf = (ref: string) => p.items.find((i) => i.id === id(ref))!.groupId
    expect(['SEED-GRP-PASAR-1', 'SEED-GRP-PASAR-2', 'SEED-GRP-PASAR-3'].map(groupOf)).toEqual(Array(3).fill(p.groups[0]!.id))
    expect([groupOf('SEED-MCQ-MATH-T4'), groupOf('SEED-MCQ-BM-T4')]).toEqual([null, null])
    expect(p.items.filter((i) => structured.includes(String(i.id))).every((i) => i.groupId === null && i.kind === 'open')).toBe(true)
    // the stimulus is not a question and carries no marks, no number and no id; its marks are the members' only
    expect(Object.keys(p.groups[0]!.stimuli[0]!).sort()).toEqual(STIMULUS_KEYS)
    expect(Object.keys(p.groups[0]!).sort()).toEqual(['id', 'stimuli'])
    expect(p.items.filter((i) => i.groupId !== null).map((i) => i.marks)).toEqual([1, 1, 1])
    // the whole page is "the items plus once the group": nothing else is an item
    expect(p.items.length).toBe(order.length)
  })
})

describe('per-paper quiz: a group whose members span Bahagian (legacy / ETL data; the builder refuses it and Terbit flags GROUP_SPLIT)', () => {
  it('shows the stimulus once PER PAGE with only that Bahagian\'s members; no member is ever an item without its group entry on the same page', async () => {
    const paper = await createPaper('Kertas kumpulan terbelah', [
      { label: 'Bahagian A', questionIds: [id('SEED-GRP-PASAR-1'), id('SEED-MCQ-MATH-T4')] },
      { label: 'Bahagian B', questionIds: [id('SEED-GRP-PASAR-2'), id('SEED-GRP-PASAR-3')] },
    ])
    const first = await page(paper, 1)
    const second = await page(paper, 2)
    expect(first.pageCount).toBe(2)
    expect(first.items.map((i) => i.id)).toEqual([id('SEED-GRP-PASAR-1'), id('SEED-MCQ-MATH-T4')])
    expect(second.items.map((i) => i.id)).toEqual([id('SEED-GRP-PASAR-2'), id('SEED-GRP-PASAR-3')])
    for (const p of [first, second]) {
      expect(p.groups).toHaveLength(1)
      expect(count(p, PASSAGE)).toBe(1)
      expect(p.items.every((i) => (i.stimuli as unknown[]).length === 0)).toBe(true)
      const known = new Set(p.groups.map((g) => g.id))
      expect(p.items.filter((i) => i.groupId !== null).every((i) => known.has(String(i.groupId)))).toBe(true)
    }
  })
})

describe('a group whose stimulus cannot be shown', () => {
  it('its members are not served at all (never as bare questions): not on the paper page, not marked, not in the random quiz; the other questions are unaffected', async () => {
    const stim = (await t.db.query<{ id: string }>(`select s.id::text id from stimuli s join stimulus_group_stimuli gs on gs.stimulus_id = s.id join questions q on q.group_id = gs.group_id where q.id = $1::bigint`, [id('SEED-GRP-PASAR-1')]))[0]!.id
    await t.db.query(`update stimuli set body_ms = null, asset_file_id = null where id = $1::bigint`, [stim])
    try {
      const paper = await createPaper('Kertas rangsangan kosong', [
        { label: 'Bahagian A', questionIds: [id('SEED-MCQ-MATH-T4'), id('SEED-GRP-PASAR-1'), id('SEED-GRP-PASAR-2'), id('SEED-GRP-PASAR-3')] },
      ])
      const p = await page(paper)
      expect(p.items.map((i) => i.id)).toEqual([id('SEED-MCQ-MATH-T4')])
      expect(p.groups).toEqual([])
      expect(p.markableTotal).toBe(1)
      const check = await student.post(`/api/bijak/kuiz/papers/${paper}/check`, { itemId: id('SEED-GRP-PASAR-2'), optionId: 'A' })
      expect(check.status).toBe(422)
      const random = await student.post('/api/bijak/kuiz/sessions', { subject: 'BM', count: 5 })
      expect(random.status, JSON.stringify(random.body)).toBe(201)
      const served = (random.body.data.items as { id: string }[]).map((i) => i.id)
      for (const ref of ['SEED-GRP-PASAR-1', 'SEED-GRP-PASAR-2', 'SEED-GRP-PASAR-3']) expect(served).not.toContain(id(ref))
      expect(served.length).toBeGreaterThan(0)
    } finally {
      await t.db.query(`update stimuli set body_ms = $2 where id = $1::bigint`, [stim, `${PASSAGE}. Penjual menyusun sayur, buah dan kuih di atas meja panjang. Pembeli datang awal untuk mendapatkan barangan yang segar.`])
    }
  })
})

describe('no answer leak on the kuiz wire (allow-list, as chain-qa step 7)', () => {
  it('the paper page and the random quiz carry only the contract keys, no key-like name, and neither the explanation text nor the reason', async () => {
    const paper = await createPaper('Kertas kunci', [
      { label: 'Bahagian A', questionIds: [id('SEED-MCQ-MATH-T4'), id('SEED-GRP-PASAR-1'), id('SEED-GRP-PASAR-2'), id('SEED-STR-ECF')] },
    ])
    const random = await student.post('/api/bijak/kuiz/sessions', { subject: 'BM', count: 5 })
    expect(random.status).toBe(201)
    const wires: { name: string; body: unknown; items: Record<string, unknown>[]; groups: { stimuli: Record<string, unknown>[] }[] }[] = [
      { name: 'paper page', body: await page(paper), items: (await page(paper)).items, groups: (await page(paper)).groups },
      { name: 'random quiz', body: random.body.data, items: random.body.data.items as Record<string, unknown>[], groups: [] },
    ]
    for (const w of wires) {
      expect(w.items.length, w.name).toBeGreaterThan(0)
      for (const item of w.items) {
        expect(Object.keys(item).sort(), `${w.name} item ${String(item.id)}`).toEqual(ITEM_KEYS)
        for (const o of item.options as Record<string, unknown>[]) expect(Object.keys(o).sort(), `${w.name} option`).toEqual(['id', 'imageToken', 'label', 'text'])
        for (const s of item.stimuli as Record<string, unknown>[]) expect(Object.keys(s).sort(), `${w.name} stimulus`).toEqual(STIMULUS_KEYS)
      }
      for (const g of w.groups) for (const s of g.stimuli) expect(Object.keys(s).sort()).toEqual(STIMULUS_KEYS)
      const keyNames: string[] = []
      const walk = (n: unknown): void => {
        if (Array.isArray(n)) n.forEach(walk)
        else if (n !== null && typeof n === 'object') for (const [k, v] of Object.entries(n)) {
          keyNames.push(k)
          walk(v)
        }
      }
      walk(w.body)
      expect(keyNames.filter((k) => /correct|answer|key|scheme|reason|solution|explan/i.test(k)), w.name).toEqual([])
      expect(JSON.stringify(w.body), w.name).not.toContain(SECRET)
    }
  })
})

describe('Simulasi (the exam attempt) follows the same one-unit rule as the Kuiz', () => {
  const QUESTION_KEYS = ['formOrigin', 'groupId', 'id', 'marks', 'mcq', 'number', 'parts', 'sectionId', 'stem', 'topic']
  const startExam = (paper: string) => student.post('/api/bijak/attempts', { paperId: paper, mode: 'exam' })

  it('a mixed paper: one group entry with the stimulus once, its members contiguous, no stimulus on any question, no marks or number on the stimulus, no key on the wire', async () => {
    const paper = await createPaper('Kertas simulasi campuran', [
      { label: 'Bahagian A', questionIds: [id('SEED-MCQ-MATH-T4'), id('SEED-GRP-PASAR-1'), id('SEED-GRP-PASAR-2'), id('SEED-GRP-PASAR-3'), id('SEED-MCQ-BM-T4'), id('SEED-STR-ECF')] },
    ])
    const started = await startExam(paper)
    expect(started.status, JSON.stringify(started.body)).toBe(201)
    const res = await student.get(`/api/bijak/attempts/${started.body.data.attemptId}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const view = res.body.data as {
      questions: Record<string, unknown>[]
      groups: { id: string; stimulus: Record<string, unknown>; stimuli: Record<string, unknown>[]; from: number; to: number; questionIds: string[] }[]
    }
    expect(view.questions.map((q) => q.id).slice(0, 5)).toEqual([id('SEED-MCQ-MATH-T4'), id('SEED-GRP-PASAR-1'), id('SEED-GRP-PASAR-2'), id('SEED-GRP-PASAR-3'), id('SEED-MCQ-BM-T4')])
    expect(view.groups).toHaveLength(1)
    const g = view.groups[0]!
    expect(g.questionIds).toEqual([id('SEED-GRP-PASAR-1'), id('SEED-GRP-PASAR-2'), id('SEED-GRP-PASAR-3')])
    expect([g.from, g.to]).toEqual([2, 4]) // contiguous: the numbers of the members, no other question inside
    expect(g.stimuli).toHaveLength(1)
    // the passage text is on the wire as the group's `stimulus` and in its one-item `stimuli` list: nothing on any question
    expect(count(view, PASSAGE)).toBe(2)
    expect(view.questions.every((q) => !('stimuli' in q) && !('stimulus' in q) && !('stemImage' in q))).toBe(true)
    expect(Object.keys(g.stimulus).filter((k) => /mark|number|questionId|score/i.test(k))).toEqual([])
    // the members carry the group id; solos and the structured question do not
    expect(view.questions.filter((q) => q.groupId !== undefined).map((q) => q.id)).toEqual(g.questionIds)
    // allow-list of question keys, no key-like name anywhere, no explanation text
    for (const q of view.questions) expect(Object.keys(q).filter((k) => !QUESTION_KEYS.includes(k)), `question ${String(q.id)}`).toEqual([])
    const names: string[] = []
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) n.forEach(walk)
      else if (n !== null && typeof n === 'object') for (const [k, v] of Object.entries(n)) {
          names.push(k)
          walk(v)
        }
    }
    walk(res.body.data)
    expect(names.filter((k) => /correct|answerKey|scheme|reason|solution|explan|modelText|rubric/i.test(k))).toEqual([])
    expect(JSON.stringify(res.body)).not.toContain(SECRET)
  })

  it('a group whose stimulus cannot be shown: the paper is refused (403, "sedang dikemas kini"); no member is ever served as a bare question', async () => {
    const stim = (await t.db.query<{ id: string }>(`select s.id::text id from stimuli s join stimulus_group_stimuli gs on gs.stimulus_id = s.id join questions q on q.group_id = gs.group_id where q.id = $1::bigint`, [id('SEED-GRP-PASAR-1')]))[0]!.id
    const before = (await t.db.query<{ body_ms: string }>(`select body_ms from stimuli where id = $1::bigint`, [stim]))[0]!.body_ms
    await t.db.query(`update stimuli set body_ms = null, asset_file_id = null where id = $1::bigint`, [stim])
    try {
      const paper = await createPaper('Kertas simulasi rangsangan kosong', [{ label: 'Bahagian A', questionIds: [id('SEED-MCQ-MATH-T4'), id('SEED-GRP-PASAR-1'), id('SEED-GRP-PASAR-2')] }])
      const res = await startExam(paper)
      expect(res.status, JSON.stringify(res.body)).toBe(403)
      expect(res.body.error.message).toBe('Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini.')
      expect(await t.db.query(`select 1 from exam_attempts where paper_id = $1::bigint`, [paper])).toHaveLength(0)
    } finally {
      await t.db.query(`update stimuli set body_ms = $2 where id = $1::bigint`, [stim, before])
    }
  })
})
