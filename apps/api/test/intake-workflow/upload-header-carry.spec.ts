import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { levelId, createBatch, uploadOk } from '../intake-files/helpers'
import { textPdf } from '../intake-files/pdf-fixtures'
import { makePng } from '../files/fixtures'
import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, patch, post, uniqueStem, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * S1-T03 (upload header and carry, golden): the Kertas, year, paper code, Set, exam board, exam type and Tingkatan declared on the batch
 * reach every accepted Draf; the figure of a group is stored once; the exam board reaches the source paper without overwriting another.
 */
let t: WorkflowTestApp
let admin: LoggedIn
let t5: string
const T5_SP = 'ZZ5.2.1'

beforeAll(async () => {
  t = await bootWorkflowApp()
  admin = await loginAs(t, 'admin@demo.test')
  t5 = await levelId('T5')
  // A fictitious T5 Matematik unit (same code as the T4 unit of the fixtures) and SP, so that a T5 item resolves (as sp-gate.spec.ts does).
  const ids = await t.db.query<{ subject: string; edition: string }>(
    `select s.id::text subject, (select edition from curriculum_nodes n where n.subject_id = s.id and n.kind = 'unit' limit 1) edition from subjects s where s.code = 'MATH'`,
  )
  const { subject, edition } = ids[0]!
  await t.db.query(`insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, edition) values ($1, $2, 'unit', $3, 'Unit T5 ujian', $4) on conflict do nothing`, [subject, t5, t.codes.unit, edition])
  await t.db.query(`insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, edition) values ($1, $2, 'sp', $3, 'SP T5 ujian', $4) on conflict do nothing`, [subject, t5, T5_SP, edition])
}, 120_000)
afterAll(async () => {
  await t.close()
})

const one = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> => (await t.db.query<T>(sql, params))[0] as T
let counter = 0

async function upload(batchId: string): Promise<void> {
  counter += 1
  await uploadOk(admin, batchId, [{ bytes: Buffer.concat([textPdf(1), Buffer.from(`\n% unik header ${counter} ${Date.now()}\n`)]), filename: `kertas-h${counter}.pdf` }])
  await t.drain()
}

/** A figure with a stored crop for a stimulus of the batch (the extractor's crop step needs a real page image). */
async function giveFigure(batchId: string, stimulusRef: string): Promise<void> {
  const up = await admin.agent.post('/api/files?purpose=question_image').set('X-CSRF-Token', admin.csrf).attach('file', makePng(), { filename: 'rajah.png', contentType: 'image/png' })
  expect(up.status, JSON.stringify(up.body)).toBe(201)
  const crop = (await one<{ id: string }>(`select id::text id from files order by id desc limit 1`)).id
  await t.db.query(`update files set purpose = 'intake_figure' where id = $1`, [crop])
  const page = await one<{ id: string }>(`select p.id::text id from intake_pages p join intake_files f on f.id = p.intake_file_id where f.batch_id = $1 order by p.id limit 1`, [batchId])
  const figure = await one<{ id: string }>(`insert into intake_figures (intake_page_id, bbox, crop_file_id) values ($1, '{"x":0,"y":0,"w":0.5,"h":0.5}', $2) returning id::text id`, [page.id, crop])
  await t.db.query(`update intake_stimuli set figure_id = $1 where batch_id = $2 and ref = $3`, [figure.id, batchId, stimulusRef])
}

const tagT4 = { subject: 'MATH', level: 'T4', unit: undefined as string | undefined, unitLabel: 'Unit ujian', sp: [] as string[], tp: 3, formOrigin: 'T4' }

describe('golden: a Kertas 2 2024 batch carries its header to nine questions in two groups', () => {
  it('extraction takes the batch level, accept writes kertas, year, paper code, Set, board, type and Bahagian; Rajah 3 and Rajah 4 are stored once', async () => {
    t.ai.paper = () =>
      paper(
        Array.from({ length: 9 }, (_v, i) => {
          const n = i + 1
          const stimulusId = n >= 5 && n <= 8 ? 'stim-3' : n === 9 ? 'stim-4' : undefined
          return draft(t.codes, String(n), {
            stem: uniqueStem(),
            tag: { level: 'T4', formOrigin: 'T4', unit: t.codes.unit, sp: [T5_SP] },
            ...(stimulusId ? { stimulusId } : {}),
          })
        }),
        {
          stimuli: [
            { id: 'stim-3', kind: 'diagram', label: 'Rajah 3', alt: 'Graf garis lurus' },
            { id: 'stim-4', kind: 'diagram', label: 'Rajah 4', alt: 'Segi empat sama' },
          ],
        },
      )
    const batch = await createBatch(admin, { subject: 'MATH', paperType: 'exam', kertas: 2, year: 2024, paperCode: '1449/2', educationLevelId: t5, examBoard: 'SPM (LP)', setLabel: 'Set 1' })
    await upload(batch.id)
    await extractAndRun(t, admin, batch.id)

    // Extraction: the batch level replaces the extractor's, and every item gets the default Bahagian.
    const items = await itemsOf(admin, batch.id)
    expect(items).toHaveLength(9)
    const stored = await t.db.query<{ level: string; form: string; sec: string }>(`select payload->'tag'->>'level' level, payload->'tag'->>'formOrigin' form, section_label sec from intake_items where batch_id = $1`, [batch.id])
    expect(stored.every((r) => r.level === 'T5' && r.form === 'T5' && r.sec === 'Bahagian A')).toBe(true)
    const sp = await one<{ id: string | null; board: string | null }>(`select b.source_paper_id::text id, p.exam_board board from intake_batches b left join source_papers p on p.id = b.source_paper_id where b.id = $1`, [batch.id])
    expect(sp.id).not.toBeNull()
    expect(sp.board).toBe('SPM (LP)')

    await giveFigure(batch.id, 'stim-3')
    await giveFigure(batch.id, 'stim-4')
    const stimuliBefore = Number((await one<{ n: string }>('select count(*)::text n from stimuli')).n)
    const groupsBefore = Number((await one<{ n: string }>('select count(*)::text n from stimulus_groups')).n)
    const imagesBefore = Number((await one<{ n: string }>(`select count(*)::text n from files where purpose = 'question_image'`)).n)

    const res = await post(admin, '/intake/items/bulk', { action: 'accept', ids: items.map((i) => i.id) })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.done).toBe(9)

    // Every Draf carries the header.
    const versions = await t.db.query<Record<string, string | number | null>>(
      `select v.status, v.paper_code, v.year, v.set_label, v.exam_board, v.exam_type, v.section_label, v.education_level_id::text level_id, substring(v.paper_code from '/([1-4])[[:space:]]*$') kertas, v.source_paper_id::text sp
         from intake_items i join question_versions v on v.question_id = i.question_id and v.version_no = i.question_version_no where i.batch_id = $1 order by i.position`,
      [batch.id],
    )
    expect(versions).toHaveLength(9)
    for (const v of versions) {
      expect(v).toMatchObject({ status: 'draft', paper_code: '1449/2', year: 2024, set_label: 'Set 1', exam_board: 'SPM (LP)', exam_type: 'sebenar', section_label: 'Bahagian A', level_id: t5, kertas: '2', sp: sp.id })
    }
    // The question detail reads the kertas as '2'.
    const q1 = await one<{ q: string }>(`select question_id::text q from intake_items where batch_id = $1 order by position limit 1`, [batch.id])
    const detail = await admin.agent.get(`/api/questions/${q1.q}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.kertas).toBe('2')

    // Rajah 3 -> Q5-8 and Rajah 4 -> Q9: two groups, five members, each figure stored once.
    const members = await t.db.query<{ label: string; g: string | null }>(
      `select i.number_label label, q.group_id::text g from intake_items i join questions q on q.id = i.question_id where i.batch_id = $1 order by i.position`,
      [batch.id],
    )
    const grouped = members.filter((m) => m.g !== null)
    expect(grouped.map((m) => m.label)).toEqual(['5', '6', '7', '8', '9'])
    expect(new Set(grouped.map((m) => m.g)).size).toBe(2)
    expect(new Set(grouped.slice(0, 4).map((m) => m.g)).size).toBe(1)
    expect(members.filter((m) => m.g === null)).toHaveLength(4)
    expect(Number((await one<{ n: string }>('select count(*)::text n from stimuli')).n)).toBe(stimuliBefore + 2)
    expect(Number((await one<{ n: string }>('select count(*)::text n from stimulus_groups')).n)).toBe(groupsBefore + 2)
    expect(Number((await one<{ n: string }>(`select count(*)::text n from files where purpose = 'question_image'`)).n)).toBe(imagesBefore + 2)
  })
})

describe('the exam board reaches the source paper (DM-85)', () => {
  it('fills a known paper that has no board and never overwrites a different one', async () => {
    const first = await createBatch(admin, { subject: 'MATH', paperType: 'exam', kertas: 1, year: 2023, educationLevelId: await levelId('T4') })
    t.ai.paper = () => paper([draft(t.codes, '1')])
    await upload(first.id)
    await extractAndRun(t, admin, first.id)
    const paperId = (await one<{ id: string }>(`select source_paper_id::text id from intake_batches where id = $1`, [first.id])).id
    expect((await one<{ b: string | null }>(`select exam_board b from source_papers where id = $1`, [paperId])).b).toBeNull() // the batch declared none

    const second = await createBatch(admin, { subject: 'MATH', paperType: 'exam', kertas: 1, year: 2023, educationLevelId: await levelId('T4'), examBoard: 'Johor' })
    await upload(second.id)
    await extractAndRun(t, admin, second.id)
    expect((await one<{ id: string }>(`select source_paper_id::text id from intake_batches where id = $1`, [second.id])).id).toBe(paperId) // the known paper
    expect((await one<{ b: string | null }>(`select exam_board b from source_papers where id = $1`, [paperId])).b).toBe('Johor')

    const third = await createBatch(admin, { subject: 'MATH', paperType: 'exam', kertas: 1, year: 2023, educationLevelId: await levelId('T4'), examBoard: 'Kedah' })
    await upload(third.id)
    await extractAndRun(t, admin, third.id)
    expect((await one<{ b: string | null }>(`select exam_board b from source_papers where id = $1`, [paperId])).b).toBe('Johor')
  })
})

describe('a batch without a declared level keeps the extractor level; a hand-added item takes the batch level', () => {
  it('guru style batch (no level): T4 stays; the admin batch level T4 is the level of an added item', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1', { tag: { level: 'T4+T5' } })])
    const noLevel = await createBatch(admin, { subject: 'MATH', educationLevelId: undefined as unknown as string })
    // The admin must name a level, so this batch is created for the level lookup only and then cleared.
    await t.db.query(`update intake_batches set education_level_id = null where id = $1`, [noLevel.id])
    await upload(noLevel.id)
    await extractAndRun(t, admin, noLevel.id)
    expect((await one<{ level: string }>(`select payload->'tag'->>'level' level from intake_items where batch_id = $1`, [noLevel.id])).level).toBe('T4+T5')

    const withLevel = await createBatch(admin, { subject: 'MATH', educationLevelId: t5 })
    const added = await post(admin, `/intake/batches/${withLevel.id}/items`, {})
    expect(added.status, JSON.stringify(added.body)).toBe(201)
    const tag = await one<{ level: string; form: string }>(`select payload->'tag'->>'level' level, payload->'tag'->>'formOrigin' form from intake_items where batch_id = $1`, [withLevel.id])
    expect(tag).toEqual({ level: 'T5', form: 'T5' })
  })
})

describe('the tag fields bab, topik, kbat and difficulty reach the Draf (PO item 10)', () => {
  it('carries a Bab of the item Subjek and Tingkatan, KBAT and the typed difficulty; refuses a Bab of another level', async () => {
    const subjectId = (await one<{ id: string }>(`select id::text id from subjects where code = 'MATH'`)).id
    const t4 = await levelId('T4')
    const mk = async (level: string, no: number) =>
      (await one<{ id: string }>(`insert into chapters (subject_id, education_level_id, name, chapter_number, is_active) values ($1::bigint, $2::bigint, 'Bab S1-T03', $3, true) returning id::text id`, [subjectId, level, no])).id
    const babT4 = await mk(t4, 931)
    const babT5 = await mk(t5, 932)

    t.ai.paper = () => paper([draft(t.codes, '1', { stem: uniqueStem() }), draft(t.codes, '2', { stem: uniqueStem() })])
    const batch = await createBatch(admin, { subject: 'MATH', educationLevelId: t4 })
    await upload(batch.id)
    await extractAndRun(t, admin, batch.id)
    const [a, b] = (await itemsOf(admin, batch.id)).map((i) => i.id) as [string, string]
    const tag = { ...tagT4, unit: t.codes.unit, sp: [t.codes.sp] }

    expect((await patch(admin, `/intake/items/${a}`, { tag: { ...tag, bab: babT4, kbat: 'menilai', difficulty: 4 } })).status).toBe(200)
    expect((await post(admin, `/intake/items/${a}/accept`)).status).toBe(200)
    const v = await one<{ chapter_id: string; difficulty_level: number; kbat: string | null }>(
      `select v.chapter_id::text chapter_id, v.difficulty_level, (select p.kbat from question_parts p where p.question_version_id = v.id and p.mode is not null limit 1) kbat from intake_items i join question_versions v on v.question_id = i.question_id and v.version_no = i.question_version_no where i.id = $1`,
      [a],
    )
    expect(v).toMatchObject({ chapter_id: babT4, difficulty_level: 4 })
    expect(v.kbat).toBe('menilai') // the KBAT override sits on the leaf, where the bank reads it

    expect((await patch(admin, `/intake/items/${b}`, { tag: { ...tag, bab: babT5 } })).status).toBe(200)
    const refused = await post(admin, `/intake/items/${b}/accept`)
    expect(refused.status, JSON.stringify(refused.body)).toBe(422)
    expect(refused.body.error.details.issues.map((i: { message: string }) => i.message)).toContain('Soalan 2: Bab tidak sepadan dengan subjek dan tahap.')
  })
})
