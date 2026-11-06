import { BIJAK_BUILDER_MESSAGES as M, BijakBuilderEditorSchema, QUESTION_MESSAGES } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { textPdf } from '../intake-files/pdf-fixtures'
import { bootFullApp, DEMO_PASSWORD, type FullApp, type FullClient, loginFull } from '../r1/full-app'
import { giveBab } from '../support/bab'
import { ACCOUNTS } from './helpers'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * S3-T06 API-BIJAK-14: `POST /api/admin/papers/:id/source`. Multipart (`paper`, `scheme`, `declaration`) makes the intake batch of THIS Kertas Subjektif
 * (202 `{batchId}`); JSON `{ apply: true }` appends the accepted items of that batch as placements of the same paper (201 `{placements}`).
 */
describe('S3-T06 Kertas Subjektif source PDF (API-BIJAK-14)', () => {
  let t: FullApp
  let admin: FullClient
  let agent: TestAgent
  let csrf: string
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const one = async (sql: string) => String((await q(sql))[0]!.id)
  // The intake refuses a file whose hash was already imported, so every upload gets its own bytes.
  let seq = 0
  const pdf = (): Buffer => textPdf(1, 3 + ++seq)

  async function approve(ids: string[]): Promise<void> {
    await giveBab(t.db, ids)
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toMatchObject({ affected: ids.length, failed: [] })
    }
  }
  const mcq = (text: string) => ({ subjectId: subject, educationLevelId: level, difficultyLevel: 3, questionType: 'mcq', questionText: text, options: ['4', '5', '6', '7'], correctAnswer: 1, cognitiveLevel: 'mengaplikasi', kertas: '2', tag })
  async function question(text = 'Berapakah hasil tambah 2 dan 3?'): Promise<string> {
    const res = await admin.post('/api/questions', mcq(text))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    await approve([res.body.data.id as string])
    return res.body.data.id as string
  }
  async function paperOf(over: Record<string, unknown> = {}): Promise<string> {
    const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2, surface: 'subjektif', title: 'Percubaan Sumber', examBoard: 'Selangor', year: 2024, totalMarks: 3, ...over })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const upload = (id: string, fields: { paper?: Buffer | null; scheme?: Buffer; declaration?: string; paperName?: string } = {}) => {
    let r = agent.post(`/api/admin/papers/${id}/source`).set('X-CSRF-Token', csrf)
    if (fields.paper !== null) r = r.attach('paper', fields.paper ?? pdf(), { filename: fields.paperName ?? 'kertas.pdf', contentType: 'application/pdf' })
    if (fields.scheme) r = r.attach('scheme', fields.scheme, { filename: 'skema.pdf', contentType: 'application/pdf' })
    if (fields.declaration !== undefined) r = r.field('declaration', fields.declaration)
    return r
  }
  const apply = (id: string) => admin.post(`/api/admin/papers/${id}/source`, { apply: true })
  /** An intake item of the paper's batch, as a reviewer left it. */
  async function item(batch: string, position: number, state: string, questionId: string | null): Promise<void> {
    await q(
      `insert into intake_items (batch_id, position, item_type, payload, review_state, reject_reason, question_id, question_version_no) values ($1, $2, 'mcq', '{}'::jsonb, $3, $4, $5, $6)`,
      [batch, position, state, state === 'rejected' ? 'bukan untuk kertas ini' : null, questionId, questionId ? 1 : null],
    )
    await ready(batch)
  }
  /** The extraction has finished: apply refuses a batch that is still processing. */
  const ready = (batch: string) => q(`update intake_batches set status = 'ready_for_review' where id = $1`, [batch])
  const batchOf = async (paper: string) => String((await q(`select source_batch_id from papers where id = $1`, [paper]))[0]!.source_batch_id)
  const placed = async (paper: string) =>
    (await q(`select s.label, pl.question_id::text qid from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1 order by s.position, pl.position`, [paper])).map((r) => `${String(r.label)}:${String(r.qid)}`)

  beforeAll(async () => {
    t = await bootFullApp()
    admin = await loginFull(t, ACCOUNTS.admin)
    agent = request.agent(t.app.getHttpServer()) as unknown as TestAgent
    const login = await agent.post('/api/auth/login').send({ identifier: ACCOUNTS.admin, password: DEMO_PASSWORD, remember: false })
    expect(login.status).toBe(200)
    csrf = login.body.data.csrf as string
    subject = await one(`select id::text id from subjects where code = 'MATH'`)
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }
  })
  afterAll(async () => {
    await t.close()
  })

  describe('upload', () => {
    it('creates the intake batch for this paper (admin source, trial, third party, declared) and links it; 202 {batchId}', async () => {
      const id = await paperOf()
      const res = await upload(id, { declaration: 'true', scheme: pdf() })
      expect(res.status, JSON.stringify(res.body)).toBe(202)
      const batch = res.body.data.batchId as string
      expect(await batchOf(id)).toBe(batch)
      const row = (await q(`select paper_type, subject, kertas, year, source_text, rights_status, status from intake_batches where id = $1`, [batch]))[0]!
      expect(row).toMatchObject({ paper_type: 'trial', subject: 'MAT', kertas: 2, year: 2024, source_text: 'Muat naik Admin Pusat: Selangor 2024', rights_status: 'third_party' })
      expect((await q(`select count(*)::int n from intake_files where batch_id = $1`, [batch]))[0]!.n).toBe(2)
      // the batch payload names the paper
      const detail = await admin.get(`/api/intake/batches/${batch}`)
      expect(detail.body.data.targetPaperId).toBe(id)
    })

    it('422: not a PDF (name or content), no paper part, too large, no declaration', async () => {
      const id = await paperOf()
      const before = (await q(`select count(*)::int n from intake_batches`))[0]!.n
      const cases: [string, () => ReturnType<typeof upload>, string][] = [
        ['wrong extension', () => upload(id, { declaration: 'true', paperName: 'kertas.docx' }), M.sourcePdfInvalid],
        ['wrong content', () => upload(id, { declaration: 'true', paper: Buffer.from('bukan pdf') }), M.sourcePdfInvalid],
        ['wrong scheme content', () => upload(id, { declaration: 'true', scheme: Buffer.from('bukan pdf') }), M.sourcePdfInvalid],
        ['no paper part', () => upload(id, { declaration: 'true', paper: null }), M.sourcePdfInvalid],
        ['over 30 MB', () => upload(id, { declaration: 'true', paper: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(31 * 1024 * 1024)]) }), M.sourcePdfTooLarge],
        ['scheme over 30 MB', () => upload(id, { declaration: 'true', scheme: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(31 * 1024 * 1024)]) }), M.sourcePdfTooLarge],
        ['no declaration', () => upload(id), M.declarationRequired],
        ['declaration not true', () => upload(id, { declaration: 'false' }), M.declarationRequired],
      ]
      for (const [name, req, message] of cases) {
        const res = await req()
        expect(res.status, `${name}: ${JSON.stringify(res.body)}`).toBe(422)
        expect(JSON.stringify(res.body), name).toContain(message)
        if (name === 'scheme over 30 MB') expect(res.body.error.fields).toEqual({ scheme: M.sourcePdfTooLarge })
        if (name === 'over 30 MB') expect(res.body.error.fields).toEqual({ paper: M.sourcePdfTooLarge })
      }
      // the declaration is reported before the file
      const both = await upload(id, { paper: Buffer.from('bukan pdf') })
      expect(both.body.error.fields).toEqual({ declaration: M.declarationRequired })
      expect((await q(`select count(*)::int n from intake_batches`))[0]!.n).toBe(before)
      expect(await q(`select source_batch_id from papers where id = $1`, [id])).toEqual([{ source_batch_id: null }])
    })

    it('422 on a Simulasi paper, 404 on an unknown paper, 403 without CSRF', async () => {
      const sim = (await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2, title: 'Set simulasi' })).body.data.id as string
      const res = await upload(sim, { declaration: 'true' })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect((await upload('999999999', { declaration: 'true' })).status).toBe(404)
      const id = await paperOf()
      const noCsrf = await agent.post(`/api/admin/papers/${id}/source`).attach('paper', pdf(), { filename: 'kertas.pdf', contentType: 'application/pdf' }).field('declaration', 'true')
      expect(noCsrf.status).toBe(403)
    })

    it('409 on a Terbit paper (withdraw first) and 409 when the paper already has a source batch', async () => {
      const id = await paperOf()
      expect((await upload(id, { declaration: 'true' })).status).toBe(202)
      const again = await upload(id, { declaration: 'true' })
      expect(again.status, JSON.stringify(again.body)).toBe(409)
      expect(JSON.stringify(again.body)).toContain(M.sourceBatchExists)
      const pub = await paperOf({ title: 'Terbit dahulu' })
      await q(`update papers set status = 'published', published_at = now() where id = $1`, [pub])
      const res = await upload(pub, { declaration: 'true' })
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(JSON.stringify(res.body)).toContain(M.paperPublishedWithdrawFirst)
    })
  })

  describe('apply', () => {
    it('422 sourceBatchMissing when the paper has no source batch', async () => {
      const id = await paperOf()
      const res = await apply(id)
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(JSON.stringify(res.body)).toContain(M.sourceBatchMissing)
    })

    it('422 on a bad body and on a Simulasi paper', async () => {
      const id = await paperOf()
      expect((await admin.post(`/api/admin/papers/${id}/source`, { apply: false })).status).toBe(422)
      const sim = (await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2, title: 'Set simulasi' })).body.data.id as string
      expect((await apply(sim)).status).toBe(422)
    })

    it('409 itemsUndecided with {n} while an item is open, and nothing is written', async () => {
      const id = await paperOf()
      const batch = String((await upload(id, { declaration: 'true' })).body.data.batchId)
      await item(batch, 1, 'accepted', await question('Soalan terbuka satu'))
      await item(batch, 2, 'needs_review', null)
      await item(batch, 3, 'duplicate', null)
      await item(batch, 4, 'rejected', null)
      const res = await apply(id)
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(JSON.stringify(res.body)).toContain(M.itemsUndecided.replace('{n}', '2'))
      expect(await placed(id)).toEqual([])
    })

    it('409 on a Terbit paper', async () => {
      const id = await paperOf()
      await upload(id, { declaration: 'true' })
      await q(`update papers set status = 'published', published_at = now() where id = $1`, [id])
      const res = await apply(id)
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(JSON.stringify(res.body)).toContain(M.paperPublishedWithdrawFirst)
    })

    it('201: appends the accepted questions in printed order into Bahagian A, skips rejected, and a re-call adds only the new ones', async () => {
      const id = await paperOf({ title: 'Terap', totalMarks: 3 })
      const batch = String((await upload(id, { declaration: 'true' })).body.data.batchId)
      const [a, b, c] = [await question('Susunan satu'), await question('Susunan dua'), await question('Susunan tiga')]
      await item(batch, 1, 'accepted', b)
      await item(batch, 2, 'rejected', null)
      await item(batch, 3, 'accepted', a)
      const first = await apply(id)
      expect(first.status, JSON.stringify(first.body)).toBe(201)
      expect(first.body.data).toEqual({ placements: 2 })
      expect(await placed(id)).toEqual([`Bahagian A:${b}`, `Bahagian A:${a}`])
      expect((await q(`select count(*)::int n from paper_sections where paper_id = $1`, [id]))[0]!.n).toBe(1)
      // nothing new: 0, nothing moved
      const again = await apply(id)
      expect(again.status).toBe(201)
      expect(again.body.data).toEqual({ placements: 0 })
      expect(await placed(id)).toEqual([`Bahagian A:${b}`, `Bahagian A:${a}`])
      // a later accept is appended after the existing ones; the earlier order is never touched
      await item(batch, 4, 'accepted', c)
      const third = await apply(id)
      expect(third.body.data).toEqual({ placements: 1 })
      expect(await placed(id)).toEqual([`Bahagian A:${b}`, `Bahagian A:${a}`, `Bahagian A:${c}`])
      const editor = BijakBuilderEditorSchema.parse((await admin.get(`/api/admin/papers/${id}`)).body.data)
      expect(editor.paper.sections[0]!.questionIds).toEqual([b, a, c])
    })

    it('409 with the item id and nothing written when an accepted item has no question any more', async () => {
      const id = await paperOf()
      const batch = String((await upload(id, { declaration: 'true' })).body.data.batchId)
      await item(batch, 1, 'accepted', await question('Ada soalan'))
      // a question row with no version: the bank does not know it (an accepted item always keeps a question id, ck_intake_items_accepted_question)
      const stub = String((await q(`insert into questions (source_type, latest_version_no, is_active) values ('manual', 1, false) returning id`))[0]!.id)
      await item(batch, 2, 'accepted', stub)
      const missingId = await one(`select id::text id from intake_items where batch_id = ${batch} and question_id = ${stub}`)
      const res = await apply(id)
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(JSON.stringify(res.body)).toContain(M.sourceItemQuestionMissing.replace('{id}', missingId))
      expect(await placed(id)).toEqual([])
    })

    it('409 while the source batch is processing or after it was cancelled', async () => {
      const id = await paperOf()
      const batch = String((await upload(id, { declaration: 'true' })).body.data.batchId)
      await item(batch, 1, 'accepted', await question('Kelompok belum siap'))
      for (const status of ['processing', 'cancelled']) {
        await q(`update intake_batches set status = $1 where id = $2`, [status, batch])
        const res = await apply(id)
        expect(res.status, `${status}: ${JSON.stringify(res.body)}`).toBe(409)
        expect(JSON.stringify(res.body)).toContain(M.sourceBatchNotReady)
      }
      expect(await placed(id)).toEqual([])
    })

    it('reuses the existing section with the same label (trimmed, case-insensitive) and adds it when the paper has none', async () => {
      const id = await paperOf()
      await q(`update paper_sections set label = ' bahagian a ' where paper_id = $1`, [id])
      const batch = String((await upload(id, { declaration: 'true' })).body.data.batchId)
      await item(batch, 1, 'accepted', await question('Bahagian guna semula'))
      expect((await apply(id)).body.data).toEqual({ placements: 1 })
      expect((await q(`select count(*)::int n from paper_sections where paper_id = $1`, [id]))[0]!.n).toBe(1)

      const other = await paperOf({ title: 'Tanpa bahagian' })
      await q(`update paper_sections set label = 'Bahagian Z' where paper_id = $1`, [other])
      const b2 = String((await upload(other, { declaration: 'true' })).body.data.batchId)
      await item(b2, 1, 'accepted', await question('Bahagian baharu'))
      expect((await apply(other)).body.data).toEqual({ placements: 1 })
      expect((await q(`select label from paper_sections where paper_id = $1 order by position`, [other])).map((r) => r.label)).toEqual(['Bahagian Z', 'Bahagian A'])
    })

    describe('stimulus groups', () => {
      async function group(): Promise<{ members: string[] }> {
        const stim = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan sumber', body: { ms: 'Petikan ujian untuk kertas sumber.' } })
        expect(stim.status, JSON.stringify(stim.body)).toBe(201)
        const ids: string[] = []
        for (const text of ['Ahli kumpulan satu', 'Ahli kumpulan dua']) {
          const r = await admin.post('/api/questions', mcq(text))
          expect(r.status, JSON.stringify(r.body)).toBe(201)
          ids.push(r.body.data.id as string)
        }
        const g = await admin.post('/api/stimulus-groups', { label: 'Petikan sumber', stimulusIds: [stim.body.data.id], questionIds: ids })
        expect(g.status, JSON.stringify(g.body)).toBe(201)
        await approve(ids)
        return { members: ids }
      }

      it('places a whole group contiguously, in published order, at the position of its first item', async () => {
        const { members } = await group()
        const lone = await question('Soalan sendiri sumber')
        const id = await paperOf()
        const batch = String((await upload(id, { declaration: 'true' })).body.data.batchId)
        await item(batch, 1, 'accepted', members[1]!)
        await item(batch, 2, 'accepted', lone)
        await item(batch, 3, 'accepted', members[0]!)
        const res = await apply(id)
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        expect(res.body.data).toEqual({ placements: 3 })
        expect(await placed(id)).toEqual([`Bahagian A:${members[0]}`, `Bahagian A:${members[1]}`, `Bahagian A:${lone}`])
      })

      it('a rejected member is not placed and does not block: the accepted members are placed contiguously, in published order', async () => {
        const { members } = await group()
        const extra = (await admin.post('/api/questions', mcq('Ahli kumpulan tiga'))).body.data.id as string
        const stim = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan tiga', body: { ms: 'Petikan tiga ahli.' } })
        const g3 = await admin.post('/api/stimulus-groups', { label: 'Petikan tiga', stimulusIds: [stim.body.data.id], questionIds: [extra] })
        expect(g3.status, JSON.stringify(g3.body)).toBe(201)
        await approve([extra])
        const id = await paperOf()
        const batch = String((await upload(id, { declaration: 'true' })).body.data.batchId)
        await item(batch, 1, 'accepted', members[1]!)
        await item(batch, 2, 'rejected', null)
        const res = await apply(id)
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        expect(res.body.data).toEqual({ placements: 1 })
        expect(await placed(id)).toEqual([`Bahagian A:${members[1]}`])
      })

      it('a group with no accepted member is not placed', async () => {
        await group()
        const lone = await question('Sendiri selain kumpulan')
        const id = await paperOf()
        const batch = String((await upload(id, { declaration: 'true' })).body.data.batchId)
        await item(batch, 1, 'rejected', null)
        await item(batch, 2, 'rejected', null)
        await item(batch, 3, 'accepted', lone)
        expect((await apply(id)).body.data).toEqual({ placements: 1 })
        expect(await placed(id)).toEqual([`Bahagian A:${lone}`])
      })

      it('a member already placed in ANY Bahagian counts as placed: 422 when its group mate would land in another Bahagian; never added twice', async () => {
        const { members } = await group()
        const id = await paperOf()
        const batch = String((await upload(id, { declaration: 'true' })).body.data.batchId)
        await q(`insert into paper_sections (paper_id, position, label, rule_type, question_count, mark_budget, compulsory, admin_created) values ($1, 2, 'Bahagian B', 'all', 0, 0, false, true)`, [id])
        const secB = await one(`select id::text id from paper_sections where paper_id = ${id} and label = 'Bahagian B'`)
        await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, 1)`, [secB, members[0]])
        await item(batch, 1, 'accepted', members[0]!)
        await item(batch, 2, 'accepted', members[1]!)
        const res = await apply(id)
        expect(res.status, JSON.stringify(res.body)).toBe(422)
        expect(res.body.error.fields.items).toBe(QUESTION_MESSAGES.groupSplit)
        expect(await placed(id)).toEqual([`Bahagian B:${members[0]}`])
        // a plain question placed in another Bahagian is not added a second time
        const lone = await question('Sudah ada di Bahagian B')
        const id2 = await paperOf({ title: 'Dua bahagian' })
        const b2 = String((await upload(id2, { declaration: 'true' })).body.data.batchId)
        const sec2 = await one(`select id::text id from paper_sections where paper_id = ${id2}`)
        await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, 1)`, [sec2, lone])
        await item(b2, 1, 'accepted', lone)
        expect((await apply(id2)).body.data).toEqual({ placements: 0 })
        expect(await placed(id2)).toEqual([`Bahagian A:${lone}`])
      })
    })
  })
})
