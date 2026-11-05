import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { QUESTION_MESSAGES, QuestionSchema, REGROUP_MESSAGES, STIMULUS_MESSAGES, StimulusSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsRepository } from '../../src/modules/questions'
import { filterOf } from '../../src/modules/questions/serving'
import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/**
 * S1-T07 part 2 (60 section 2.17.4): "Bukan masalah" (API-Q-12), the regroup work-list (API-Q-13), the regroup (API-Q-24, DM-59) and its undo
 * (API-Q-36), the API-Q-01 filters, AC-ADM-QE2.5. Real database, real session guard, one transaction per action.
 */
describe('stimulus flags, regroup and undo (S1-T07 part 2, real database)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let teacher: Client
  let refs: Refs
  let repo: QuestionsRepository
  let tag: Awaited<ReturnType<typeof tagOf>>
  let seq = 0

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-regroup-'))
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    process.env.THROTTLE_SERVABILITY_READ_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    teacher = await loginAs(t, 'teacher')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    repo = t.app.get(QuestionsRepository)
  })
  afterAll(async () => {
    await t.close()
  })

  const q = <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<R>(sql, params)
  const one = async <R>(sql: string, params: unknown[] = []): Promise<R> => (await q<R>(sql, params))[0] as R

  /** A draft question, then published by SQL (live version 1): the flag detectors ran at create, so a "Rajah n" text is `stimulus_missing`. */
  async function served(text: string, over: Record<string, unknown> = {}): Promise<string> {
    const res = await admin.post('/api/questions', mcqBody(refs, { questionText: text, tag, ...over }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [id])
    await q(`update questions set live_version_no = 1 where id = $1`, [id])
    return id
  }
  /** A stimulus (passage) with a given content hash, so that a member's own copy of it counts as "the same file". */
  async function stimulus(label: string, hash: string | null = null): Promise<string> {
    const res = await admin.post('/api/stimuli', { kind: 'passage', label, body: { ms: 'Teks rangsangan.' } })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = mutationEnvelopeOf(StimulusSchema).parse(res.body).data.id
    if (hash !== null) await q(`update stimuli set content_hash = $2 where id = $1`, [id, hash])
    return id
  }
  const linkStem = (questionId: string, stimulusId: string) =>
    q(`insert into question_version_stimuli (question_version_id, stimulus_id, position) select id, $2::bigint, 1 from question_versions where question_id = $1 and version_no = 1`, [questionId, stimulusId])
  /** A figure-only question: a stem stimulus link and the stored flag (the detector itself is proven in stimulus-flags.spec.ts). */
  async function figure(stimulusId: string): Promise<string> {
    const id = await served('Pilih jawapan.')
    await linkStem(id, stimulusId)
    await q(`update question_versions set stimulus_flag = 'figure_only', stimulus_flag_at = now() where question_id = $1`, [id])
    return id
  }
  const flagRow = (id: string) => one<{ stimulus_flag: string | null; flag_dismissed_at: Date | null; flag_dismissed_by: string | null; status: string; archive_reason: string | null }>(
    `select stimulus_flag, flag_dismissed_at, flag_dismissed_by::text, status, archive_reason from question_versions where question_id = $1 and version_no = 1`, [id])
  const audit = (action: string) => q<{ id: string; target_id: string; detail: Record<string, unknown> | null }>(`select id::text, target_id, detail from audit_events where action = $1 order by id`, [action])
  const drawn = async (ids: string[]) => new Set(await repo.eligibleAmong(ids, filterOf('simulasi_kuiz')))

  // ------------------------------------------------------------------------------------------------------ API-Q-12 Bukan masalah

  describe('POST /api/admin/questions/:id/flags/dismiss (API-Q-12, FR-ADM-G7.4)', () => {
    it('[CI] dismisses stimulus_missing: 200 {id, flags: []}, the question is drawn again, the audit row names the flag', async () => {
      const id = await served('Rajah 21 menunjukkan satu litar. Hitung rintangan berkesan.')
      expect((await drawn([id])).has(id)).toBe(false)
      const res = await admin.post(`/api/admin/questions/${id}/flags/dismiss`, { flag: 'stimulus_missing' })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body).toEqual({ data: { id, flags: [] } })
      const row = await flagRow(id)
      expect(row.stimulus_flag).toBe('stimulus_missing')
      expect(row.flag_dismissed_at).toBeInstanceOf(Date)
      expect(row.flag_dismissed_by).toBe(admin.userId)
      expect((await drawn([id])).has(id)).toBe(true)
      const rows = (await audit('question.flag_dismissed')).filter((r) => r.target_id === id)
      expect(rows).toHaveLength(1)
      expect(rows[0]!.detail).toMatchObject({ flag: 'stimulus_missing' })
    })

    it('[CI] dismissing again is a 200 that changes nothing; a flag that is not the stored one is 409; an unknown id is 404; a bad flag is 422', async () => {
      const id = await served('Rajah 22 menunjukkan satu graf. Berapakah kecerunannya?')
      expect((await admin.post(`/api/admin/questions/${id}/flags/dismiss`, { flag: 'stimulus_missing' })).status).toBe(200)
      const first = (await flagRow(id)).flag_dismissed_at
      const again = await admin.post(`/api/admin/questions/${id}/flags/dismiss`, { flag: 'stimulus_missing' })
      expect(again.status).toBe(200)
      expect((await flagRow(id)).flag_dismissed_at).toEqual(first)
      const wrong = await admin.post(`/api/admin/questions/${id}/flags/dismiss`, { flag: 'figure_only' })
      expect(wrong.status).toBe(409)
      expect(wrong.body.error.message).toBe(STIMULUS_MESSAGES.conflict)
      expect((await admin.post('/api/admin/questions/987654321/flags/dismiss', { flag: 'stimulus_missing' })).status).toBe(404)
      const bad = await admin.post(`/api/admin/questions/${id}/flags/dismiss`, { flag: 'lain' })
      expect(bad.status).toBe(422)
      expect(bad.body.error.fields.flag).toBe(STIMULUS_MESSAGES.requestInvalid)
      expect((await admin.post(`/api/admin/questions/${id}/flags/dismiss`, {})).status).toBe(422)
    })

    it('[CI] a question with no flag answers 409; stem_duplicated can be dismissed too', async () => {
      const dup = await served('Apakah hasil tambah dua nombor genap yang berturutan?')
      expect((await flagRow(dup)).stimulus_flag).toBe('stem_duplicated')
      expect((await admin.post(`/api/admin/questions/${dup}/flags/dismiss`, { flag: 'stem_duplicated' })).status).toBe(200)
      await q(`update question_versions set stimulus_flag = null where question_id = $1`, [dup])
      expect((await admin.post(`/api/admin/questions/${dup}/flags/dismiss`, { flag: 'stem_duplicated' })).status).toBe(409)
    })

    it('[CI] Admin Pusat only: a teacher is 403, no session is 401', async () => {
      const id = await served('Rajah 23 menunjukkan satu carta. Namakan carta itu.')
      expect((await teacher.post(`/api/admin/questions/${id}/flags/dismiss`, { flag: 'stimulus_missing' })).status).toBe(403)
      expect((await t.http().post(`/api/admin/questions/${id}/flags/dismiss`).send({ flag: 'stimulus_missing' })).status).toBe(401)
      expect((await teacher.get('/api/admin/questions/regroup-worklist')).status).toBe(403)
    })
  })

  // ------------------------------------------------------------------------------------------------------ API-Q-24 + API-Q-36

  describe('POST /api/admin/questions/regroup and .../:auditId/undo (API-Q-24, API-Q-36, FR-QA-13, DM-59)', () => {
    /** A figure-only question and two served, flagged members; each member also carries its own copy of the figure (same content hash). */
    async function scenario() {
      seq += 1
      const hash = `hash-${String(seq)}-${String(Date.now())}`
      const figureStimulus = await stimulus(`Rajah ${String(30 + seq)}`, hash)
      const figureId = await figure(figureStimulus)
      const a = await served(`Rajah ${String(30 + seq)} menunjukkan dua tin. Pilih yang betul A${String(seq)}.`)
      const b = await served(`Rajah ${String(30 + seq)} juga menunjukkan dua tin. Pilih yang betul B${String(seq)}.`)
      const own = await stimulus('Salinan', hash)
      await linkStem(a, own)
      return { hash, figureStimulus, figureId, a, b, own }
    }

    it('[CI] AC-QA-13 / AC-ADM-QE8.3: figure + 2 served members -> 1 group, 2 members, own image removed, still Diluluskan, figure archived `regrouped`, audit id in meta', async () => {
      const s = await scenario()
      expect((await drawn([s.a, s.b])).size).toBe(0)
      const res = await admin.post('/api/admin/questions/regroup', { figureQuestionId: s.figureId, memberQuestionIds: [s.a, s.b], stimulus: { alt: 'Dua tin yang sama saiz' } })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const group = res.body.data
      expect(group.questionIds).toEqual([s.a, s.b])
      expect(group.stimuli.map((x: { id: string }) => x.id)).toEqual([s.figureStimulus])
      expect(group.subjectId).toBe(refs.mathId)
      expect(group.educationLevelId).toBe(refs.t4Id)
      expect(res.body.meta.auditId).toMatch(/^[1-9]\d*$/)
      // The members: still approved, flags cleared (a group now), the own copy of the figure gone.
      for (const id of [s.a, s.b]) {
        const row = await flagRow(id)
        expect(row.status).toBe('approved')
        expect(row.stimulus_flag).not.toBe('stimulus_missing')
      }
      expect(Number((await one<{ n: string }>(`select count(*) n from question_version_stimuli where stimulus_id = $1`, [s.own])).n)).toBe(0)
      // The figure question: archived with the new reason, a status event, no longer live.
      const fig = await flagRow(s.figureId)
      expect(fig.status).toBe('archived')
      expect(fig.archive_reason).toBe('regrouped')
      expect((await one<{ live_version_no: number | null }>(`select live_version_no from questions where id = $1`, [s.figureId])).live_version_no).toBeNull()
      const ev = await one<{ to_status: string; reason: string }>(`select to_status, reason from question_status_events where question_id = $1 order by id desc limit 1`, [s.figureId])
      expect(ev).toEqual({ to_status: 'archived', reason: 'regrouped' })
      // AC-ADM-G7.2: the pupil can draw both members now (the group is complete: both approved). Kuiz serves a stimulus; Latih Tubi does after S1-T06 (D105).
      expect([...(await drawn([s.a, s.b]))].sort()).toEqual([s.a, s.b].sort())
      // DM-59: the audit row holds before and after.
      const row = (await audit('questions.regrouped')).find((r) => r.id === res.body.meta.auditId)!
      expect(row.target_id).toBe(group.id)
      expect(row.detail).toMatchObject({ v: 1, groupId: group.id, members: `${s.a},${s.b}`, figureQuestionId: s.figureId, stimulusIds: s.figureStimulus })
      expect((row.detail as { versions: unknown[] }).versions).toHaveLength(2)
    })

    it('[CI] AC-QA-13 undo: 200 {restored}, membership, image link, archived question and flags are back; a second undo is 409', async () => {
      const s = await scenario()
      const before = { a: await flagRow(s.a), b: await flagRow(s.b) }
      expect(before.a.stimulus_flag).toBe('stimulus_missing')
      const done = await admin.post('/api/admin/questions/regroup', { figureQuestionId: s.figureId, memberQuestionIds: [s.a, s.b], stimulus: { alt: 'Dua tin' } })
      expect(done.status, JSON.stringify(done.body)).toBe(200)
      const groupId = done.body.data.id as string
      const undo = await admin.post(`/api/admin/questions/regroup/${done.body.meta.auditId as string}/undo`)
      expect(undo.status, JSON.stringify(undo.body)).toBe(200)
      expect(undo.body).toEqual({ data: { restored: 3 } })
      expect((await q(`select 1 from stimulus_groups where id = $1`, [groupId])).length).toBe(0)
      expect((await q(`select 1 from questions where id in ($1, $2) and group_id is not null`, [s.a, s.b])).length).toBe(0)
      expect(await flagRow(s.a)).toEqual(before.a)
      expect(await flagRow(s.b)).toEqual(before.b)
      expect(Number((await one<{ n: string }>(`select count(*) n from question_version_stimuli where stimulus_id = $1`, [s.own])).n)).toBe(1)
      const fig = await flagRow(s.figureId)
      expect(fig).toMatchObject({ status: 'approved', archive_reason: null, stimulus_flag: 'figure_only' })
      expect((await one<{ live_version_no: number | null }>(`select live_version_no from questions where id = $1`, [s.figureId])).live_version_no).toBe(1)
      expect((await audit('questions.regroup_undone')).some((r) => r.target_id === groupId)).toBe(true)
      const again = await admin.post(`/api/admin/questions/regroup/${done.body.meta.auditId as string}/undo`)
      expect(again.status).toBe(409)
      expect(again.body.error.message).toBe(REGROUP_MESSAGES.undoConflict)
    })

    it('[CI] undo is refused with the 60 text after a later edit of the group (member added), of a member (new version) and after a draft copy', async () => {
      const refused = async (mutate: (s: Awaited<ReturnType<typeof scenario>>, groupId: string) => Promise<void>) => {
        const s = await scenario()
        const done = await admin.post('/api/admin/questions/regroup', { figureQuestionId: s.figureId, memberQuestionIds: [s.a, s.b], stimulus: { alt: 'Dua tin' } })
        expect(done.status, JSON.stringify(done.body)).toBe(200)
        await mutate(s, done.body.data.id as string)
        const res = await admin.post(`/api/admin/questions/regroup/${done.body.meta.auditId as string}/undo`)
        expect(res.status, JSON.stringify(res.body)).toBe(409)
        expect(res.body.error.message).toBe('Kumpulan telah diubah selepas kumpul semula; tidak boleh dibuat asal.')
        // Nothing changed: the group is still there.
        expect((await q(`select 1 from stimulus_groups where id = $1`, [done.body.data.id])).length).toBe(1)
      }
      await refused(async (_s, groupId) => {
        const extra = await admin.post('/api/questions', mcqBody(refs, { questionText: 'Soalan tambahan untuk kumpulan itu.', tag }))
        const res = await admin.post(`/api/stimulus-groups/${groupId}/members`, { questionId: mutationEnvelopeOf(QuestionSchema).parse(extra.body).data.id })
        expect(res.status, JSON.stringify(res.body)).toBe(200)
      })
      await refused(async (s) => {
        await q(`update questions set latest_version_no = 2 where id = $1`, [s.a])
        await q(`insert into question_versions (question_id, version_no, status, type, stem_ms, subject_id, education_level_id) select question_id, 2, 'draft', type, stem_ms, subject_id, education_level_id from question_versions where question_id = $1 and version_no = 1`, [s.a])
      })
      await refused(async (_s, groupId) => {
        const draft = await admin.post(`/api/stimulus-groups/${groupId}/edit-as-draft`)
        expect(draft.status, JSON.stringify(draft.body)).toBe(201)
      })
      await refused(async (s) => {
        await q(`update question_versions set stem_ms = stem_ms || ' (disunting)', updated_at = now() + interval '1 second' where question_id = $1 and version_no = 1`, [s.b])
      })
    })

    it('[CI] undo: unknown audit id is 404, an audit row of another action is 404, a non-numeric id is 404, a teacher is 403', async () => {
      expect((await admin.post('/api/admin/questions/regroup/987654321/undo')).status).toBe(404)
      const other = (await audit('question.flag_dismissed'))[0] ?? (await audit('questions.regroup_undone'))[0] ?? (await q<{ id: string }>(`select id::text id from audit_events limit 1`))[0]!
      expect((await admin.post(`/api/admin/questions/regroup/${other.id}/undo`)).status).toBe(404)
      expect((await admin.post('/api/admin/questions/regroup/abc/undo')).status).toBe(404)
      expect((await teacher.post('/api/admin/questions/regroup/1/undo')).status).toBe(403)
    })

    it('[CI] a stimulus given alone (a new one) or by id is a valid source; the figure-less regroup keeps every figure question', async () => {
      const a = await served('Soalan pertama yang berkongsi petikan itu. Nombor satu.')
      const b = await served('Soalan kedua yang berkongsi petikan itu. Nombor dua.')
      const created = await admin.post('/api/admin/questions/regroup', { stimulus: { kind: 'passage', label: 'Petikan 1', body: { ms: 'Isi petikan.' } }, memberQuestionIds: [a, b], label: 'Kumpulan petikan' })
      expect(created.status, JSON.stringify(created.body)).toBe(200)
      expect(created.body.data.label).toBe('Kumpulan petikan')
      const c = await served('Soalan ketiga yang berkongsi petikan lain. Nombor tiga.')
      const byId = await admin.post('/api/admin/questions/regroup', { stimulusId: created.body.data.stimuli[0].id, memberQuestionIds: [c] })
      expect(byId.status, JSON.stringify(byId.body)).toBe(200)
      expect(byId.body.data.questionIds).toEqual([c])
      // Undo of the first deletes the stimulus it created only when nothing else uses it (here the second group does).
      const undo = await admin.post(`/api/admin/questions/regroup/${created.body.meta.auditId as string}/undo`)
      expect(undo.status).toBe(200)
      expect(undo.body.data.restored).toBe(2)
      expect((await q(`select 1 from stimuli where id = $1`, [created.body.data.stimuli[0].id])).length).toBe(1)
    })

    it('[CI] errors: unknown member 404, member in another group 409 (memberTaken), mixed subject 422 (memberMixed), bad source 422, figure not figure_only 422, no alt 422, 41 members 422', async () => {
      const a = await served('Soalan dengan subjek Matematik untuk ujian ralat. Satu.')
      const sci = await served('Soalan dengan subjek Sains untuk ujian ralat. Dua.', { subjectId: refs.sciId, tag: await tagOf(t.db, refs.sciId, refs.t4Id) })
      const unknown = await admin.post('/api/admin/questions/regroup', { stimulus: { kind: 'passage', body: { ms: 'x' } }, memberQuestionIds: [a, '987654321'] })
      expect(unknown.status).toBe(404)
      const mixed = await admin.post('/api/admin/questions/regroup', { stimulus: { kind: 'passage', body: { ms: 'x' } }, memberQuestionIds: [a, sci] })
      expect(mixed.status).toBe(422)
      expect(mixed.body.error.fields.memberQuestionIds).toBe(STIMULUS_MESSAGES.memberMixed)
      const grouped = await admin.post('/api/admin/questions/regroup', { stimulus: { kind: 'passage', body: { ms: 'x' } }, memberQuestionIds: [a] })
      expect(grouped.status, JSON.stringify(grouped.body)).toBe(200)
      const taken = await admin.post('/api/admin/questions/regroup', { stimulus: { kind: 'passage', body: { ms: 'x' } }, memberQuestionIds: [a] })
      expect(taken.status).toBe(409)
      expect(taken.body.error.message).toBe(STIMULUS_MESSAGES.memberTaken)
      const none = await admin.post('/api/admin/questions/regroup', { memberQuestionIds: [sci] })
      expect(none.status).toBe(422)
      expect(none.body.error.fields.stimulusId).toBe(STIMULUS_MESSAGES.requestInvalid)
      const two = await admin.post('/api/admin/questions/regroup', { stimulusId: '1', stimulus: { kind: 'passage', body: { ms: 'x' } }, memberQuestionIds: [sci] })
      expect(two.status).toBe(422)
      const plain = await served('Soalan biasa tanpa bendera rajah. Tiga.')
      const m1 = await served('Soalan Matematik untuk ujian ralat. Empat.')
      const m2 = await served('Soalan Matematik untuk ujian ralat. Lima.')
      const notFigure = await admin.post('/api/admin/questions/regroup', { figureQuestionId: plain, memberQuestionIds: [m1], stimulus: { alt: 'x' } })
      expect(notFigure.status).toBe(422)
      expect(notFigure.body.error.fields.figureQuestionId).toBe(STIMULUS_MESSAGES.requestInvalid)
      // A figure whose stimulus is an image needs alt text; none given means 422 on stimulus.alt and nothing changes.
      const img = await stimulus('Rajah 90')
      await q(`update stimuli set kind = 'image', alt_text = null where id = $1`, [img])
      const fig = await figure(img)
      const noAlt = await admin.post('/api/admin/questions/regroup', { figureQuestionId: fig, memberQuestionIds: [m2] })
      expect(noAlt.status, JSON.stringify(noAlt.body)).toBe(422)
      expect(noAlt.body.error.fields['stimulus.alt']).toBe(STIMULUS_MESSAGES.requestInvalid)
      expect((await flagRow(fig)).status).toBe('approved')
      const many = await admin.post('/api/admin/questions/regroup', { stimulusId: img, memberQuestionIds: Array.from({ length: 41 }, (_, i) => String(1000 + i)) })
      expect(many.status).toBe(422)
      expect(many.body.error.fields.memberQuestionIds).toBe(STIMULUS_MESSAGES.membersTooMany)
      expect((await teacher.post('/api/admin/questions/regroup', { stimulusId: img, memberQuestionIds: [a] })).status).toBe(403)
    })

    it('[CI] a figure question placed on a published paper is 409 and nothing changes', async () => {
      const s = await scenario()
      const paper = await one<{ id: string }>(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, published_at) values ('pilihan', 'Kertas regroup', $1, 2, 60, 'published', now()) returning id::text id`, [refs.mathId])
      const section = await one<{ id: string }>(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', 1, 1) returning id::text id`, [paper.id])
      await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, 1)`, [section.id, s.figureId])
      const res = await admin.post('/api/admin/questions/regroup', { figureQuestionId: s.figureId, memberQuestionIds: [s.a, s.b], stimulus: { alt: 'x' } })
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(res.body.error.message).toBe(STIMULUS_MESSAGES.conflict)
      expect((await flagRow(s.figureId)).status).toBe('approved')
      expect((await q(`select 1 from questions where id = $1 and group_id is not null`, [s.a])).length).toBe(0)
    })
  })

  // ------------------------------------------------------------------------------------------------------ API-Q-13 work-list

  describe('GET /api/admin/questions/regroup-worklist (API-Q-13, FR-ADM-G7.5)', () => {
    it('[CI] lists open stimulus_missing / figure_only of live approved questions with the 2.17.4 shape, `reference` and counts', async () => {
      const sci = await tagOf(t.db, refs.sciId, refs.t4Id)
      const m = await served('Rajah 41 menunjukkan satu mesin. Apakah fungsinya? Senarai.')
      const un = await served('Rajah di atas menunjukkan satu mesin lain. Apakah fungsinya? Senarai dua.', { subjectId: refs.sciId, tag: sci })
      const dup = await served('Apakah hasil tambah dua nombor ganjil yang berturutan? Senarai.')
      const dismissed = await served('Rajah 42 menunjukkan satu mesin. Apakah bahagian utamanya? Senarai.')
      await admin.post(`/api/admin/questions/${dismissed}/flags/dismiss`, { flag: 'stimulus_missing' })
      const draft = await admin.post('/api/questions', mcqBody(refs, { questionText: 'Rajah 43 menunjukkan satu mesin. Ini draf sahaja. Senarai.' }))
      const draftId = mutationEnvelopeOf(QuestionSchema).parse(draft.body).data.id

      const res = await admin.get('/api/admin/questions/regroup-worklist?pageSize=100')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const ids = res.body.data.map((r: { questionId: string }) => r.questionId)
      expect(ids).toContain(m)
      expect(ids).toContain(un)
      for (const hidden of [dup, dismissed, draftId]) expect(ids).not.toContain(hidden)
      const row = res.body.data.find((r: { questionId: string }) => r.questionId === m)
      expect(row).toMatchObject({ questionId: m, flag: 'stimulus_missing', reference: 'numbered', numberLabel: null })
      expect(typeof row.stemExcerpt).toBe('string')
      expect(row.stemExcerpt.length).toBeLessThanOrEqual(121)
      expect(row.subject).not.toBe('')
      expect(row.level).not.toBe('')
      expect(Object.keys(row).sort()).toEqual(['flag', 'level', 'numberLabel', 'paper', 'questionId', 'reference', 'stemExcerpt', 'subject'])
      expect(res.body.data.find((r: { questionId: string }) => r.questionId === un).reference).toBe('unnumbered')
      const c = res.body.meta.counts
      expect(res.body.meta.totalItems).toBe(res.body.data.length)
      expect(c.open).toBe(c.byFlag.stimulus_missing + c.byFlag.figure_only)
      expect(c.byFlag.stem_duplicated).toBeGreaterThanOrEqual(1)
      expect(c.done).toBeGreaterThanOrEqual(1)
      expect(c.bySubject[refs.mathId]).toBeGreaterThanOrEqual(1)
      expect(c.bySubject[refs.sciId]).toBeGreaterThanOrEqual(1)
      expect(Object.values(c.byLevel as Record<string, number>).reduce((n, x) => n + x, 0)).toBe(res.body.meta.totalItems)
    })

    it('[CI] filters: subjectId, educationLevelId (and its alias levelId), flag; stem_duplicated only when asked for; paging; 422 on a bad flag', async () => {
      const all = await admin.get('/api/admin/questions/regroup-worklist?pageSize=100')
      const sci = await admin.get(`/api/admin/questions/regroup-worklist?subjectId=${refs.sciId}&pageSize=100`)
      expect(sci.status).toBe(200)
      expect(sci.body.data.length).toBeGreaterThanOrEqual(1)
      expect(sci.body.data.length).toBeLessThan(all.body.data.length)
      expect(sci.body.data.every((r: { subject: string }) => r.subject === sci.body.data[0].subject)).toBe(true)
      const l1 = await admin.get(`/api/admin/questions/regroup-worklist?educationLevelId=${refs.t4Id}&pageSize=100`)
      const l2 = await admin.get(`/api/admin/questions/regroup-worklist?levelId=${refs.t4Id}&pageSize=100`)
      expect(l2.body.data).toEqual(l1.body.data)
      const none = await admin.get(`/api/admin/questions/regroup-worklist?educationLevelId=${refs.t5Id}&subjectId=${refs.sciId}`)
      expect(none.body.data).toEqual([])
      expect(none.body.meta.totalItems).toBe(0)
      const dup = await admin.get('/api/admin/questions/regroup-worklist?flag=stem_duplicated&pageSize=100')
      expect(dup.body.data.length).toBeGreaterThanOrEqual(1)
      expect(dup.body.data.every((r: { flag: string }) => r.flag === 'stem_duplicated')).toBe(true)
      const fo = await admin.get('/api/admin/questions/regroup-worklist?flag=figure_only')
      expect(fo.body.data.every((r: { flag: string }) => r.flag === 'figure_only')).toBe(true)
      const page = await admin.get('/api/admin/questions/regroup-worklist?pageSize=1&page=2')
      expect(page.body.data).toHaveLength(1)
      expect(page.body.meta).toMatchObject({ page: 2, pageSize: 1 })
      expect((await admin.get('/api/admin/questions/regroup-worklist?flag=lain')).status).toBe(422)
    })

    it('[CI] AC-ADM-G7.2: after the regroup the members leave the work-list; after the undo they are back', async () => {
      seq += 1
      const fs = await stimulus('Rajah 50')
      const fig = await figure(fs)
      const a = await served(`Rajah 50 menunjukkan satu dandang ${String(seq)}. Senarai tiga.`)
      const listed = async (id: string) => (await admin.get('/api/admin/questions/regroup-worklist?pageSize=100')).body.data.some((r: { questionId: string }) => r.questionId === id)
      expect(await listed(a)).toBe(true)
      expect(await listed(fig)).toBe(true)
      const done = await admin.post('/api/admin/questions/regroup', { figureQuestionId: fig, memberQuestionIds: [a], stimulus: { alt: 'Dandang' } })
      expect(done.status, JSON.stringify(done.body)).toBe(200)
      expect(await listed(a)).toBe(false)
      expect(await listed(fig)).toBe(false)
      expect((await admin.post(`/api/admin/questions/regroup/${done.body.meta.auditId as string}/undo`)).status).toBe(200)
      expect(await listed(a)).toBe(true)
      expect(await listed(fig)).toBe(true)
    })
  })

  // ------------------------------------------------------------------------------------------------------ AC-ADM-QE2.5

  it('[CI] AC-ADM-QE2.5: removing a member that names "Rajah 3" from its group sets stimulus_missing', async () => {
    const st = await stimulus('Rajah 3')
    const g = await admin.post('/api/stimulus-groups', { stimulusIds: [st], questionIds: [] })
    const gid = mutationEnvelopeOf((await import('@pp/contract')).StimulusGroupDetailSchema).parse(g.body).data.id
    const add = await admin.post(`/api/stimulus-groups/${gid}/questions`, mcqBody(refs, { questionText: 'Rajah 3 menunjukkan satu jadual. Apakah isinya? Anggota.' }))
    expect(add.status, JSON.stringify(add.body)).toBe(201)
    const id = mutationEnvelopeOf(QuestionSchema).parse(add.body).data.id
    expect((await flagRow(id)).stimulus_flag).not.toBe('stimulus_missing')
    expect((await admin.delete(`/api/stimulus-groups/${gid}/members/${id}`)).status).toBe(200)
    expect((await flagRow(id)).stimulus_flag).toBe('stimulus_missing')
  })

  // ------------------------------------------------------------------------------------------------------ API-Q-01 filters

  describe('GET /api/questions filters (API-Q-01, FR-ADM-Q03.8, AC-QA-47)', () => {
    const list = async (qs: string) => {
      const res = await admin.get(`/api/questions?pageSize=100&${qs}`)
      expect(res.status, `${qs} ${JSON.stringify(res.body)}`).toBe(200)
      return res.body as { data: { id: string; flags?: string[] }[]; meta: { totalItems: number } }
    }

    it('[CI] tingkatan (T4 / T5), chapter (none / id) and unit narrow the list; the same keys are accepted by the bulk-by-filter dry run', async () => {
      const t5tag = await tagOf(t.db, refs.mathId, refs.t5Id)
      const t4 = await served('Soalan penapis tingkatan empat. Penapis satu.')
      const t5 = await served('Soalan penapis tingkatan lima. Penapis dua.', { educationLevelId: refs.t5Id, tag: t5tag })
      await q(`update question_versions set chapter_id = null where question_id = $1`, [t4])
      expect((await list('tingkatan=T4')).data.map((r) => r.id)).toContain(t4)
      expect((await list('tingkatan=T4')).data.map((r) => r.id)).not.toContain(t5)
      expect((await list('tingkatan=T5')).data.map((r) => r.id)).toContain(t5)
      expect((await list('chapter=none')).data.map((r) => r.id)).toContain(t4)
      const chapter = await one<{ chapter_id: string }>(`select chapter_id::text chapter_id from question_versions where question_id = $1 and chapter_id is not null limit 1`, [t5]).catch(() => null)
      await q(`update question_versions set chapter_id = $2 where question_id = $1`, [t5, refs.chapterId ?? chapter?.chapter_id ?? null])
      expect((await list('chapter=none')).data.map((r) => r.id)).not.toContain(t5)
      expect((await list(`chapter=${refs.chapterId ?? ''}`)).data.map((r) => r.id)).toContain(t5)
      const unit = await one<{ u: string }>(`select unit_node_id::text u from question_versions where question_id = $1 and version_no = 1`, [t4])
      const byUnit = await list(`unit=${unit.u}`)
      expect(byUnit.data.map((r) => r.id)).toContain(t4)
      const dry = await admin.post('/api/questions/bulk-action/filter', { action: 'archived', filter: { tingkatan: 'T5', chapter: 'none', unit: unit.u, source: 'manual', q: 'x', flag: 'stem_duplicated' }, dryRun: true })
      expect(dry.status, JSON.stringify(dry.body)).toBe(200)
    })

    it('[CI] source: manual, pdf, csv (stored as excel) and guru (created by a teacher)', async () => {
      const a = await served('Soalan sumber manual satu. Sumber.')
      const b = await served('Soalan sumber pdf dua. Sumber.')
      const c = await served('Soalan sumber csv tiga. Sumber.')
      const d = await served('Soalan sumber guru empat. Sumber.')
      await q(`update questions set source_type = 'manual' where id = $1`, [a])
      await q(`update questions set source_type = 'pdf' where id = $1`, [b])
      await q(`update questions set source_type = 'excel' where id = $1`, [c])
      await q(`update questions set source_type = 'manual', created_by_id = $2 where id = $1`, [d, teacher.userId])
      expect((await list('source=pdf')).data.map((r) => r.id)).toEqual(expect.arrayContaining([b]))
      expect((await list('source=pdf')).data.map((r) => r.id)).not.toContain(a)
      expect((await list('source=csv')).data.map((r) => r.id)).toContain(c)
      expect((await list('source=manual')).data.map((r) => r.id)).toEqual(expect.arrayContaining([a, d]))
      const guru = (await list('source=guru')).data.map((r) => r.id)
      expect(guru).toContain(d)
      expect(guru).not.toContain(a)
    })

    it('[CI] AC-QA-47 q: a question id finds the row, text finds the stem, both can be sent with `search`; > 100 characters is 422', async () => {
      const id = await served('Soalan carian id unik zxqv. Carian.')
      const byId = await list(`q=${id}`)
      expect(byId.data.map((r) => r.id)).toContain(id)
      expect((await list('q=zxqv')).data.map((r) => r.id)).toEqual([id])
      expect((await list('q=zxqv&search=tidakwujud')).data).toEqual([])
      const long = await admin.get(`/api/questions?q=${'a'.repeat(101)}`)
      expect(long.status).toBe(422)
      expect(long.body.error.fields.q).toBe('Carian tidak boleh melebihi 100 aksara.')
    })

    it('[CI] flag filters the OPEN flag of the listed version, every row shows `flags[]`, a dismissed flag is no longer open', async () => {
      const miss = await served('Rajah 61 menunjukkan satu motor. Apakah jenisnya? Bendera.')
      const dup = await served('Apakah hasil tambah tiga nombor genap yang berturutan? Bendera.')
      const fig = await figure(await stimulus('Rajah 62'))
      expect((await list('flag=stimulus_missing')).data.map((r) => r.id)).toContain(miss)
      expect((await list('flag=stem_duplicated')).data.map((r) => r.id)).toContain(dup)
      expect((await list('flag=figure_only')).data.map((r) => r.id)).toContain(fig)
      expect((await list('flag=figure_only')).data.map((r) => r.id)).not.toContain(miss)
      const row = (await list('flag=stimulus_missing')).data.find((r) => r.id === miss)!
      expect(row.flags).toEqual(['stimulus_missing'])
      await admin.post(`/api/admin/questions/${miss}/flags/dismiss`, { flag: 'stimulus_missing' })
      expect((await list('flag=stimulus_missing')).data.map((r) => r.id)).not.toContain(miss)
      const after = (await list(`q=${miss}`)).data.find((r) => r.id === miss)!
      expect(after.flags).toEqual([])
      const detail = await admin.get(`/api/questions/${miss}`)
      expect(detail.status).toBe(200)
      expect(detail.body.data.flags).toEqual([])
    })

    it('[CI] AC-ADM-QE3.14 scope note: a bad value of any new filter is 422 "Nilai penapis tidak sah."', async () => {
      for (const qs of ['tingkatan=T9', 'chapter=abc', 'source=lain', 'flag=lain']) {
        const res = await admin.get(`/api/questions?${qs}`)
        expect(res.status, qs).toBe(422)
        expect(Object.values(res.body.error.fields as Record<string, string>)[0], qs).toBe(QUESTION_MESSAGES.filterInvalid)
      }
    })
  })
})
