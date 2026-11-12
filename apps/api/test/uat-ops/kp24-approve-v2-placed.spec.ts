import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { examSeed } from '../../prisma/seed/exam'
import { apply, AUDIT_ACTION, classify, dryRun, formatReport, summarisePapers, type CandidateRow, type PlacementRow } from '../../scripts/uat-ops/kp24-approve-v2-placed'
import { createTestDatabase, type TestDatabase } from '../support/db'

describe('summarisePapers / classify (pure)', () => {
  const cand = (over: Partial<CandidateRow>): CandidateRow => ({
    question_id: '1', is_active: true, live_version_no: null, live_status: null, pins: [1], paper_ids: ['9'], pinned_status: 'draft', pinned_exists: true, open_flag: false, pinned_archive_reason: null, taken_down: false, other_approved: false, ...over,
  })
  it('classifies inactive, different pins, a missing pinned version and the rest', () => {
    expect(classify(cand({})).outcome).toBe('approve')
    expect(classify(cand({ is_active: false })).outcome).toBe('inactive')
    expect(classify(cand({ pins: [1, 2] })).outcome).toBe('multi_pin')
    expect(classify(cand({ pinned_exists: false })).outcome).toBe('pin_missing')
    for (const r of ['source_takedown', 'withdrawn', 'regrouped']) expect(classify(cand({ pinned_status: 'archived', pinned_archive_reason: r })).outcome).toBe('withdrawn')
    expect(classify(cand({ pinned_status: 'archived', pinned_archive_reason: 'superseded' })).outcome).toBe('approve')
    expect(classify(cand({ taken_down: true })).outcome).toBe('withdrawn')
    expect(classify(cand({ other_approved: true })).outcome).toBe('other_approved')
  })
  it('a paper is listable after only when every placement is active and approved; scope limits grade 11', () => {
    const rows: PlacementRow[] = [
      { paper_id: 'A', level_scope: null, question_id: '1', is_active: true, live_status: null },
      { paper_id: 'A', level_scope: null, question_id: '2', is_active: true, live_status: 'approved' },
      { paper_id: 'B', level_scope: 't4', question_id: '1', is_active: true, live_status: null },
      { paper_id: 'C', level_scope: null, question_id: '3', is_active: false, live_status: 'approved' },
    ]
    const s = summarisePapers(rows, new Set(['1']), new Set())
    expect(s.listableBefore).toBe(0)
    expect(s.listableAfter).toBe(2)
    expect(s.listableAfter11).toBe(1)
    expect(s.newlyListable11).toBe(1)
    expect(s.scopedOut11).toBe(1)
    expect(s.stillHidden).toEqual({ inactivePlacement: 1, skippedQuestion: 0, otherNotApproved: 0 })
  })
})

/** KP-24 against a migrated, seeded database: fixtures by SQL, unique per case; the whole-table snapshot proves nothing else moves. */
describe('kp24-approve-v2-placed (database)', () => {
  let db: TestDatabase
  let client: pg.Client
  let subjectId: string
  let levelId: string
  let n = 0

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, curriculumSeed, examSeed], { prisma: db.prisma })
    client = new pg.Client({ connectionString: db.url })
    await client.connect()
    subjectId = (await db.query<{ id: string }>(`select id::text from subjects where code = 'MATH'`))[0]!.id
    levelId = (await db.query<{ id: string }>(`select id::text from education_levels limit 1`))[0]!.id
  })
  afterAll(async () => {
    await client.end()
    await db.drop()
  })

  interface Q {
    id: string
  }
  /** A question with versions 1..latest; the status of each version is given by `statuses`. */
  async function question(o: { reason?: string | null; sourcePaperId?: string; statuses: string[]; live?: number | null; active?: boolean; v2?: 'legacy' | 'map' | 'none' }): Promise<Q> {
    const latest = o.statuses.length
    const v2 = o.v2 ?? 'legacy'
    const id = (
      await db.query<{ id: string }>(
        `insert into questions (source_type, latest_version_no, live_version_no, is_active, legacy_source, legacy_id)
         values ('manual', $1, $2, $3, $4, $5) returning id::text`,
        [latest, o.live ?? null, o.active ?? true, v2 === 'legacy' ? 'cloud' : null, v2 === 'legacy' ? `kp24-${String(++n)}` : null],
      )
    )[0]!.id
    for (const [i, status] of o.statuses.entries()) {
      await db.query(
        `insert into question_versions (question_id, version_no, status, archive_reason, published_at, type, stem_ms, subject_id, education_level_id, number_label, source_paper_id)
         values ($1::bigint, $2, $3, $4, $5, 'short', 'Soalan KP24', $6::bigint, $7::bigint, $8, $9::bigint)`,
        [id, i + 1, status, status === 'archived' ? (o.reason === undefined ? 'superseded' : o.reason) : null, status === 'archived' ? '2026-01-01T00:00:00Z' : null, subjectId, levelId, `KP24-${String(n)}-${String(i)}`, o.sourcePaperId ?? null],
      )
    }
    if (v2 === 'map') await db.query(`insert into etl_id_map (legacy_source, entity, legacy_id, new_id) values ('cloud', 'exam_questions', $1, $2)`, [`kp24m-${id}`, id])
    return { id }
  }

  /** A paper with one section; `pins` are [question id, pinned version]. `v2` papers get an etl_id_map row. */
  async function paper(o: { status?: string; kind?: string; v2?: boolean; scope?: string | null; pins: [string, number][] }): Promise<string> {
    const id = (
      await db.query<{ id: string }>(
        `insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, level_scope) values ($1, 'KP24', $2::bigint, 1, 60, $3, $4) returning id::text`,
        [o.kind ?? 'pilihan', subjectId, o.status ?? 'published', o.scope ?? null],
      )
    )[0]!.id
    if (o.v2 ?? true) await db.query(`insert into etl_id_map (legacy_source, entity, legacy_id, new_id) values ('cloud', 'exam_papers', $1, $2)`, [`kp24p-${id}`, id])
    const sec = (
      await db.query<{ id: string }>(
        `insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1::bigint, 1, 'A', $2, $2) returning id::text`,
        [id, o.pins.length],
      )
    )[0]!.id
    for (const [i, [qid, vno]] of o.pins.entries()) {
      await db.query(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1::bigint, $2::bigint, $3, $4)`, [sec, qid, vno, i + 1])
    }
    return id
  }

  const snap = async (): Promise<string> =>
    JSON.stringify([
      await db.query(`select to_jsonb(q) j from questions q order by id`),
      await db.query(`select to_jsonb(v) j from question_versions v order by id`),
      await db.query(`select count(*)::int n from audit_events`),
      await db.query(`select count(*)::int n from question_status_events`),
    ])
  const live = async (id: string) =>
    (await db.query<{ live_version_no: number | null; is_active: boolean; vstatus: string | null; published_at: string | null; last_editor: string | null }>(
      `select q.live_version_no, q.is_active, v.status vstatus, v.published_at::text, v.last_editor from questions q left join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.id = $1::bigint`,
      [id],
    ))[0]!

  it('dry run selects the right questions, changes nothing and prints counts only', async () => {
    const draft = await question({ statuses: ['draft'] })
    const archived = await question({ statuses: ['archived'] })
    const okLive = await question({ statuses: ['approved'], live: 1 })
    const p = await paper({ pins: [[draft.id, 1], [archived.id, 1], [okLive.id, 1]] })
    const before = await snap()
    const report = await dryRun(client)
    expect(report.outcomes.approve).toBeGreaterThanOrEqual(2)
    expect(report.papers.newlyListable).toBeGreaterThanOrEqual(1)
    expect(await snap()).toBe(before)
    const text = formatReport(report, 'x').join('\n')
    expect(text).not.toContain('Soalan KP24')
    await db.query(`delete from papers where id = $1::bigint`, [p]) // keep the next case's counts exact
  })

  it('apply approves only the in-scope questions, leaves everything else byte-identical, and a second apply writes nothing', async () => {
    // in scope
    const draft = await question({ statuses: ['draft'] })
    const archived = await question({ statuses: ['archived'] })
    const mapped = await question({ statuses: ['draft'], v2: 'map' })
    const staleLive = await question({ statuses: ['archived', 'draft'], live: 1 })
    // out of scope
    const inactive = await question({ statuses: ['draft'], active: false })
    const alreadyOk = await question({ statuses: ['approved'], live: 1 })
    const notV2 = await question({ statuses: ['draft'], v2: 'none' })
    const notPlaced = await question({ statuses: ['draft'] })
    const onDraftPaper = await question({ statuses: ['draft'] })
    const onV3Paper = await question({ statuses: ['draft'] })
    const split = await question({ statuses: ['draft', 'draft'] })
    const withdrawn = await question({ statuses: ['archived'], reason: 'withdrawn' })
    const takenReason = await question({ statuses: ['archived'], reason: 'source_takedown' })
    const tdSource = (await db.query<{ id: string }>(`insert into source_papers (takedown_at) values (now()) returning id::text`))[0]!.id
    const takenSource = await question({ statuses: ['draft'], sourcePaperId: tdSource })
    const twoApproved = await question({ statuses: ['approved', 'archived'], live: null }) // v1 approved but not live, pinned v2
    const pA = await paper({ pins: [[draft.id, 1], [archived.id, 1], [mapped.id, 1], [staleLive.id, 1], [alreadyOk.id, 1], [notV2.id, 1]] })
    const pB = await paper({ pins: [[draft.id, 1], [inactive.id, 1]] }) // stays hidden: inactive placement
    await paper({ status: 'draft', pins: [[onDraftPaper.id, 1]] })
    await paper({ v2: false, pins: [[onV3Paper.id, 1]] })
    await paper({ pins: [[withdrawn.id, 1], [takenReason.id, 1], [takenSource.id, 1], [twoApproved.id, 2]] })
    await paper({ pins: [[split.id, 1]] })
    await paper({ pins: [[split.id, 2]] })

    // everything but the in-scope questions must stay as it is
    const keep = [inactive, alreadyOk, notV2, notPlaced, onDraftPaper, onV3Paper, split, withdrawn, takenReason, takenSource, twoApproved]
    const keepSnap = async () => JSON.stringify(await Promise.all(keep.map((k) => db.query(`select to_jsonb(q) j from questions q where id = $1::bigint`, [k.id]))))
    const keepVersions = async () => JSON.stringify(await Promise.all(keep.map((k) => db.query(`select to_jsonb(v) j from question_versions v where question_id = $1::bigint order by version_no`, [k.id]))))
    const [k1, k2] = [await keepSnap(), await keepVersions()]
    const contentBefore = JSON.stringify(await db.query(`select id, stem_ms, type, subject_id, number_label from question_versions order by id`))
    const auditBefore = (await db.query<{ n: number }>(`select count(*)::int n from audit_events where action = $1`, [AUDIT_ACTION]))[0]!.n

    const report = await apply(client)
    expect(report.mode).toBe('apply')
    expect(report.written).toEqual({ versions: 4, questions: 4, statusEvents: 4, auditEvents: 4 })
    expect(report.outcomes.multi_pin).toBe(1)
    expect(report.outcomes.inactive).toBe(1)
    expect(report.outcomes.withdrawn).toBe(3)
    expect(report.outcomes.other_approved).toBe(1)
    expect(report.byArchiveReason['archived/superseded']).toBe(3)
    expect(report.verified?.listableAfter).toBe(report.papers.listableAfter)

    for (const q of [draft, archived, mapped]) {
      const s = await live(q.id)
      expect(s).toMatchObject({ live_version_no: 1, is_active: true, vstatus: 'approved', last_editor: 'person' })
      expect(s.published_at).not.toBeNull()
    }
    // the pinned version (1, archived) is the live one now; the newer draft (2) is untouched
    expect(await live(staleLive.id)).toMatchObject({ live_version_no: 1, vstatus: 'approved' })
    expect((await db.query<{ status: string }>(`select status from question_versions where question_id = $1::bigint and version_no = 2`, [staleLive.id]))[0]!.status).toBe('draft')
    // the archived version keeps its original published_at
    expect((await live(archived.id)).published_at).toContain('2026-01-01')
    expect((await db.query<{ archive_reason: string | null }>(`select archive_reason from question_versions where question_id = $1::bigint`, [archived.id]))[0]!.archive_reason).toBeNull()

    expect([await keepSnap(), await keepVersions()]).toEqual([k1, k2])
    expect(JSON.stringify(await db.query(`select id, stem_ms, type, subject_id, number_label from question_versions order by id`))).toBe(contentBefore)
    expect((await live(inactive.id)).is_active).toBe(false)

    const events = await db.query<{ question_id: string; version_no: number; from_status: string; to_status: string; actor_user_id: string | null; reason: string }>(
      `select question_id::text, version_no, from_status, to_status, actor_user_id::text, reason from question_status_events where reason = 'KP-24' and question_id = any($1::bigint[]) order by question_id`,
      [[draft.id, archived.id, mapped.id, staleLive.id]],
    )
    expect(events).toHaveLength(4)
    expect(events.every((e) => e.to_status === 'approved' && e.actor_user_id === null)).toBe(true)
    expect(events.find((e) => e.question_id === archived.id)!.from_status).toBe('archived')
    const audit = await db.query<{ target_id: string; actor_user_id: string | null; detail: { kp: string; paperIds: string[]; versionNo: number; previousStatus: string } }>(
      `select target_id, actor_user_id::text, detail from audit_events where action = $1 and target_id = $2`,
      [AUDIT_ACTION, draft.id],
    )
    expect(audit).toHaveLength(1)
    expect(audit[0]!.detail).toEqual({ kp: 'KP-24', paperIds: [pA, pB], versionNo: 1, previousStatus: 'draft', previousArchiveReason: null })
    expect((await db.query<{ n: number }>(`select count(*)::int n from audit_events where action = $1`, [AUDIT_ACTION]))[0]!.n).toBe(auditBefore + 4)

    // idempotent
    const after = await snap()
    const again = await apply(client)
    expect(again.written).toEqual({ versions: 0, questions: 0, statusEvents: 0, auditEvents: 0 })
    expect(again.versionsToApprove).toBe(0)
    expect(await snap()).toBe(after)
  })

  it('a failure part-way rolls the whole transaction back', async () => {
    const q = await question({ statuses: ['draft'] })
    await paper({ pins: [[q.id, 1]] })
    const before = await snap()
    const failing = {
      query: (sql: string, params?: unknown[]) => {
        if (sql.includes('INSERT INTO audit_events')) return Promise.reject(new Error('boom'))
        return client.query(sql, params as never)
      },
    } as unknown as pg.Client
    await expect(apply(failing)).rejects.toThrow('boom')
    expect(await snap()).toBe(before)
  })
})
