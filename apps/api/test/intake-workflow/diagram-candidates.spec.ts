import { DiagramAuditResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService, type QuestionCreateInput } from '../../src/modules/questions'
import { QuestionBankAdapter } from '../../src/modules/questions/workflow'
import { makePng } from '../files/fixtures'
import { adminActor } from '../questions/fixtures'
import { bootWorkflowApp, loginAs, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * Audit Rajah (`/admin/soalan-gambar`) lists the migrated questions that need a picture, the way V2 soalan-gambar does, and the admin upload
 * fills the rajah: the Regroup row "Muat naik gambar" must lead to a usable flow. Needs Docker.
 */
let t: WorkflowTestApp
let admin: LoggedIn
let missing: string // names a figure that was never stored (stimulus_missing)
let held: string // a V2 picture that could not be copied (legacy_image_unresolved), with its empty image stimulus
let heldStimulus: string
let plain: string // nothing wrong
let dismissed: string // flag dismissed ("Bukan masalah")
const png = { data: makePng(), name: 'rajah.png', type: 'image/png' }

const q = <T extends object>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params)
const image = (id: string) => admin.agent.post(`/api/diagram-audit/mcq/${id}/image`).set('X-CSRF-Token', admin.csrf).attach('image', png.data, { filename: png.name, contentType: png.type })
const list = async () => DiagramAuditResponseSchema.parse((await admin.agent.get('/api/diagram-audit')).body)
const ids = async () => (await t.app.get(QuestionBankAdapter).listDiagramCandidates('mcq')).map((c) => c.id)

beforeAll(async () => {
  t = await bootWorkflowApp({}, { withQuestionWorkflow: true })
  admin = await loginAs(t, 'admin@demo.test')
  const [tag] = await q<{ s: string; l: string; u: string; sp: string }>(
    `select s.id::text s, l.id::text l, u.id::text u, sp.id::text sp
       from subjects s join education_levels l on l.code = 'T4'
       join curriculum_nodes u on u.subject_id = s.id and u.education_level_id = l.id and u.kind = 'unit'
       join curriculum_nodes sp on sp.subject_id = s.id and sp.education_level_id = l.id and sp.kind = 'sp'
      where s.code = 'MATH' order by u.id, sp.id limit 1`,
  )
  const svc = t.app.get(QuestionsService)
  const actor = await adminActor(t.db)
  const make = async (text: string): Promise<string> =>
    (
      await svc.create(
        {
          questionType: 'mcq',
          questionText: text,
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
  missing = await make('Berdasarkan rajah di atas, berapakah nilai x?')
  held = await make('Berapakah luas segi tiga itu?')
  plain = await make('Berapakah 2 campur 2?')
  dismissed = await make('Berdasarkan graf di atas, apakah kecerunannya?')
  heldStimulus = await svc.createStimulus({ kind: 'diagram', label: 'Rajah 1', bodyMs: null, bodyEn: null, altText: 'Rajah 1', assetFileId: null } as never)
  const [version] = await q<{ id: string }>(`select v.id::text from question_versions v join questions qq on qq.id = v.question_id and qq.latest_version_no = v.version_no where qq.id = $1::bigint`, [held])
  await q(`insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1::bigint, $2::bigint, 1)`, [version!.id, heldStimulus])
  await q(`update question_versions set import_issues = '[{"code":"legacy_image_unresolved","target":"question","path":"x.png"}]'::jsonb where id = $1::bigint`, [version!.id])
  await q(`update questions set is_active = false where id = $1::bigint`, [held])
  await q(`update question_versions set stimulus_flag = 'stimulus_missing', stimulus_flag_ref = 'unnumbered', flag_dismissed_at = now() where question_id = $1::bigint`, [dismissed])
}, 180_000)
afterAll(async () => {
  await t.close()
})

describe('Audit Rajah candidates are the migrated questions that need a picture', () => {
  it('lists a stimulus_missing question and a held V2 picture; not a clean question and not a dismissed flag', async () => {
    const open = await ids()
    expect(open).toContain(missing)
    expect(open).toContain(held)
    expect(open).not.toContain(plain)
    expect(open).not.toContain(dismissed)
    const page = (await list()).data.mcq
    expect(page.items.find((i) => i.id === missing)).toMatchObject({ subject: { name: expect.any(String) } })
    expect(page.meta.totalItems).toBe(open.length)
  })

  it('an admin upload fills the rajah and the question leaves the list', async () => {
    const res = await image(missing)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const links = await q<{ kind: string; asset: string | null }>(
      `select s.kind, s.asset_file_id::text asset from question_version_stimuli qvs join stimuli s on s.id = qvs.stimulus_id
        join question_versions v on v.id = qvs.question_version_id where v.question_id = $1::bigint`,
      [missing],
    )
    expect(links.length).toBeGreaterThanOrEqual(1)
    expect(links.every((l) => l.kind === 'diagram' && l.asset !== null)).toBe(true)
    expect(await ids()).not.toContain(missing)
    // The excluding flags are gone (a fixture question may still carry the display-once stem_duplicated).
    expect((await q<{ f: string | null }>(`select stimulus_flag f from question_versions where question_id = $1::bigint`, [missing])).every((r) => r.f !== 'stimulus_missing' && r.f !== 'figure_only')).toBe(true)
  })

  it('an upload for a held V2 picture fills its empty image stimulus, lifts the hold and re-activates the question', async () => {
    const res = await image(held)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect((await q<{ a: string | null }>(`select asset_file_id::text a from stimuli where id = $1::bigint`, [heldStimulus]))[0]?.a).not.toBeNull()
    expect((await q<{ i: unknown }>(`select import_issues i from question_versions where question_id = $1::bigint`, [held]))[0]?.i).toBeNull()
    expect((await q<{ a: boolean }>(`select is_active a from questions where id = $1::bigint`, [held]))[0]?.a).toBe(true)
    expect(await ids()).not.toContain(held)
  })
})
