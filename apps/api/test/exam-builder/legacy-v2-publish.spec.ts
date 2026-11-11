import { BijakBuilderEditorSchema, BijakBuilderPaperCreateResultSchema, BijakBuilderPublishResultSchema, envelopeOf, mutationEnvelopeOf, QuestionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { BijakQuestionSource } from '../../src/modules/bijak/papers'
import { BuilderService, LEGACY_V2_PUBLISH_REASON } from '../../src/modules/exam/builder'
import { serveSeededBlueprints } from '../support/serve-blueprints'
import { ACCOUNTS, bootBuilderApp, loginAs, type BuilderTestApp, type Client } from './helpers'

vi.setConfig({ testTimeout: 120_000 })

const Editor = envelopeOf(BijakBuilderEditorSchema)
const Created = envelopeOf(BijakBuilderPaperCreateResultSchema)
const Publish = envelopeOf(BijakBuilderPublishResultSchema)
const Question = mutationEnvelopeOf(QuestionSchema)

/**
 * KP-14: `BuilderService.publishLegacyV2` (migration only) publishes a paper V2 had published although it places a draft, an archived and an inactive
 * question; none of the questions changes (status, is_active); each is pinned at the version in force. A NEW paper with the same questions is refused by
 * the normal Terbit. Synthetic rows only.
 */
describe('KP-14: publishLegacyV2', () => {
  let t: BuilderTestApp
  let admin: Client
  let svc: BuilderService
  let ids: { a1: string; draft: string; inactive: string; archived: string; c1: string; c2: string }
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  async function mk(over: Record<string, unknown> = {}): Promise<string> {
    const chapter = (await q(`select id::text id from chapters where subject_id = $1::bigint and education_level_id = $2::bigint and is_active and in_tree order by id limit 1`, [subject, level]))[0]?.id
    const res = await admin.post('/api/questions', {
      subjectId: subject,
      educationLevelId: level,
      difficultyLevel: 3,
      cognitiveLevel: 'mengaplikasi',
      ...(chapter === undefined ? {} : { curriculumChapterId: chapter }),
      questionType: 'mcq',
      questionText: 'Berapakah hasil tambah 2 dan 3?',
      options: ['4', '5', '6', '7'],
      correctAnswer: 1,
      tag,
      status: 'approved',
      ...over,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = Question.parse(res.body).data.id
    await q(`update question_versions set paper_code = '1449/2' where question_id = $1`, [id])
    return id
  }
  /** A paper in the shape V2 left it: placements written straight into the table (a new placement through the builder refuses these questions). */
  async function legacyPaper(migrated = true): Promise<string> {
    const res = await admin.post('/api/admin/papers', { title: 'Set V2', subject: 'MAT', kertas: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = Created.parse(res.body).data.id
    if (migrated) await q(`insert into etl_id_map (legacy_source, entity, legacy_id, new_id) values ('cloud', 'exam_papers', $1, $2)`, [`legacy-${id}`, id])
    // the API created it, which wrote Studio audit rows; a migration-loaded paper has none
    await q(`delete from audit_events where target_type = 'bijak_paper' and target_id = $1`, [id])
    const e = Editor.parse((await admin.get(`/api/admin/papers/${id}`)).body).data
    const [sa, sb, sc] = e.paper.sections.map((s) => s.id) as [string, string, string]
    const put = async (section: string, list: string[]) => {
      for (const [i, qid] of list.entries()) await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)`, [section, qid, i + 1])
    }
    await put(sa, [ids.a1, ids.draft, ids.inactive])
    await put(sb, [ids.archived])
    await put(sc, [ids.c1, ids.c2])
    return id
  }
  const snapshot = async () =>
    q(`select q.id::text id, q.is_active, q.live_version_no, v.status, v.version_no from questions q join question_versions v on v.question_id = q.id where q.id = any($1::bigint[]) order by q.id, v.version_no`, [Object.values(ids)])

  beforeAll(async () => {
    const known: BijakQuestionSource = {
      takenDownPins: () => Promise.resolve(new Set<string>()),
      getMany: async (list) => new Map(list.map((id) => [id, { id, marks: 1, groupId: null, versionNo: 1 }])),
      pool: async () => ({ entries: [], groups: new Map() }),
    }
    t = await bootBuilderApp({ realBank: true, pool: 'bank', papersSource: known })
    await serveSeededBlueprints(t.db)
    admin = await loginAs(t, ACCOUNTS.admin)
    svc = t.app.get(BuilderService)
    const one = async (sql: string) => String((await q(sql))[0]!.id)
    subject = await one(`select id::text id from subjects where code = 'MATH'`)
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }
    ids = { a1: await mk(), draft: await mk({ status: 'draft' }), inactive: await mk(), archived: await mk(), c1: await mk({ pointsValue: 2 }), c2: await mk({ pointsValue: 2 }) }
    await q(`update questions set is_active = false where id = $1`, [ids.inactive])
    await q(`update question_versions set status = 'archived' where question_id = $1`, [ids.archived])
    await q(`update questions set live_version_no = null where id = $1`, [ids.archived])
    await q(`insert into question_tags (question_id, kind, code) values ($1, 'pool', 'MAT2-B')`, [ids.archived])
  })
  afterAll(async () => {
    await t.close()
  })

  it('a NEW paper with the same questions is refused by the normal Terbit (and stays draft)', async () => {
    const id = await legacyPaper()
    const out = Publish.parse((await admin.post(`/api/admin/papers/${id}/publish`)).body).data
    expect(out.ok).toBe(false)
    expect(out.errors.length).toBeGreaterThan(0)
    expect((await q('select status from papers where id = $1', [id]))[0]?.status).toBe('draft')
  })

  it('publishLegacyV2 publishes it: every question keeps its status and is_active; each is pinned; the audited override row is written', async () => {
    const id = await legacyPaper()
    const before = await snapshot()
    const out = await svc.publishLegacyV2({ userId: admin.userId, role: 'admin', requestId: null, ip: null, isTest: false }, id)
    expect(out, JSON.stringify(out)).toMatchObject({ ok: true, errors: [] })
    expect((await q('select status from papers where id = $1', [id]))[0]?.status).toBe('published')
    expect(await snapshot()).toEqual(before)
    const pins = await q(`select pl.question_id::text qid, pl.pinned_version_no v, pl.marks_override m from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`, [id])
    expect(pins).toHaveLength(6)
    expect(pins.every((p) => Number(p.v) >= 1 && p.m !== null)).toBe(true)
    const audit = await q(`select detail from audit_events where action = 'bijak.paper.published_override' and target_id = $1`, [id])
    expect(audit).toHaveLength(1)
    expect(JSON.stringify(audit[0]!.detail)).toContain(LEGACY_V2_PUBLISH_REASON)
    // P-7: the row names exactly what was lifted
    expect(audit[0]!.detail).toMatchObject({ legacyV2: true, liftedByCode: expect.objectContaining({ NOT_PUBLISHED: expect.any(Number) }) })
    // a second call is a no-op
    expect(await svc.publishLegacyV2({ userId: admin.userId, role: 'admin', requestId: null, ip: null, isTest: false }, id)).toMatchObject({ ok: true })
  })

  it('P-6: a paper the migration did not create (no etl_id_map exam_papers entry) is refused', async () => {
    const id = await legacyPaper(false)
    await expect(svc.publishLegacyV2({ userId: admin.userId, role: 'admin', requestId: null, ip: null, isTest: false }, id)).rejects.toThrow()
    expect((await q('select status from papers where id = $1', [id]))[0]?.status).toBe('draft')
  })

  it('every other blocker still refuses: a duplicated question is not lifted', async () => {
    const id = await legacyPaper()
    const sec = (await q(`select id::text id from paper_sections where paper_id = $1 order by position offset 1 limit 1`, [id]))[0]!.id
    await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, 9)`, [sec, ids.a1])
    const out = await svc.publishLegacyV2({ userId: admin.userId, role: 'admin', requestId: null, ip: null, isTest: false }, id)
    expect(out.ok).toBe(false)
    expect((await q('select status from papers where id = $1', [id]))[0]?.status).toBe('draft')
  })

  describe('a NEW paper (normal Terbit): V2 parity on status and is_active', () => {
    /** A complete paper: A has 3 questions, B 1 (pool MAT2-B), C the two 2-mark ones; `a` fills Bahagian A. */
    async function fullPaper(a: string[]): Promise<string> {
      const res = await admin.post('/api/admin/papers', { title: 'Set baru', subject: 'MAT', kertas: 2 })
      const id = Created.parse(res.body).data.id
      const e = Editor.parse((await admin.get(`/api/admin/papers/${id}`)).body).data
      const [sa, sb, sc] = e.paper.sections.map((x) => x.id) as [string, string, string]
      const b = await mk()
      await q(`insert into question_tags (question_id, kind, code) values ($1, 'pool', 'MAT2-B')`, [b])
      const put = async (section: string, list: string[]) => {
        for (const [i, qid] of list.entries()) await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)`, [section, qid, i + 1])
      }
      await put(sa, a)
      await put(sb, [b])
      await put(sc, [ids.c1, ids.c2])
      return id
    }
    const publish = async (id: string) => Publish.parse((await admin.post(`/api/admin/papers/${id}/publish`)).body).data

    it('an approved but inactive question does NOT stop Terbit', async () => {
      const inactive = await mk()
      await q(`update questions set is_active = false where id = $1`, [inactive])
      const id = await fullPaper([await mk(), await mk(), inactive])
      const out = await publish(id)
      expect(out, JSON.stringify(out)).toMatchObject({ ok: true })
      expect((await q('select is_active from questions where id = $1', [inactive]))[0]?.is_active).toBe(false)
    })

    it('a draft question is still refused', async () => {
      const id = await fullPaper([await mk(), await mk(), ids.draft])
      expect((await publish(id)).ok).toBe(false)
    })

    it('a held picture is refused, whether the question is active or inactive', async () => {
      for (const active of [true, false]) {
        const held = await mk()
        await q(`update question_versions v set import_issues = '[{"code": "legacy_image_unresolved"}]'::jsonb from questions qq where qq.id = v.question_id and qq.live_version_no = v.version_no and qq.id = $1`, [held])
        if (!active) await q(`update questions set is_active = false where id = $1`, [held])
        const out = await publish(await fullPaper([await mk(), await mk(), held]))
        expect(out.ok, `active=${String(active)}`).toBe(false)
        expect(out.errors.some((line) => line.includes(held))).toBe(true)
      }
    })
  })
})
