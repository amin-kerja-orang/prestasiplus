import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mapBe09Question, type CurriculumLabels } from '../../src/modules/bijak/question-bridge/be09-mapping'
import { stimulusOf } from '../../src/modules/exam/builder/question-bank.mapping'
import { QuestionsRepository } from '../../src/modules/questions'
import { makePng } from '../files/fixtures'
import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, type Refs } from './http-helpers'

/**
 * R1-H-A16: ONE table reader (`questions/stimulus-table.ts`). The same stored table stimulus (ten stored shapes, the ones R1-T31 compares
 * for the builder and the bridge) is read through every path and must agree with an explicit expectation:
 * the stimulus API, the stimulus group read, the question detail, the paper builder (`stimulusOf`) and the Bijak bridge (`mapBe09Question`).
 * A table read from the body replaces the body text on the Studio paths (`body: null`), so the grid is not shown twice.
 *
 * Pending (marked `it.todo`, nothing faked): the builder's `stimulusOf` and the bridge keep two older rules in files that belong to
 * other lanes; see PENDING_* below and the report for the exact one-line changes.
 */
const GRID = { head: ['Tahun', 'Peristiwa'], rows: [['1957', 'Merdeka']] }
interface Case {
  name: string
  body: string | null
  data: unknown
  image?: true
  /** the table every reader must show (undefined = not a table) */
  table: { head: string[]; rows: string[][] } | undefined
  /** the body text the Studio shows (null = none) */
  studioBody: string | null
}
const CASES: Case[] = [
  { name: '{ head, rows }', body: null, data: GRID, table: GRID, studioBody: null },
  { name: '{ headers, rows }', body: null, data: { headers: GRID.head, rows: GRID.rows }, table: GRID, studioBody: null },
  { name: '{ columns, rows }', body: null, data: { columns: GRID.head, rows: GRID.rows }, table: GRID, studioBody: null },
  { name: 'rows of rows (first row is the head)', body: null, data: [GRID.head, ...GRID.rows], table: GRID, studioBody: null },
  { name: 'numbers in cells', body: null, data: { head: ['N'], rows: [[1], [2.5]] }, table: { head: ['N'], rows: [['1'], ['2.5']] }, studioBody: null },
  { name: 'a pipe table in the body', body: 'Tahun | Peristiwa\n--- | ---\n1957 | Merdeka', data: null, table: GRID, studioBody: null },
  { name: 'a malformed grid beside a pipe body (the body wins)', body: 'Tahun | Peristiwa\n1957 | Merdeka', data: { head: 'x', rows: [] }, table: GRID, studioBody: null },
  { name: 'a malformed grid and a plain body (text, no table)', body: 'Jadual berikut', data: { head: 'x', rows: [] }, table: undefined, studioBody: 'Jadual berikut' },
  { name: 'a plain body and no grid (text, no table)', body: 'Jadual berikut', data: null, table: undefined, studioBody: 'Jadual berikut' },
  { name: 'an image-only table (picture, no table)', body: null, data: null, image: true, table: undefined, studioBody: null },
]

/** The builder's `stimulusOf` (T07 file) reads `tableData` only, not the pipe table in the body: the cases whose table comes from the body wait for `stimulusTableOf(s.tableData, s.bodyMs)`. */
const PENDING_BUILDER_TABLE = new Set([CASES[5]!.name, CASES[6]!.name])
/** The bridge keeps the body text when a malformed `tableData` sits beside a pipe body (`text = table && !s.tableData ? ...`), so the grid is shown twice; it needs `!stimulusTableParts(...)`-style logic. */
const PENDING_BRIDGE_TEXT = new Set([CASES[6]!.name])

describe('one table reader: stimulus API = group read = question detail = builder = bridge (R1-H-A16)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let repo: QuestionsRepository
  let fileId: string
  let token: string
  const LABELS: CurriculumLabels = { subjectCode: 'MAT', unitLabel: 'Bab 1', unitCode: '1' }

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-table-parity-'))
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    repo = t.app.get(QuestionsRepository)
    const up = await admin.post('/api/files?purpose=question_image').attach('file', makePng(), { filename: 'jadual.png', contentType: 'image/png' })
    expect(up.status, JSON.stringify(up.body)).toBe(201)
    token = (up.body.data as { id: string }).id
    fileId = (await t.db.query<{ id: string }>(`select id::text id from files where public_id = $1`, [token]))[0]!.id
  })
  afterAll(async () => {
    await t.close()
  })

  /** A stored table stimulus (SQL: the stored shapes are exactly what the API refuses to create) in a group of two draft questions. */
  async function stored(c: Case) {
    const sid = (
      await t.db.query<{ id: string }>(
        `insert into stimuli (kind, label, caption, source_citation, body_ms, table_data, asset_file_id) values ('table', 'Jadual 1', 'Jualan', 'Sumber: JPN', $1, $2::jsonb, $3) returning id::text id`,
        [c.body, c.data === null ? null : JSON.stringify(c.data), c.image ? fileId : null],
      )
    )[0]!.id
    const members: string[] = []
    for (let i = 0; i < 2; i++) {
      const res = await admin.post('/api/questions', mcqBody(refs, { questionText: `Soalan jadual ${String(i)}?` }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      members.push(res.body.data.id as string)
    }
    const g = await admin.post('/api/stimulus-groups', { stimulusIds: [sid], questionIds: members })
    expect(g.status, JSON.stringify(g.body)).toBe(201)
    return { sid, groupId: g.body.data.id as string, member: members[0]! }
  }
  const studioView = (s: { tableData?: unknown; body?: { ms: string } | null }) => ({ table: s.tableData ?? undefined, body: s.body?.ms ?? null })

  for (const c of CASES) {
    describe(c.name, () => {
      let ids: Awaited<ReturnType<typeof stored>>
      beforeAll(async () => {
        ids = await stored(c)
      })
      const expected = { table: c.table, body: c.studioBody }

      it('stimulus API, group read and question detail agree', async () => {
        const api = studioView((await admin.get(`/api/stimuli/${ids.sid}`)).body.data)
        const group = studioView((await admin.get(`/api/stimulus-groups/${ids.groupId}`)).body.data.stimuli[0])
        const detail = studioView((await admin.get(`/api/questions/${ids.member}`)).body.data.stimulusGroup.stimuli[0])
        expect(api).toEqual(expected)
        expect(group).toEqual(expected)
        expect(detail).toEqual(expected)
        if (c.image) expect((await admin.get(`/api/stimuli/${ids.sid}`)).body.data.imageId).toBe(token)
      })

      if (PENDING_BUILDER_TABLE.has(c.name)) {
        it.todo(`builder stimulusOf shows the same table (pending A3: pass s.bodyMs to stimulusTableOf in exam/builder/question-bank.mapping.ts)`)
      } else {
        it('the paper builder shows the same table', () => {
          const builder = stimulusOf({ id: BigInt(ids.sid), kind: 'table', label: 'Jadual 1', bodyMs: c.body, caption: 'Jualan', altText: null, tableData: c.data })
          expect(builder?.table).toEqual(c.table)
        })
      }

      it('the Bijak bridge shows the same table', async () => {
        const record = (await repo.get(ids.member, 'latest'))!
        const group = await repo.groupOf(ids.member)
        const media = { tokens: new Map([[fileId, token]]), outside: new Map() }
        const stim = mapBe09Question(record, group, LABELS, media).group?.stimulus
        expect(stim).toBeDefined()
        expect(stim?.table).toEqual(c.table)
        if (c.image) expect(stim?.image).toEqual({ url: `/api/files/${token}` })
        if (!PENDING_BRIDGE_TEXT.has(c.name)) expect(stim?.text ?? null).toEqual(c.studioBody)
      })
      if (PENDING_BRIDGE_TEXT.has(c.name)) {
        it.todo('bridge text is dropped when the table came from the body (pending A4: be09-mapping.ts `text` must use stimulusTableParts().bodyIsTable)')
      }
    })
  }
})
