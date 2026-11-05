import { DIAGRAM_AUDIT_MESSAGES, DiagramAuditMutationSchema, DiagramAuditResponseSchema, STIMULUS_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { QuestionsService, type QuestionCreateInput } from '../../src/modules/questions'
import { StimuliRepository } from '../../src/modules/questions/stimuli.repository'
import { QuestionBankAdapter } from '../../src/modules/questions/workflow'
import type { DiagramCandidate } from '../../src/modules/questions/workflow/ports'
import { makePng } from '../files/fixtures'
import { WORKFLOW_MESSAGES } from '../../src/modules/intake/workflow/workflow.constants'
import { adminActor } from '../questions/fixtures'
import { bootWorkflowApp, expectError, loginAs, post, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * S6-T18 part 2 (API-Q-21, ruling on #494): a teacher's diagram image is an intake item (source guru, kind diagram, one per group),
 * the question is unchanged, and the admin's accept sets the asset on the EXISTING group stimulus. Needs Docker (compile-only in the sandbox).
 */
let t: WorkflowTestApp
let teacher: LoggedIn
let schoolAdmin: LoggedIn
let admin: LoggedIn
let student: LoggedIn
let groupQuestions: string[] // three questions of one group
let loneQuestion: string // no group
let otherGroupQuestion: string
let diagramStimulus: string // the image-kind stimulus (no file yet) of the main group
let hiddenQuestion: string // a draft of another author: not visible to a teacher
let dismissedQuestion: string
let otherStimulus: string
let goneQuestion: string // group removed before accept
let overwriteQuestion: string // stimulus gets a file before accept
let overwriteStimulus: string
let foreignQuestion: string
let goneGroup: string // image file not the batch owner's at accept
const png = { data: makePng(), name: 'rajah.png', type: 'image/png' }

const q = <T extends object>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params)
const image = (who: LoggedIn, id: string, file: { data: Buffer; name: string; type: string } = png, kind = 'mcq') =>
  who.agent.post(`/api/diagram-audit/${kind}/${id}/image`).set('X-CSRF-Token', who.csrf).attach('image', file.data, { filename: file.name, contentType: file.type })
const list = async (who: LoggedIn) => DiagramAuditResponseSchema.parse((await who.agent.get('/api/diagram-audit')).body)
const openItems = async () => (await q<{ id: string }>(`select id::text from intake_items where review_state in ('generated','needs_review','duplicate') and payload ? 'target' order by id`)).map((r) => r.id)
const assetOf = async (stimulusId: string) => (await q<{ a: string | null }>('select asset_file_id::text a from stimuli where id = $1::bigint', [stimulusId]))[0]!.a

beforeAll(async () => {
  t = await bootWorkflowApp({}, { withQuestionWorkflow: true })
  teacher = await loginAs(t, 'guru@demo.test')
  schoolAdmin = await loginAs(t, 'adminsekolah@demo.test')
  admin = await loginAs(t, 'admin@demo.test')
  student = await loginAs(t, 'pelajar@demo.test')

  const [tag] = await q<{ s: string; l: string; u: string; sp: string }>(
    `select s.id::text s, l.id::text l, u.id::text u, sp.id::text sp
       from subjects s join education_levels l on l.code = 'T4'
       join curriculum_nodes u on u.subject_id = s.id and u.education_level_id = l.id and u.kind = 'unit'
       join curriculum_nodes sp on sp.subject_id = s.id and sp.education_level_id = l.id and sp.kind = 'sp'
      where s.code = 'MATH' order by u.id, sp.id limit 1`,
  )
  const svc = t.app.get(QuestionsService)
  const actor = await adminActor(t.db)
  const make = async (n: number): Promise<string> =>
    (
      await svc.create(
        {
          questionType: 'mcq',
          questionText: `Berdasarkan rajah, soalan ${String(n)}?`,
          subjectId: tag!.s,
          educationLevelId: tag!.l,
          difficultyLevel: 2,
          cognitiveLevel: 'mengaplikasi',
          options: ['4', '5', '6', '7'],
          correctAnswer: 1,
          tag: { unitId: tag!.u, spIds: [tag!.sp], tp: 3 },
        } as unknown as QuestionCreateInput,
        actor,
      )
    ).id
  // A group is a passage plus an image-kind stimulus without a file (the diagram candidate predicate); the image goes to the second one.
  const groupOf = async (label: string) => {
    const passage = await svc.createStimulus({ kind: 'passage', label, bodyMs: 'Rajah menunjukkan sebuah litar.', bodyEn: null, altText: null, assetFileId: null })
    const diagram = await svc.createStimulus({ kind: 'passage', label: `${label} (rajah)`, bodyMs: 'Rajah litar.', bodyEn: null, altText: null, assetFileId: null })
    await q(`update stimuli set kind = 'diagram' where id = $1::bigint`, [diagram])
    return { diagram, group: await svc.createStimulusGroup({ label, scope: 'section', stimulusIds: [passage, diagram], optionBank: [] }) }
  }
  const inGroup = async (n: number, groupId: string, position = 1): Promise<string> => {
    const id = await make(n)
    await q('update questions set group_id = $2::bigint, group_position = $3 where id = $1::bigint', [id, groupId, position])
    return id
  }
  const main = await groupOf('Litar')
  diagramStimulus = main.diagram
  groupQuestions = [await make(1), await make(2), await make(3)]
  for (const [i, id] of groupQuestions.entries()) await q('update questions set group_id = $2::bigint, group_position = $3 where id = $1::bigint', [id, main.group, i + 1])
  const other = await groupOf('Graf')
  otherStimulus = other.diagram
  otherGroupQuestion = await inGroup(4, other.group)
  loneQuestion = await make(5)
  hiddenQuestion = await make(6)
  dismissedQuestion = await make(7)
  const gone = await groupOf('Hilang')
  goneQuestion = await inGroup(8, gone.group)
  goneGroup = gone.group
  const over = await groupOf('Timpa')
  overwriteQuestion = await inGroup(9, over.group)
  overwriteStimulus = over.diagram
  const foreign = await groupOf('Asing')
  foreignQuestion = await inGroup(10, foreign.group)

  // The questions a teacher may see: approved and active (the rest are admin drafts). `hiddenQuestion` stays a draft of another author.
  const approved = new Set([...groupQuestions, otherGroupQuestion, loneQuestion, dismissedQuestion, goneQuestion, overwriteQuestion, foreignQuestion])
  const bank = t.app.get(QuestionBankAdapter)
  const realStatus = bank.getStatus.bind(bank)
  vi.spyOn(bank, 'getStatus').mockImplementation(async (id: string) => {
    const status = await realStatus(id)
    return status && approved.has(id) ? { ...status, status: 'approved', isActive: true } : status
  })

  // The real bank has no candidate source yet (awaiting S1-T07): the flagged questions are supplied here.
  const candidate = (id: string): DiagramCandidate => ({
    id, kind: 'mcq', text: `Soalan ${id}`, subjectId: tag!.s, subjectName: 'Matematik', createdBy: { id: '1', name: null, schoolId: null }, sourceFile: null, sourcePage: null,
  })
  vi.spyOn(t.app.get(QuestionBankAdapter), 'listDiagramCandidates').mockImplementation(async () => [...groupQuestions, otherGroupQuestion, loneQuestion, hiddenQuestion, dismissedQuestion, goneQuestion, overwriteQuestion, foreignQuestion].map(candidate))
}, 180_000)
afterAll(async () => {
  vi.restoreAllMocks()
  await t.close()
})

describe('teacher image: an intake item, not a change of the question', () => {
  it('stores an owned question_image, a guru batch with one diagram stimulus and one needs_review item; the question and stimulus are unchanged', async () => {
    const before = await q('select * from questions where id = $1::bigint', [groupQuestions[0]])
    const res = await image(teacher, groupQuestions[0]!)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(DiagramAuditMutationSchema.parse(res.body)).toEqual({ data: { id: groupQuestions[0], needsDiagram: true }, status: DIAGRAM_AUDIT_MESSAGES.submittedForReview })

    const rows = await q<{ source: string; status: string; owner: string; kind: string; ref: string; review_state: string; source_type: string; question_id: string; target: Record<string, string>; file_owner: string; purpose: string }>(
      `select b.source, b.status, b.owner_user_id::text owner, s.kind, s.ref, i.review_state, i.source_type, i.question_id::text, i.payload -> 'target' target,
              f.owner_user_id::text file_owner, f.purpose
         from intake_items i join intake_batches b on b.id = i.batch_id join intake_stimuli s on s.id = i.stimulus_id
         join files f on f.id = (i.payload -> 'target' ->> 'imageFileId')::bigint
        where i.payload -> 'target' ->> 'questionId' = $1`,
      [groupQuestions[0]],
    )
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row).toMatchObject({ source: 'guru', status: 'ready_for_review', kind: 'diagram', review_state: 'needs_review', source_type: 'manual', question_id: groupQuestions[0], purpose: 'question_image', file_owner: row.owner })
    expect(row.ref).toMatch(/^group:\d+$/)
    expect(row.target).toMatchObject({ questionId: groupQuestions[0], groupId: row.ref.slice('group:'.length), stimulusId: diagramStimulus })
    expect(await q('select * from questions where id = $1::bigint', [groupQuestions[0]])).toEqual(before)
    expect(await assetOf(diagramStimulus)).toBeNull()
    expect(await q('select 1 from diagram_audit_resolutions where question_id = $1::bigint', [groupQuestions[0]])).toHaveLength(0)
  })

  it('the list shows pendingReview for the question and for the others of its group, and not for another group', async () => {
    const mcq = (await list(teacher)).data.mcq.items
    const flag = (id: string) => mcq.find((i) => i.id === id)?.pendingReview
    expect(flag(groupQuestions[0]!)).toBe(true)
    expect(flag(groupQuestions[1]!)).toBe(true)
    expect(flag(groupQuestions[2]!)).toBe(true)
    expect(flag(otherGroupQuestion)).toBe(false)
    expect(flag(loneQuestion)).toBe(false)
    // The question stays listed for the admin too.
    expect((await list(admin)).data.mcq.items.find((i) => i.id === groupQuestions[0])?.pendingReview).toBe(true)
  })

  it('one open image per group: a second upload for any question of the group is 409, nothing new is stored', async () => {
    const files = (await q('select id from files where purpose = $1', ['question_image'])).length
    const again = await image(teacher, groupQuestions[2]!)
    expectError(again, 'CONFLICT', DIAGRAM_AUDIT_MESSAGES.alreadyPending)
    expect(await openItems()).toHaveLength(1)
    expect((await q('select id from files where purpose = $1', ['question_image'])).length).toBe(files)
  })

  it('a question with no stimulus group is 409', async () => {
    expectError(await image(teacher, loneQuestion), 'CONFLICT', DIAGRAM_AUDIT_MESSAGES.noStimulusGroup)
  })

  it('a second teacher image for another group is accepted (own batch, own file)', async () => {
    const res = await image(teacher, otherGroupQuestion)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toEqual({ id: otherGroupQuestion, needsDiagram: true })
  })

  it('a school admin is 403 on the upload (the list stays open to the role)', async () => {
    expectError(await image(schoolAdmin, loneQuestion), 'FORBIDDEN')
    expect((await schoolAdmin.agent.get('/api/diagram-audit')).status).toBe(200)
  })

  it('a student is 403; dismiss stays admin only; no session is 401', async () => {
    expectError(await image(student, loneQuestion), 'FORBIDDEN')
    expectError(await post(teacher, `/diagram-audit/mcq/${loneQuestion}/dismiss`), 'FORBIDDEN')
    expectError(await post(schoolAdmin, `/diagram-audit/mcq/${loneQuestion}/dismiss`), 'FORBIDDEN')
    expectError(await t.http().post(`/api/diagram-audit/mcq/${loneQuestion}/image`), 'UNAUTHORIZED')
  })

  it('type and size: a gif, a disguised text file and a 3 MB png are 422 on fields.image; unknown question is 404', async () => {
    const cases: [{ data: Buffer; name: string; type: string }, string][] = [
      [{ data: Buffer.from('GIF89a\u0001\u0000\u0001\u0000', 'latin1'), name: 'rajah.gif', type: 'image/gif' }, DIAGRAM_AUDIT_MESSAGES.fileType],
      [{ data: Buffer.from('bukan gambar'), name: 'rajah.png', type: 'image/png' }, DIAGRAM_AUDIT_MESSAGES.fileType],
      [{ data: makePng({ padTo: 3 * 1024 * 1024 }), name: 'besar.png', type: 'image/png' }, DIAGRAM_AUDIT_MESSAGES.fileSize],
    ]
    for (const [file, message] of cases) {
      const res = await image(teacher, loneQuestion, file)
      expect(res.status).toBe(422)
      expect(res.body.error.fields).toEqual({ image: message })
    }
    expectError(await image(teacher, '999999'), 'NOT_FOUND')
    expect(await openItems()).toHaveLength(2)
  })
})

describe('target guard', () => {
  it('a kind that is not the question type is 404, like an unknown id; nothing is stored', async () => {
    const files = (await q('select id from files where purpose = $1', ['question_image'])).length
    expectError(await image(teacher, loneQuestion, png, 'structured'), 'NOT_FOUND')
    expect((await q('select id from files where purpose = $1', ['question_image'])).length).toBe(files)
  })

  it('a draft of another author is 404 for a teacher', async () => {
    expectError(await image(teacher, hiddenQuestion), 'NOT_FOUND')
  })

  it('a dismissed question is 404', async () => {
    expect((await post(admin, `/diagram-audit/mcq/${dismissedQuestion}/dismiss`)).status).toBe(200)
    expectError(await image(teacher, dismissedQuestion), 'NOT_FOUND')
  })
})

describe('admin direct upload is unchanged', () => {
  it('Admin Pusat may still upload on a dismissed question (the dismissed check is for the teacher path only)', async () => {
    const attach = vi.spyOn(t.app.get(QuestionBankAdapter), 'attachDiagram').mockResolvedValue(true)
    try {
      const res = await image(admin, dismissedQuestion)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toEqual({ id: dismissedQuestion, needsDiagram: false })
    } finally {
      attach.mockRestore()
    }
  })
})

describe('admin review of the diagram item', () => {
  it('reject leaves the question and the stimulus unchanged; the group may then take a new image', async () => {
    const [item] = await q<{ id: string; file: string }>(`select id::text, payload -> 'target' ->> 'imageFileId' as file from intake_items where payload -> 'target' ->> 'questionId' = $1`, [otherGroupQuestion])
    const id = item!.id
    expect(await q('select 1 from files where id = $1::bigint', [item!.file])).toHaveLength(1)
    const res = await post(admin, `/intake/items/${id}/reject`, { reason: 'Gambar tidak jelas.' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await q('select 1 from files where id = $1::bigint', [item!.file])).toHaveLength(0) // the source image is discarded
    expect(await assetOf(otherStimulus)).toBeNull()
    expect(await q('select 1 from diagram_audit_resolutions where question_id = $1::bigint', [otherGroupQuestion])).toHaveLength(0)
    expect((await list(teacher)).data.mcq.items.find((i) => i.id === otherGroupQuestion)).toMatchObject({ pendingReview: false })
    expect(res.body.data.state).toBe('rejected')
  })

  it('accept sets the asset on the EXISTING group stimulus (a copy owned by the batch owner), makes no stimulus, group or question, and resolves the question', async () => {
    const [id] = (await q<{ id: string }>(`select id::text from intake_items where payload -> 'target' ->> 'questionId' = $1`, [groupQuestions[0]])).map((r) => r.id)
    const counts = async () => (await q<{ s: string; g: string; qn: string }>('select (select count(*) from stimuli)::text s, (select count(*) from stimulus_groups)::text g, (select count(*) from questions)::text qn'))[0]
    const before = await counts()
    const res = await post(admin, `/intake/items/${id}/accept`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await counts()).toEqual(before)
    const asset = await assetOf(diagramStimulus)
    expect(asset).not.toBeNull()
    const [file] = await q<{ purpose: string; owner: string; src: string }>(
      `select f.purpose, f.owner_user_id::text owner, (i.payload -> 'target' ->> 'imageFileId') src from files f, intake_items i where f.id = $1::bigint and i.id = $2::bigint`,
      [asset, id],
    )
    expect(file).toMatchObject({ purpose: 'question_image' })
    expect(file!.src).not.toBe(asset) // a copy, not the teacher's own file
    expect(await q('select 1 from diagram_audit_resolutions where kind = $2 and question_id = $1::bigint and resolution = $3 and file_id = $4::bigint', [groupQuestions[0], 'mcq', 'image', asset])).toHaveLength(1)
    expect((await q<{ review_state: string }>('select review_state from intake_items where id = $1::bigint', [id]))[0]!.review_state).toBe('accepted')
    // Accepted again: 409. The question no longer appears as needing a diagram, and the group is open to a new image again.
    expectError(await post(admin, `/intake/items/${id}/accept`), 'CONFLICT')
    expect((await list(teacher)).data.mcq.items.some((i) => i.id === groupQuestions[0])).toBe(false)
    expect(await openItems()).toHaveLength(0)
  })

  it('after an accept a sibling upload of the group is 409 (the stimulus has its file)', async () => {
    expectError(await image(teacher, groupQuestions[1]!), 'CONFLICT', DIAGRAM_AUDIT_MESSAGES.noStimulusGroup)
  })
})

describe('accept guards', () => {
  const itemOf = async (questionId: string) =>
    (await q<{ id: string }>(`select id::text from intake_items where payload -> 'target' ->> 'questionId' = $1 and review_state = 'needs_review'`, [questionId]))[0]!.id
  const serveQuestion = async (questionId: string) => {
    await q(`update question_versions set status = 'approved' where question_id = $1::bigint and version_no = (select latest_version_no from questions where id = $1::bigint)`, [questionId])
    await q('update questions set live_version_no = latest_version_no, is_active = true where id = $1::bigint', [questionId])
  }
  const stateOf = async (id: string) => (await q<{ review_state: string }>('select review_state from intake_items where id = $1::bigint', [id]))[0]!.review_state

  it('a teacher accepting their own diagram item is 403 (INTAKE_TEACHER_ENABLED is on); the stimulus and the item stay unchanged', async () => {
    expect((await image(teacher, otherGroupQuestion)).status).toBe(200) // the group is free again after the reject
    const id = await itemOf(otherGroupQuestion)
    expectError(await post(teacher, `/intake/items/${id}/accept`), 'FORBIDDEN')
    expect(await assetOf(otherStimulus)).toBeNull()
    expect(await stateOf(id)).toBe('needs_review')
  })

  it('a stimulus pinned by a held paper is 409 stimulusServed: nothing is set and the copy is removed', async () => {
    const id = await itemOf(otherGroupQuestion)
    const files = (await q('select id from files where purpose = $1', ['question_image'])).length
    const repo = t.app.get(StimuliRepository)
    await serveQuestion(otherGroupQuestion) // real QUESTION_SERVED predicate
    expect(await repo.stimulusServed(otherStimulus)).toBe(true)
    // A real held paper needs a published paper with placements; only that half is stubbed.
    const held = vi.spyOn(repo, 'stimulusHeldByPaper').mockResolvedValue(true)
    try {
      expectError(await post(admin, `/intake/items/${id}/accept`), 'CONFLICT', STIMULUS_MESSAGES.stimulusServed)
    } finally {
      held.mockRestore()
    }
    expect(await assetOf(otherStimulus)).toBeNull()
    expect(await stateOf(id)).toBe('needs_review')
    expect((await q('select id from files where purpose = $1', ['question_image'])).length).toBe(files)
  })

  it('the edit path keeps the target, and a bulk accept sets the asset even while the question is served (lead ruling on #494, FR-X1-4f)', async () => {
    const id = await itemOf(otherGroupQuestion)
    const before = (await q<{ t: unknown }>(`select payload -> 'target' as t from intake_items where id = $1::bigint`, [id]))[0]!.t
    const patched = await admin.agent.patch(`/api/intake/items/${id}`).set('X-CSRF-Token', admin.csrf).send({ stem: 'Gambar rajah graf untuk soalan ini.' })
    expect(patched.status, JSON.stringify(patched.body)).toBe(200)
    expect((await q<{ t: unknown }>(`select payload -> 'target' as t from intake_items where id = $1::bigint`, [id]))[0]!.t).toEqual(before)
    // Served by a live approved question but not pinned by a held paper: a stimulus with no file was unservable, so the first file is allowed.
    // The question is live, approved and active (real QUESTION_SERVED) and no held paper pins it.
    await serveQuestion(otherGroupQuestion)
    expect(await t.app.get(StimuliRepository).stimulusServed(otherStimulus)).toBe(true)
    const res = await post(admin, '/intake/items/bulk', { action: 'accept', ids: [id] })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.results[0].outcome, JSON.stringify(res.body)).toBe('done')
    expect(await assetOf(otherStimulus)).not.toBeNull()
    expect(await stateOf(id)).toBe('accepted')
  })

  it('a group removed before the accept is 409 diagramTargetGone', async () => {
    expect((await image(teacher, goneQuestion)).status).toBe(200)
    const id = await itemOf(goneQuestion)
    await q('delete from stimulus_group_stimuli where group_id = $1::bigint', [goneGroup])
    expectError(await post(admin, `/intake/items/${id}/accept`), 'CONFLICT', WORKFLOW_MESSAGES.diagramTargetGone)
    expect(await stateOf(id)).toBe('needs_review')
  })

  it('a stimulus that got a file before the accept is never overwritten: 409 diagramTargetGone', async () => {
    expect((await image(teacher, overwriteQuestion)).status).toBe(200)
    const id = await itemOf(overwriteQuestion)
    const [file] = await q<{ id: string }>('select id::text from files where purpose = $1 limit 1', ['question_image'])
    await q('update stimuli set asset_file_id = $2::bigint where id = $1::bigint', [overwriteStimulus, file!.id])
    expectError(await post(admin, `/intake/items/${id}/accept`), 'CONFLICT', WORKFLOW_MESSAGES.diagramTargetGone)
    expect(await assetOf(overwriteStimulus)).toBe(file!.id)
    expect(await stateOf(id)).toBe('needs_review')
  })

  it('a missing or foreign image file at accept is 422', async () => {
    expect((await image(teacher, foreignQuestion)).status).toBe(200)
    const id = await itemOf(foreignQuestion)
    await q(`update intake_items set payload = jsonb_set(payload, '{target,imageFileId}', '"999999999"') where id = $1::bigint`, [id])
    expect((await post(admin, `/intake/items/${id}/accept`)).status).toBe(422)
    const [foreign] = await q<{ id: string }>(
      `select f.id::text from files f where f.purpose = 'question_image' and f.owner_user_id is distinct from
         (select b.owner_user_id from intake_batches b join intake_items i on i.batch_id = b.id where i.id = $1::bigint) limit 1`,
      [id],
    )
    if (foreign) {
      await q(`update intake_items set payload = jsonb_set(payload, '{target,imageFileId}', to_jsonb($2::text)) where id = $1::bigint`, [id, foreign.id])
      expect((await post(admin, `/intake/items/${id}/accept`)).status).toBe(422)
    }
    expect(await stateOf(id)).toBe('needs_review')
  })
})
