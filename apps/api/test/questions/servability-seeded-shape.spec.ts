import { ServabilityDatabankRowSchema, ServabilityOverviewSchema, ServabilityPaperRowSchema, type ServabilityDatabankRow } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, loginAs, parseData, parseList, type Client, type QuestionsTestApp } from './helpers'

/**
 * REQ-B-033 / REQ-B-022(b): the shape the default seed leaves behind (PoC questions off): published demo papers whose placements
 * point at question ids the bank does not hold. The hub must not say "25 perlu perhatian" while the lane shows attention 0:
 * the lane names the unservable placements (`question_missing`), the Bijak SPM card counts the lane rows with a reason, and the
 * Databank card counts the Databank lane rows. The seeded run itself (prisma seed, 495 Databank rows, 5 papers) gave
 * cards databank 495/5 and bijak-spm 5/0 while `activities.simulasi_paper` said 6 served of 31, 25 attention: those 25 ids were the
 * missing ones, and the lane listed none of them.
 */
describe('hub cards equal their lanes on seeded-shape data (REQ-B-033)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let admin: Client
  let tag: Tag
  const made: Record<string, string> = {}
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

  async function approve(key: string, text: string): Promise<string> {
    const created = await svc.create(mcqInput(tag, { questionText: text, tag: tagBody(tag, 4) }), await adminActor(t.db))
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [created.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
    made[key] = created.id
    return created.id
  }
  async function paper(title: string, questionIds: string[]): Promise<string> {
    const [p] = await q(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, published_at) values ('pilihan', $1, $2, 2, 90, 'published', now()) returning id::text id`, [title, tag.subjectId])
    const [s] = await q(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', $2, $2) returning id::text id`, [p!.id, questionIds.length])
    for (const [i, id] of questionIds.entries()) await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)`, [s!.id, id, i + 1])
    return p!.id
  }

  beforeAll(async () => {
    process.env.THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE = '1000'
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    admin = await loginAs(t, 'admin')
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    await q(`insert into spm_subject_configs (subject_id, grp, display_order, databank_order) values ($1, 'teras', 1, 3) on conflict do nothing`, [tag.subjectId])
    await approve('a', 'Soalan pertama bentuk benih untuk kad hab.')
    await approve('b', 'Soalan kedua bentuk benih untuk kad hab.')
    // Placeholder ids no row of `questions` holds (the reserved PoC ids), as the demo seed places them.
    const gone = ['990000000001', '990000000002', '990000000003']
    made.okPaper = await paper('Kertas elok bentuk benih', [made.a!, made.b!])
    made.poc1 = await paper('Kertas PoC satu bentuk benih', [made.a!, gone[0]!, gone[1]!])
    made.poc2 = await paper('Kertas PoC dua bentuk benih', [gone[2]!])
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('the lane names the unservable placements instead of showing attention 0', async () => {
    const rows = parseList(await admin.get('/api/admin/servability/lanes/bijak-spm?pageSize=100'), ServabilityPaperRowSchema)
    const row = (id: string) => rows.find((r) => r.paperId === id)!
    expect(row(made.okPaper!)).toMatchObject({ questionCount: 2, attentionCount: 0, attention: [] })
    expect(row(made.poc1!)).toMatchObject({ questionCount: 3, attentionCount: 2 })
    expect(row(made.poc1!).attention).toEqual([
      { code: 'question_missing', message: 'Soalan pada kertas ini tiada dalam bank soalan — kertas tidak boleh dimulakan; gantikan atau buang soalan itu.', count: 2 },
    ])
    expect(row(made.poc2!)).toMatchObject({ questionCount: 1, attentionCount: 1 })
  })

  it('the Bijak SPM card = the lane rows (3 papers, 2 with a reason) and the activity count is explained by the same placements', async () => {
    const overview = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema)
    const card = overview.cards.find((c) => c.lane === 'bijak-spm')!
    const lane = parseList(await admin.get('/api/admin/servability/lanes/bijak-spm?pageSize=100'), ServabilityPaperRowSchema)
    expect(card).toMatchObject({ total: lane.length, attention: lane.filter((r) => r.attention.length > 0).length })
    expect(card).toMatchObject({ total: 3, attention: 2 })
    // The question-level activity (not the hub card) counts every distinct placed id: 2 real + 3 missing = 5, 3 of them unservable;
    // the lane's `question_missing` counts add up to exactly those 3 (each missing id is placed once).
    const paper = overview.activities.find((a) => a.activity === 'simulasi_paper')!
    expect(paper).toMatchObject({ total: 5, attention: 3 })
    expect(lane.flatMap((r) => r.attention).filter((a) => a.code === 'question_missing').reduce((n, a) => n + a.count, 0)).toBe(paper.attention)
  })

  it('the Databank card = the Databank lane rows, counted over the whole lane', async () => {
    const overview = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema)
    const card = overview.cards.find((c) => c.lane === 'databank')!
    const rows: ServabilityDatabankRow[] = []
    for (let page = 1; rows.length < card.total; page++) {
      const part = parseList(await admin.get(`/api/admin/servability/lanes/databank?pageSize=100&page=${String(page)}`), ServabilityDatabankRowSchema)
      if (part.length === 0) break
      rows.push(...part)
    }
    expect(rows.length).toBe(card.total)
    expect(rows.filter((r) => r.attention.length > 0).length).toBe(card.attention)
  })
})
