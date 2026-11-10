import { BIJAK_BUILDER_PLACEMENT_LINES as PLACE, BijakBuilderEditorSchema, BijakBuilderPaperCreateResultSchema, BijakBuilderPublishResultSchema, envelopeOf, mutationEnvelopeOf, QuestionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { BijakQuestionSource } from '../../src/modules/bijak/papers'
import { BuilderService, PaperImportBlockedError } from '../../src/modules/exam/builder'
import { PLACEMENT_BLOCK_TEXT, placementBlockers } from '../../src/modules/exam/builder/placement-blockers'
import { PrismaService } from '../../src/db/prisma.service'
import { serveSeededBlueprints } from '../support/serve-blueprints'
import { ACCOUNTS, bootBuilderApp, expectError, loginAs, type BuilderTestApp, type Client } from './helpers'

vi.setConfig({ testTimeout: 120_000 })

const Editor = envelopeOf(BijakBuilderEditorSchema)
const Created = envelopeOf(BijakBuilderPaperCreateResultSchema)
const Publish = envelopeOf(BijakBuilderPublishResultSchema)
const Question = mutationEnvelopeOf(QuestionSchema)

const HELD = `'[{"code": "legacy_image_unresolved"}]'::jsonb`

/**
 * M2 (KP-14 / KP-15): a NEW placement refuses a question whose picture is held (`legacy_image_unresolved`) or unresolved, and a withdrawn question no
 * published paper pins; a question already on the paper is never re-judged. One rule (`placementBlockers`, built on `unservableReasonsOf`) for
 * addPlacement by id, replace-placements (PUT), paper import and the Terbit gate (`attemptBlockers`). Synthetic rows only.
 */
describe('M2: placement blockers', () => {
  let t: BuilderTestApp
  let admin: Client
  let svc: BuilderService
  let subjects: { mat: string }
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }
  let ids: { ok: string; held: string; inactive: string; inactivePinned: string; heldPinned: string; heldKept: string }

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)

  async function mk(): Promise<string> {
    const chapter = (await q(`select id::text id from chapters where subject_id = $1::bigint and education_level_id = $2::bigint and is_active and in_tree order by id limit 1`, [subjects.mat, level]))[0]?.id
    const res = await admin.post('/api/questions', {
      subjectId: subjects.mat,
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
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = Question.parse(res.body).data.id
    await q(`update question_versions set paper_code = '1449/2' where question_id = $1`, [id])
    return id
  }
  const hold = (id: string) => q(`update question_versions v set import_issues = ${HELD} from questions qq where qq.id = v.question_id and qq.live_version_no = v.version_no and qq.id = $1`, [id])
  const newPaper = async (): Promise<{ id: string; sectionId: string }> => {
    const res = await admin.post('/api/admin/papers', { title: 'Set Ujian', subject: 'MAT', kertas: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = Created.parse(res.body).data.id
    const e = Editor.parse((await admin.get(`/api/admin/papers/${id}`)).body).data
    return { id, sectionId: e.paper.sections[0]!.id }
  }
  /** Writes a placement straight into the table: the shape of an old (V2) paper that already holds the question. */
  const place = async (sectionId: string, questionId: string, position = 1) =>
    q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)`, [sectionId, questionId, position])
  const post = (paper: string, sectionId: string, questionId: string) => admin.post(`/api/admin/papers/${paper}/placements`, { sectionId, questionId })

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
    subjects = { mat: await one(`select id::text id from subjects where code = 'MATH'`) }
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subjects.mat} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subjects.mat} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }

    ids = { ok: await mk(), held: await mk(), inactive: await mk(), inactivePinned: await mk(), heldPinned: await mk(), heldKept: await mk() }
    await hold(ids.held)
    await hold(ids.heldPinned)
    await hold(ids.heldKept)
    await q(`update questions set is_active = false where id = any($1::bigint[])`, [[ids.inactive, ids.inactivePinned]])

    // A published paper pins `inactivePinned` and `heldPinned` (decision 56 carve-out for the withdrawn one; the hold is refused all the same).
    const pub = await newPaper()
    await place(pub.sectionId, ids.inactivePinned, 1)
    await place(pub.sectionId, ids.heldPinned, 2)
    await q(`update papers set status = 'published', published_at = now() where id = $1`, [pub.id])
  })
  afterAll(async () => {
    await t.close()
  })

  it('placementBlockers: held and unresolved are refused always; inactive only when no published paper pins it; clean is absent', async () => {
    const blocked = await placementBlockers(t.app.get(PrismaService).client, Object.values(ids))
    expect(blocked.get(ids.held)).toBe('held')
    expect(blocked.get(ids.heldPinned)).toBe('held')
    expect(blocked.get(ids.inactive)).toBe('inactive')
    expect(blocked.has(ids.inactivePinned)).toBe(false)
    expect(blocked.has(ids.ok)).toBe(false)
  })

  it('addPlacement by id: a held question and a withdrawn one are refused (422, nothing written); a clean one is placed', async () => {
    const p = await newPaper()
    expectError(await post(p.id, p.sectionId, ids.held), 'VALIDATION_ERROR', 422, PLACE.notServable(ids.held, PLACEMENT_BLOCK_TEXT.held))
    expectError(await post(p.id, p.sectionId, ids.heldPinned), 'VALIDATION_ERROR', 422, PLACE.notServable(ids.heldPinned, PLACEMENT_BLOCK_TEXT.held))
    expectError(await post(p.id, p.sectionId, ids.inactive), 'VALIDATION_ERROR', 422, PLACE.notServable(ids.inactive, PLACE.statusArchived))
    expect(await q(`select 1 from paper_placements where paper_section_id = $1`, [p.sectionId])).toHaveLength(0)
    expect((await post(p.id, p.sectionId, ids.ok)).status).toBe(201)
  })

  it('replace-placements (PUT): a new held question is refused; one already on the paper is kept (never re-judged)', async () => {
    const p = await newPaper()
    const refused = await admin.put(`/api/admin/papers/${p.id}`, { sections: [{ id: p.sectionId, questionIds: [ids.ok, ids.held] }] })
    expectError(refused, 'VALIDATION_ERROR', 422, PLACE.notServable(ids.held, PLACEMENT_BLOCK_TEXT.held))
    expect(await q(`select 1 from paper_placements where paper_section_id = $1`, [p.sectionId])).toHaveLength(0)

    const old = await newPaper()
    await place(old.sectionId, ids.heldKept, 1)
    const kept = await admin.put(`/api/admin/papers/${old.id}`, { sections: [{ id: old.sectionId, questionIds: [ids.ok, ids.heldKept] }] })
    expect(kept.status, JSON.stringify(kept.body)).toBe(200)
    expect((await q(`select question_id::text qid from paper_placements where paper_section_id = $1 order by position`, [old.sectionId])).map((r) => r.qid)).toEqual([ids.ok, ids.heldKept])
  })

  it('paper import: a held or withdrawn question refuses the import before anything is written', async () => {
    const subjectId = BigInt(subjects.mat)
    const batch = async (n: string) =>
      BigInt(String((await q(`insert into intake_batches (paper_type, subject, kertas, year, source_text, rights_status) values ('trial', 'MAT', 2, 2025, $1, 'own') returning id::text id`, [n]))[0]!.id))
    const input = (sourceBatchId: bigint, questionId: string) => ({ subjectId, kertas: 2, year: 2025, paperCode: 'K2', sourceBatchId, sections: [{ label: 'Bahagian A', placements: [{ questionId: BigInt(questionId), versionNo: 1, numberLabel: '1' }] }] })
    await expect(svc.importDraftPaper(input(await batch('m2-held'), ids.held))).rejects.toBeInstanceOf(PaperImportBlockedError)
    await expect(svc.importDraftPaper(input(await batch('m2-inactive'), ids.inactive))).rejects.toBeInstanceOf(PaperImportBlockedError)
    const ok = await svc.importDraftPaper(input(await batch('m2-ok'), ids.ok))
    expect(ok).toMatchObject({ created: true, added: 1 })
  })

  it('attemptBlockers (Terbit gate of a new paper): a held question that is already on the draft paper is a NOT_SERVABLE line; the paper stays draft', async () => {
    const p = await newPaper()
    await place(p.sectionId, ids.heldKept, 1)
    const out = Publish.parse((await admin.post(`/api/admin/papers/${p.id}/publish`)).body).data
    expect(out.ok).toBe(false)
    expect(out.errors.some((line) => line.includes(ids.heldKept))).toBe(true)
    expect((await q('select status from papers where id = $1', [p.id]))[0]?.status).toBe('draft')
  })

  it('m-7: a group with an archived sibling (latest version) can be placed; the archived member is not a member to place, the live ones go together', async () => {
    const draft = async (text: string): Promise<string> => {
      const res = await admin.post('/api/questions', {
        subjectId: subjects.mat,
        educationLevelId: level,
        difficultyLevel: 3,
        cognitiveLevel: 'mengaplikasi',
        questionType: 'mcq',
        questionText: text,
        options: ['4', '5', '6', '7'],
        correctAnswer: 1,
        tag,
        status: 'draft',
      })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      return Question.parse(res.body).data.id
    }
    const [a, b, gone] = [await draft('Soalan kumpulan satu.'), await draft('Soalan kumpulan dua.'), await draft('Soalan kumpulan tiga.')] as [string, string, string]
    const stim = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan M2', body: { ms: 'Teks rangsangan.' } })
    expect(stim.status, JSON.stringify(stim.body)).toBe(201)
    const grp = await admin.post('/api/stimulus-groups', { stimulusIds: [(stim.body as { data: { id: string } }).data.id], questionIds: [a, b, gone] })
    expect(grp.status, JSON.stringify(grp.body)).toBe(201)
    for (const id of [a, b]) {
      await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [id])
      await q(`update questions set live_version_no = 1 where id = $1`, [id])
    }
    // The third sibling was retired: its latest version is archived and it has no live version (the exemption groupGapCountSql makes).
    await q(`update question_versions set status = 'archived' where question_id = $1`, [gone])
    const p = await newPaper()
    const res = await post(p.id, p.sectionId, a)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const placed = await q(`select question_id::text qid from paper_placements where paper_section_id = $1`, [p.sectionId])
    expect(placed.map((r) => r.qid).sort()).toEqual([a, b].sort())
  })
})
