/**
 * D90 sweep of the pupil Simulasi Kuiz (lane A3): a stimulus group is ONE unit, shown once with all its members, never a question of its own and
 * never marked. Real wiring (auth + BijakIntegrationModule + the BE-09 seed); HTTP only.
 *
 * MUTATIONS (what was changed, and which test went red; each restored afterwards, B2 can re-run them):
 * (file = the source file changed; each mutation is one edit, the test file named is the one that went red, all other tests stayed green unless noted)
 *  1. kuiz.mapper.ts `stimuliWithTokens`: part 'all' returns only the first entry (V2 "first stimulus only")  -> "the random Kuiz shows BOTH stimuli ..."
 *  2. kuiz.mapper.ts `stimuliWithTokens`: the 'all' and 'group' lists reversed                              -> "the random Kuiz shows BOTH stimuli ..."
 *  3. kuiz.service.ts `paperPage`: items built with the 'all' context (stimulus repeated on each member)      -> "serves the group stimulus ONCE ...", "shows the stimulus once PER PAGE ...", "the random Kuiz shows BOTH stimuli ..."
 *  4. kuiz.service.ts `paperPage`: the group entry is not pushed                                          -> "serves the group stimulus ONCE ...", "shows the stimulus once PER PAGE ...", "the random Kuiz shows BOTH stimuli ..."
 *  5. kuiz.mapper.ts `resolveStimuli`: an unshowable group stimulus no longer marks the question incomplete   -> "a group whose stimulus cannot be shown ..."
 *  6. kuiz.mapper.ts `toItem`: `stem` also carries `explanationMs`                                          -> "the paper page and the random quiz carry only the allow-mapped keys ..." (planted explanation text)
 *  7. contract kuiz schema: optional `rubric` on the page + the service sets it                              -> same test, "$.rubric: key outside the allow-map" (the recursive allow-map)
 *  8. marking.ts `partView`: `answer.expected` added to a part                                              -> "a mixed paper: one group entry ..." (Simulasi allow-map, parts[].answer)
 *  9. marking.ts `buildServedPaper`: `stem` also carries the JSON of the marking schemes                    -> "a mixed paper: one group entry ..." (planted scheme text RAHSIA-SKEMA-*)
 * 10. marking.ts `buildServedPaper`: group `to` is one too low                                              -> "a mixed paper ...", and the two "current behaviour (KIV R2)" tests
 * 11. be09-mapping.ts `stimulusDefOf`: the `stimulus_empty` refusal removed                                      -> "a group whose stimulus cannot be shown: the paper is refused ..."
 * 12. marking.ts `buildServedPaper`: the group stimulus also put on each member question                      -> "a mixed paper: one group entry ..."
 * 13. marking.ts `buildServedPaper`: group from/to taken as the FIRST and LAST member number (A4 U2)           -> NOT killed, by design: member numbers ascend in composition order, so first/last = min/max for any
 *     placement (an equivalent mutant). The out-of-order test pins the real difference, see 14.
 * 14. marking.ts `buildServedPaper`: the members gathered in published (id) order, then first/last (A4 U2 as a  -> "current behaviour (KIV R2): members placed OUT of published order ([member 3, solo, member 1]) ..."
 *     real behaviour change); also red with only the id sort (questionIds order)
 * 15. spec allow-map: the `table` entry removed from SIM_STIM                                                  -> "a group of two stimuli (table, then passage): the whole Simulasi wire, including the table level ..."
 *     ("$.groups[0].stimulus.table: key outside the allow-map")
 * 16. marking.ts `stimulusView`: `answerKey` added inside the served table grid                                 -> the same test (the planted-key control and the allow-map both report it)
 * The allow-map helper has its own positive control: `plantedLeaksAreReported` plants a top-level key, an item/question key and a `parts[].answer` key and fails unless each is reported.
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
const SCHEME_SECRETS = ['RAHSIA-SKEMA-1', 'RAHSIA-SKEMA-2']

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
  // distinctive marking-scheme text on the structured seed (the open-question scheme): same JSON shape, only two labels renamed
  await t.db.query(`update answer_keys set content = replace(replace(content::text, 'Menjumlahkan ketiga-tiga sisi', '${SCHEME_SECRETS[0]!}'), 'Perimeter = 12', '${SCHEME_SECRETS[1]!}')::jsonb where content::text like '%Menjumlahkan ketiga-tiga sisi%'`)
  expect(Number((await t.db.query<{ n: string }>(`select count(*)::text n from answer_keys where content::text like '%${SCHEME_SECRETS[0]!}%'`))[0]!.n)).toBeGreaterThan(0)
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
const STIMULUS_KEYS = ['alt', 'body', 'caption', 'imageToken', 'kind', 'label', 'source', 'table']

/**
 * A recursive allow-map: the exact key set of every object on the wire, level by level. `leaf` = a scalar; `arr(x)` = an array of x;
 * `nullable(x)`; `obj(required, optional)` = exactly those keys (an unknown key, or a missing required one, is reported with its path);
 * `empty` = an object or array with nothing in it (the pupil's own state at the start of a sitting).
 */
type Shape = 'leaf' | 'empty' | { arr: Shape } | { nullable: Shape } | { req: Record<string, Shape>; opt: Record<string, Shape> }
const arr = (x: Shape): Shape => ({ arr: x })
const nullable = (x: Shape): Shape => ({ nullable: x })
const obj = (req: Record<string, Shape>, opt: Record<string, Shape> = {}): Shape => ({ req, opt })
function leaks(v: unknown, sh: Shape, path: string): string[] {
  const isObj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)
  if (sh === 'leaf') return v !== null && typeof v === 'object' ? [`${path}: expected a scalar`] : []
  if (sh === 'empty') return (Array.isArray(v) && v.length === 0) || (isObj(v) && Object.keys(v).length === 0) ? [] : [`${path}: expected an empty value`]
  if ('arr' in sh) return Array.isArray(v) ? v.flatMap((x, i) => leaks(x, sh.arr, `${path}[${String(i)}]`)) : [`${path}: expected an array`]
  if ('nullable' in sh) return v === null ? [] : leaks(v, sh.nullable, path)
  if (!isObj(v)) return [`${path}: expected an object`]
  const out: string[] = []
  for (const k of Object.keys(v)) {
    const child = sh.req[k] ?? sh.opt[k]
    if (child === undefined) out.push(`${path}.${k}: key outside the allow-map`)
    else out.push(...leaks(v[k], child, `${path}.${k}`))
  }
  for (const k of Object.keys(sh.req)) if (!(k in v)) out.push(`${path}.${k}: required key missing`)
  return out
}
const STIM: Shape = obj({ kind: 'leaf', label: 'leaf', body: 'leaf', imageToken: 'leaf', alt: 'leaf', caption: 'leaf', source: 'leaf', table: nullable(obj({ head: arr('leaf'), rows: arr(arr('leaf')) })) })
const ITEM: Shape = obj({
  id: 'leaf', groupId: 'leaf', kind: 'leaf', stem: 'leaf', lead: arr('leaf'), path: 'leaf', prompt: 'leaf', marks: 'leaf', markable: 'leaf', subjectName: 'leaf',
  stimuli: arr(STIM), options: arr(obj({ id: 'leaf', label: 'leaf', text: 'leaf', imageToken: 'leaf' })),
})
/** `GET /api/bijak/kuiz/papers/{id}` */
const KUIZ_PAGE = obj({
  paper: obj({ id: 'leaf', title: 'leaf', subjectName: 'leaf', code: 'leaf' }), page: 'leaf', pageCount: 'leaf', section: nullable(obj({ id: 'leaf', label: 'leaf', instruction: 'leaf' })),
  items: arr(ITEM), groups: arr(obj({ id: 'leaf', stimuli: arr(STIM) })), markableTotal: 'leaf',
})
/** `POST /api/bijak/kuiz/sessions` */
const KUIZ_SESSION = obj({ sessionId: 'leaf', count: 'leaf', items: arr(ITEM) })
const SIM_STIM: Shape = obj({ id: 'leaf', kind: 'leaf', label: 'leaf', alt: 'leaf' }, { title: 'leaf', caption: 'leaf', text: 'leaf', source: 'leaf', table: obj({ head: arr('leaf'), rows: arr(arr('leaf')) }), image: obj({ url: 'leaf' }, { width: 'leaf', height: 'leaf', alt: 'leaf' }) })
const SIM_ANSWER: Shape = obj({ kind: 'leaf' }, { unit: 'leaf', wordRange: obj({ min: 'leaf', max: 'leaf' }), topics: arr(obj({ id: 'leaf', label: 'leaf' })) })
const SIM_PART: Shape = obj({ id: 'leaf', label: 'leaf', prompt: 'leaf', marks: 'leaf' }, {
  answer: SIM_ANSWER,
  children: arr({ req: { id: 'leaf', label: 'leaf', prompt: 'leaf', marks: 'leaf' }, opt: { answer: SIM_ANSWER } }),
})
/** `GET /api/bijak/attempts/{id}` at the start of a sitting (a pupil's own answers, flags, picks and checks are empty). */
const SIM_VIEW = obj({
  serverNow: 'leaf',
  attempt: obj({ id: 'leaf', paperId: 'leaf', paperKind: 'leaf', title: 'leaf', subject: 'leaf', kertas: 'leaf', code: 'leaf', mode: 'leaf', status: 'leaf', startedAt: 'leaf', deadline: 'leaf', durationMin: 'leaf', answers: 'empty', flags: 'empty', picks: 'empty', position: 'leaf', checked: 'empty' }),
  sections: arr(obj({ id: 'leaf', label: 'leaf', rule: obj({ type: 'leaf' }, { n: 'leaf' }), questionIds: arr('leaf'), marks: 'leaf', effectiveMarks: 'leaf' }, { compulsory: 'leaf', instruction: 'leaf' })),
  questions: arr(obj({ id: 'leaf', number: 'leaf', sectionId: 'leaf', topic: 'leaf', formOrigin: 'leaf', stem: 'leaf', marks: 'leaf' }, { groupId: 'leaf', mcq: obj({ options: arr(obj({ id: 'leaf', text: 'leaf' }, { image: obj({ url: 'leaf' }, { alt: 'leaf', width: 'leaf', height: 'leaf' }) })) }), parts: arr(SIM_PART) })),
  groups: arr(obj({ id: 'leaf', stimulus: SIM_STIM, stimuli: arr(SIM_STIM), from: 'leaf', to: 'leaf', questionIds: arr('leaf') })),
  checks: 'empty',
})
/** Planted secrets (set in beforeAll): the explanation of every question and the marking-scheme point labels of the structured seed. */
const secretsIn = (wire: unknown): string[] => [SECRET, ...SCHEME_SECRETS].filter((x) => JSON.stringify(wire).includes(x))
/** The positive control: a leak key planted at the top level and inside the first part/item MUST be reported by the allow-map. */
function plantedLeaksAreReported(wire: unknown, sh: Shape): void {
  const clone = structuredClone(wire) as Record<string, unknown>
  clone.rubric = { expected: 'x' }
  const found = leaks(clone, sh, '$')
  expect(found.some((f) => f.startsWith('$.rubric')), 'a planted top-level key must be reported').toBe(true)
  const list = (clone.items ?? clone.questions) as Record<string, unknown>[]
  const first = list[0]!
  first.answerKey = 'B'
  expect(leaks(clone, sh, '$').some((f) => f.includes('.answerKey')), 'a planted item/question key must be reported').toBe(true)
  const withParts = (clone.questions as Record<string, unknown>[] | undefined)?.find((q) => Array.isArray(q.parts))
  if (withParts) {
    ;((withParts.parts as Record<string, unknown>[])[0]!.answer as Record<string, unknown>).expected = '12 cm'
    expect(leaks(clone, sh, '$').some((f) => f.includes('.answer.expected')), 'a planted parts[].answer key must be reported').toBe(true)
  }
}

/** Every table grid ({ head, rows }) anywhere on a wire: the table level of the allow-map is only exercised when the wire carries one. */
function tablesOf(v: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(v)) v.forEach((x) => tablesOf(x, out))
  else if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.head) && Array.isArray(o.rows)) out.push(o)
    Object.values(o).forEach((x) => tablesOf(x, out))
  }
  return out
}
/** The positive control for the table level: a key planted INSIDE a table stimulus must be reported with its path. */
function plantedTableLeakIsReported(wire: unknown, sh: Shape): void {
  const clone = structuredClone(wire)
  const tables = tablesOf(clone)
  expect(tables.length, 'the wire must carry a table stimulus, or its allow-map level is never exercised').toBeGreaterThan(0)
  for (const tb of tables) tb.answerKey = 'x'
  const found = leaks(clone, sh, '$').filter((f) => f.includes('.table.answerKey'))
  expect(found.length, 'a key planted inside a table must be reported').toBeGreaterThanOrEqual(tables.length)
}

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

/** A group of two stimuli, the TABLE first and the passage second, over two approved questions; removed again when `run` ends. */
async function withTwoStimulusGroup(members: string[], run: (groupId: string) => Promise<void>): Promise<void> {
  const mk = async (kind: string, label: string, body: string | null, table: unknown): Promise<string> =>
    (await t.db.query<{ id: string }>(`insert into stimuli (kind, label, body_ms, table_data) values ($1, $2, $3, $4::jsonb) returning id::text`, [kind, label, body, table === null ? null : JSON.stringify(table)]))[0]!.id
  // group order is the TABLE first, then the passage: the reverse of the insertion order and of the alphabet of the kinds
  const tableId = await mk('table', 'Jadual dua', null, { head: ['Bulan', 'Jumlah'], rows: [['Jan', '10']] })
  const passageId = await mk('passage', 'Petikan dua', 'Petikan kedua untuk kumpulan dua rangsangan.', null)
  const groupId = (await t.db.query<{ id: string }>(`insert into stimulus_groups (scope) values ('section') returning id::text`))[0]!.id
  await t.db.query(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1::bigint, $2::bigint, 1), ($1::bigint, $3::bigint, 2)`, [groupId, tableId, passageId])
  await t.db.query(`update questions set group_id = $1::bigint, group_position = case id when $2::bigint then 1 else 2 end where id = any($3::bigint[])`, [groupId, members[0], members])
  try {
    await run(groupId)
  } finally {
    await t.db.query(`update questions set group_id = null, group_position = null where id = any($1::bigint[])`, [members])
    await t.db.query(`delete from stimulus_group_stimuli where group_id = $1::bigint`, [groupId])
    await t.db.query(`delete from stimulus_groups where id = $1::bigint`, [groupId])
    await t.db.query(`delete from stimuli where id = any($1::bigint[])`, [[tableId, passageId]])
  }
}

describe('a group with two stimuli (a passage and a table): D9 row "every stimulus of the group"', () => {
  it('the random Kuiz shows BOTH stimuli with each drawn member, in group order (not the first only); the paper page renders them once in the group entry', async () => {
    const members = [id('SEED-MCQ-SCI-T4'), id('SEED-MCQ-SCI-T5')]
    await withTwoStimulusGroup(members, async (groupId) => {
      const random = await student.post('/api/bijak/kuiz/sessions', { subject: 'SCI', count: 5 })
      expect(random.status, JSON.stringify(random.body)).toBe(201)
      const drawn = (random.body.data.items as { id: string; groupId: string; stimuli: { kind: string; label: string }[] }[]).filter((i) => members.includes(i.id))
      expect(drawn.map((i) => i.id).sort()).toEqual([...members].sort())
      for (const item of drawn) {
        expect(item.groupId).toBe(groupId)
        expect(item.stimuli.map((x) => [x.kind, x.label]), `item ${item.id}`).toEqual([['table', 'Jadual dua'], ['passage', 'Petikan dua']])
      }
      const paper = await createPaper('Kertas dua rangsangan', [{ label: 'Bahagian A', questionIds: members }])
      const p = await page(paper)
      expect(p.items.map((i) => i.id)).toEqual(members)
      expect(p.items.every((i) => (i.stimuli as unknown[]).length === 0)).toBe(true)
      expect(p.groups).toHaveLength(1)
      expect(p.groups[0]!.stimuli.map((x) => [x.kind, x.label])).toEqual([['table', 'Jadual dua'], ['passage', 'Petikan dua']])
      expect(count(p, 'Petikan kedua untuk kumpulan dua rangsangan.')).toBe(1)
      // the table level of the allow-map is exercised on both Kuiz wires, and a key planted inside a table is reported
      const pageRes = await student.get(`/api/bijak/kuiz/papers/${paper}`)
      expect(leaks(random.body.data, KUIZ_SESSION, '$')).toEqual([])
      expect(leaks(pageRes.body.data, KUIZ_PAGE, '$')).toEqual([])
      plantedTableLeakIsReported(random.body.data, KUIZ_SESSION)
      plantedTableLeakIsReported(pageRes.body.data, KUIZ_PAGE)
    })
  })
})

describe('a group whose stimulus cannot be shown', () => {
  it('its members are not served at all (never as bare questions): not on the paper page, not marked, not in the random quiz; the other questions are unaffected', async () => {
    const stim = (await t.db.query<{ id: string }>(`select s.id::text id from stimuli s join stimulus_group_stimuli gs on gs.stimulus_id = s.id join questions q on q.group_id = gs.group_id where q.id = $1::bigint`, [id('SEED-GRP-PASAR-1')]))[0]!.id
    const real = (await t.db.query<{ body_ms: string | null; asset_file_id: string | null }>(`select body_ms, asset_file_id::text from stimuli where id = $1::bigint`, [stim]))[0]!
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
      await t.db.query(`update stimuli set body_ms = $2, asset_file_id = $3::bigint where id = $1::bigint`, [stim, real.body_ms, real.asset_file_id])
    }
  })
})

describe('no answer leak on the kuiz wire (a recursive allow-map, as chain-qa step 7)', () => {
  it('the paper page and the random quiz carry only the allow-mapped keys at every level, and neither the explanation nor the scheme text; a planted leak key is reported', async () => {
    const paper = await createPaper('Kertas kunci', [
      { label: 'Bahagian A', questionIds: [id('SEED-MCQ-MATH-T4'), id('SEED-GRP-PASAR-1'), id('SEED-GRP-PASAR-2'), id('SEED-STR-ECF')] },
    ])
    const pageRes = await student.get(`/api/bijak/kuiz/papers/${paper}`)
    expect(pageRes.status, JSON.stringify(pageRes.body)).toBe(200)
    const random = await student.post('/api/bijak/kuiz/sessions', { subject: 'MATH', count: 5 })
    expect(random.status, JSON.stringify(random.body)).toBe(201)
    const wires: { name: string; body: { items: unknown[] }; shape: Shape }[] = [
      { name: 'paper page', body: pageRes.body.data, shape: KUIZ_PAGE },
      { name: 'random quiz', body: random.body.data, shape: KUIZ_SESSION },
    ]
    for (const w of wires) {
      expect(w.body.items.length, w.name).toBeGreaterThan(0)
      expect(leaks(w.body, w.shape, '$'), w.name).toEqual([])
      expect(secretsIn(w.body), `${w.name}: a planted secret reached the wire`).toEqual([])
      plantedLeaksAreReported(w.body, w.shape)
    }
    // the structured question is on the page (its scheme point labels carry the planted secrets) and stays open
    expect((pageRes.body.data as Raw).items.some((i) => String(i.id).startsWith(`${id('SEED-STR-ECF')}:`) && i.kind === 'open')).toBe(true)
  })
})

describe('Simulasi (the exam attempt) follows the same one-unit rule as the Kuiz', () => {
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
    // the whole wire against the recursive allow-map (sections, questions, mcq, parts, answer, groups), no planted secret, and a planted leak is reported
    expect(leaks(res.body.data, SIM_VIEW, '$')).toEqual([])
    expect(secretsIn(res.body.data)).toEqual([])
    plantedLeaksAreReported(res.body.data, SIM_VIEW)
    expect(view.questions.some((q) => Array.isArray(q.parts))).toBe(true) // the structured question is on the paper, so parts[] and answer are covered
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

  // M3 (A4 pre-review): these two tests PIN what Simulasi does today with a legacy / ETL paper that the builder would refuse. It is a known gap, deviation row
  // "Simulasi does not regather legacy non-contiguous or split groups" (KIV R2): `buildServedPaper` (marking.ts) builds one group entry from every member in
  // composition order and takes from/to as the lowest and highest question number. The Kuiz gathers the members instead (tests above). If R2 closes the gap
  // (regathers, or refuses the paper), change these two expectations on purpose.
  it('current behaviour (KIV R2): a non-contiguous legacy group is served as stored: one group entry, the stimulus once, and its from..to range contains the solo question between the members', async () => {
    const paper = await createPaper('Kertas simulasi tidak berturutan', [
      { label: 'Bahagian A', questionIds: [id('SEED-GRP-PASAR-1'), id('SEED-MCQ-MATH-T4'), id('SEED-GRP-PASAR-2'), id('SEED-GRP-PASAR-3')] },
    ])
    const started = await startExam(paper)
    expect(started.status, JSON.stringify(started.body)).toBe(201)
    const view = (await student.get(`/api/bijak/attempts/${started.body.data.attemptId}`)).body.data as {
      questions: { id: string; number: number }[]
      groups: { questionIds: string[]; from: number; to: number }[]
    }
    expect(view.questions.map((q) => [q.id, q.number])).toEqual([[id('SEED-GRP-PASAR-1'), 1], [id('SEED-MCQ-MATH-T4'), 2], [id('SEED-GRP-PASAR-2'), 3], [id('SEED-GRP-PASAR-3'), 4]])
    expect(view.groups).toHaveLength(1)
    expect(view.groups[0]).toMatchObject({ questionIds: [id('SEED-GRP-PASAR-1'), id('SEED-GRP-PASAR-2'), id('SEED-GRP-PASAR-3')], from: 1, to: 4 })
    expect(count(view, PASSAGE)).toBe(2) // once as `stimulus`, once in its one-item `stimuli` list
  })

  it('current behaviour (KIV R2): a group split across Bahagian is served as one group entry spanning both Bahagian (from 1 to 4), the stimulus once for the whole paper', async () => {
    const paper = await createPaper('Kertas simulasi kumpulan terbelah', [
      { label: 'Bahagian A', questionIds: [id('SEED-GRP-PASAR-1'), id('SEED-MCQ-MATH-T4')] },
      { label: 'Bahagian B', questionIds: [id('SEED-GRP-PASAR-2'), id('SEED-GRP-PASAR-3')] },
    ])
    const started = await startExam(paper)
    expect(started.status, JSON.stringify(started.body)).toBe(201)
    const view = (await student.get(`/api/bijak/attempts/${started.body.data.attemptId}`)).body.data as {
      sections: { questionIds: string[] }[]
      groups: { questionIds: string[]; from: number; to: number }[]
    }
    expect(view.sections.map((x) => x.questionIds)).toEqual([[id('SEED-GRP-PASAR-1'), id('SEED-MCQ-MATH-T4')], [id('SEED-GRP-PASAR-2'), id('SEED-GRP-PASAR-3')]])
    expect(view.groups).toHaveLength(1)
    expect(view.groups[0]).toMatchObject({ questionIds: [id('SEED-GRP-PASAR-1'), id('SEED-GRP-PASAR-2'), id('SEED-GRP-PASAR-3')], from: 1, to: 4 })
    expect(count(view, PASSAGE)).toBe(2)
  })

  it('current behaviour (KIV R2): members placed OUT of published order ([member 3, solo, member 1]) are served in placement order; from..to is the lowest and highest number, not the first and last member', async () => {
    const paper = await createPaper('Kertas simulasi susunan terbalik', [
      { label: 'Bahagian A', questionIds: [id('SEED-GRP-PASAR-3'), id('SEED-MCQ-MATH-T4'), id('SEED-GRP-PASAR-1')] },
    ])
    const started = await startExam(paper)
    expect(started.status, JSON.stringify(started.body)).toBe(201)
    const view = (await student.get(`/api/bijak/attempts/${started.body.data.attemptId}`)).body.data as {
      questions: { id: string; number: number }[]
      groups: { questionIds: string[]; from: number; to: number }[]
    }
    expect(view.questions.map((q) => [q.id, q.number])).toEqual([[id('SEED-GRP-PASAR-3'), 1], [id('SEED-MCQ-MATH-T4'), 2], [id('SEED-GRP-PASAR-1'), 3]])
    expect(view.groups).toHaveLength(1)
    // placement order, NOT the published member order (member 1 would come first); the range covers the solo between them
    expect(view.groups[0]).toMatchObject({ questionIds: [id('SEED-GRP-PASAR-3'), id('SEED-GRP-PASAR-1')], from: 1, to: 3 })
  })

  it('a group of two stimuli (table, then passage): the whole Simulasi wire, including the table level, is inside the allow-map; a key planted inside a table is reported', async () => {
    const members = [id('SEED-MCQ-SCI-T4'), id('SEED-MCQ-SCI-T5')]
    await withTwoStimulusGroup(members, async () => {
      const paper = await createPaper('Kertas simulasi dua rangsangan', [{ label: 'Bahagian A', questionIds: members }])
      const started = await startExam(paper)
      expect(started.status, JSON.stringify(started.body)).toBe(201)
      const res = await student.get(`/api/bijak/attempts/${started.body.data.attemptId}`)
      const view = res.body.data as { groups: { stimulus: { kind: string }; stimuli: { kind: string; label: string }[] }[] }
      expect(view.groups).toHaveLength(1)
      expect(view.groups[0]!.stimuli.map((x) => [x.kind, x.label])).toEqual([['table', 'Jadual dua'], ['passage', 'Petikan dua']])
      expect(leaks(res.body.data, SIM_VIEW, '$')).toEqual([])
      expect(secretsIn(res.body.data)).toEqual([])
      plantedTableLeakIsReported(res.body.data, SIM_VIEW)
    })
  })
})
