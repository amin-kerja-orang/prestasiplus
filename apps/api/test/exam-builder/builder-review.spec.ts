import { BIJAK_BUILDER_MESSAGES as MSG } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { makePng } from '../files/fixtures'
import { bootFullApp, loginFull, type FullApp, type FullClient } from '../r1/full-app'
import { ACCOUNTS, auditRows, expectError } from './helpers'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * R1-T34: section-pool tags (G3), per-row servability in the review (B09a), the audited blueprint override at Terbit (B09a) and the
 * paper-review edits (B09b: Bahagian, petikan title, reference assets) with the read-only guard after Terbit. Real BE-09 bank, real
 * ServabilityService; HTTP only except where a legacy data defect is made on purpose (SQL).
 */
describe('R1-T34 builder review: pools, servability rows, override, paper edits', () => {
  let t: FullApp
  let admin: FullClient
  let student: FullClient
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const one = async (sql: string) => String((await q(sql))[0]!.id)

  async function mk(over: Record<string, unknown> = {}): Promise<string> {
    const res = await admin.post('/api/questions', {
      subjectId: subject,
      educationLevelId: level,
      difficultyLevel: 3,
      questionType: 'mcq',
      questionText: 'Berapakah hasil tambah 2 dan 3?',
      options: ['4', '5', '6', '7'],
      correctAnswer: 1,
      kertas: '2',
      tag,
      ...over,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  async function approve(ids: string[]): Promise<void> {
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
    }
  }
  const approved = async (over: Record<string, unknown> = {}): Promise<string> => {
    const id = await mk(over)
    await approve([id])
    return id
  }
  const setPool = (id: string, pools: string[]) => admin.put(`/api/admin/section-pools/${id}`, { pools })
  const newPaper = async (): Promise<string> => {
    const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const sectionsOf = async (id: string): Promise<string[]> => ((await admin.get(`/api/admin/papers/${id}`)).body.data.paper.sections as { id: string }[]).map((s) => s.id)
  const place = (paper: string, sectionId: string, questionId: string) => admin.post(`/api/admin/papers/${paper}/placements`, { sectionId, questionId })
  /** A full MAT kertas 2 paper: A 3 questions, B 1, C 2 (as the PoC blueprint); every question is tagged with its section pool. */
  async function fullPaper(opts: { tagged?: boolean } = {}): Promise<{ paper: string; ids: string[]; sections: string[] }> {
    const ids = [await approved(), await approved(), await approved(), await approved(), await approved({ pointsValue: 2 }), await approved({ pointsValue: 2 })]
    if (opts.tagged !== false) {
      for (const [i, id] of ids.entries()) expect((await setPool(id, [i < 3 ? 'MAT2-A' : i === 3 ? 'MAT2-B' : 'MAT2-C'])).status).toBe(200)
    }
    const paper = await newPaper()
    const sections = await sectionsOf(paper)
    const at = [0, 0, 0, 1, 2, 2]
    for (const [i, id] of ids.entries()) expect((await place(paper, sections[at[i]!]!, id)).status).toBe(201)
    return { paper, ids, sections }
  }

  beforeAll(async () => {
    t = await bootFullApp()
    admin = await loginFull(t, ACCOUNTS.admin)
    student = await loginFull(t, ACCOUNTS.student)
    subject = await one(`select id::text id from subjects where code = 'MATH'`)
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }
  })
  afterAll(async () => {
    await t.close()
  })

  describe('G3: section pools of a question', () => {
    it('lists the pools of the active MAT blueprints and the pools on the question', async () => {
      const id = await approved()
      const res = await admin.get(`/api/admin/section-pools/${id}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toMatchObject({ questionId: id, subject: 'MAT', pools: [] })
      const pools = (res.body.data.options as { pool: string; kertas: number; sectionLabel: string }[]).map((o) => o.pool)
      expect(pools).toEqual(expect.arrayContaining(['MAT1-A', 'MAT2-A', 'MAT2-B', 'MAT2-C']))
      expect(res.body.data.options.find((o: { pool: string }) => o.pool === 'MAT2-A')).toMatchObject({ kertas: 2, sectionLabel: 'Bahagian A', blueprintCode: '1449/2' })
    })

    it('sets, replaces and clears the pools; the legacy spm tag and other tags are never touched; the change is audited', async () => {
      const id = await approved()
      await q(`insert into question_tags (question_id, kind, code) values ($1, 'pool', 'spm')`, [id])
      const set = await setPool(id, ['MAT2-A', 'MAT2-A', 'MAT1-A'])
      expect(set.status, JSON.stringify(set.body)).toBe(200)
      expect(set.body.data.pools).toEqual(['MAT1-A', 'MAT2-A'])
      expect((await setPool(id, ['MAT2-B'])).body.data.pools).toEqual(['MAT2-B'])
      const codes = (await q(`select code from question_tags where question_id = $1 and kind = 'pool' order by code`, [id])).map((r) => r.code)
      expect(codes).toEqual(['MAT2-B', 'spm'])
      expect((await setPool(id, [])).body.data.pools).toEqual([])
      expect((await q(`select code from question_tags where question_id = $1 and kind = 'pool'`, [id])).map((r) => r.code)).toEqual(['spm'])
      const audit = (await auditRows(t.db, 'bijak.question.pool_updated')).filter((r) => r.target_id === id)
      expect(audit).toHaveLength(3)
      expect(audit[0]!.detail).toMatchObject({ pools: ['MAT2-A', 'MAT1-A'] })
    })

    it('refuses an unknown pool (fields.pools), a pool of another subject, an unknown question and a bad body', async () => {
      const id = await approved()
      for (const pools of [['NOPE-X'], ['SN2-A'], ['mat2-a']]) {
        const res = await setPool(id, pools)
        expect(res.status, JSON.stringify(pools)).toBe(422)
        expect(res.body.error.fields.pools).toBe(MSG.poolInvalid)
      }
      expect((await admin.put(`/api/admin/section-pools/${id}`, { pools: 'MAT2-A' })).status).toBe(422)
      expect((await admin.put(`/api/admin/section-pools/${id}`, { pools: [], extra: 1 })).status).toBe(422)
      expect((await q(`select count(*)::int n from question_tags where question_id = $1 and kind = 'pool'`, [id]))[0]!.n).toBe(0)
      expectError(await setPool('987654321', ['MAT2-A']), 'NOT_FOUND', 404, MSG.poolQuestionNotFound)
      expectError(await admin.get('/api/admin/section-pools/abc'), 'NOT_FOUND', 404)
    })

    it('needs the admin role and the CSRF header', async () => {
      const id = await approved()
      expect((await student.put(`/api/admin/section-pools/${id}`, { pools: ['MAT2-A'] })).status).toBe(403)
      expect((await student.get(`/api/admin/section-pools/${id}`)).status).toBe(403)
      expect((await admin.noCsrf('put', `/api/admin/section-pools/${id}`, { pools: ['MAT2-A'] })).status).toBe(403)
    })

    it('once tagged, Terbit no longer reports "bukan dalam kolam bahagian ini"; untagged it does, as a note', async () => {
      const untagged = await fullPaper({ tagged: false })
      const before = (await admin.get(`/api/admin/papers/${untagged.paper}/review`)).body.data
      expect(before.ok).toBe(true)
      expect((before.notes as string[]).some((n) => n.includes('bukan dalam kolam bahagian ini'))).toBe(true)

      const tagged = await fullPaper()
      const review = (await admin.get(`/api/admin/papers/${tagged.paper}/review`)).body.data
      expect((review.notes as string[]).some((n) => n.includes('bukan dalam kolam bahagian ini'))).toBe(false)
      const pub = await admin.post(`/api/admin/papers/${tagged.paper}/publish`)
      expect(pub.status, JSON.stringify(pub.body)).toBe(200)
      expect(pub.body.data.ok).toBe(true)
      expect((pub.body.data.notes ?? []).some((n: string) => n.includes('bukan dalam kolam bahagian ini'))).toBe(false)
    })
  })

  describe('B09a: per-row servability in the review', () => {
    it('each row carries "Dilihat murid di n daripada 6"; a question archived after placement is a row that says why', async () => {
      const { paper, ids } = await fullPaper()
      const rows = (await admin.get(`/api/admin/papers/${paper}/review`)).body.data.rows as { questionId: string; ok: boolean; reason?: string; reasons?: { code: string; message: string }[]; seenIn?: { served: number; total: number } }[]
      expect(rows).toHaveLength(6)
      expect(rows.every((r) => r.ok && r.seenIn?.total === 6 && r.seenIn.served >= 1)).toBe(true)

      const archived = await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [ids[0]] })
      expect(archived.status, JSON.stringify(archived.body)).toBe(200)
      const after = (await admin.get(`/api/admin/papers/${paper}/review`)).body.data.rows as typeof rows
      const row = after.find((r) => r.questionId === ids[0])!
      expect(row.ok).toBe(false)
      expect(row.reason).toMatch(/^Tidak disajikan: /)
      expect(row.reasons?.[0]).toMatchObject({ code: 'archived' })
      expect(after.filter((r) => r.ok)).toHaveLength(5)
    })
  })

  describe('B09a: audited override at Terbit', () => {
    /** A legacy question: approved, but without a DSKP unit (a structural blocker of the blueprint). */
    async function paperWithLegacyBlocker() {
      const made = await fullPaper()
      await q(`update question_versions set unit_node_id = null where question_id = $1`, [made.ids[0]])
      return made
    }

    it('is refused without override: the structural line blocks and nothing is published', async () => {
      const { paper, ids } = await paperWithLegacyBlocker()
      const res = await admin.post(`/api/admin/papers/${paper}/publish`)
      expect(res.status).toBe(200)
      expect(res.body.data.ok).toBe(false)
      expect(res.body.data.errors.some((e: string) => e.includes(`Soalan ${ids[0]} tidak layak`))).toBe(true)
      expect((await q(`select status from papers where id = $1`, [paper]))[0]?.status).toBe('draft')
    })

    it('override needs a reason (422 on fields.reason) and an admin; a bad body is 422', async () => {
      const { paper } = await paperWithLegacyBlocker()
      const noReason = await admin.post(`/api/admin/papers/${paper}/publish`, { override: true })
      expect(noReason.status, JSON.stringify(noReason.body)).toBe(422)
      expect(noReason.body.error.fields.reason).toBe(MSG.overrideReasonRequired)
      expect((await admin.post(`/api/admin/papers/${paper}/publish`, { override: true, reason: 'x' })).status).toBe(422)
      expect((await admin.post(`/api/admin/papers/${paper}/publish`, { override: 'yes', reason: 'sebab yang sah' })).status).toBe(422)
      expect((await student.post(`/api/admin/papers/${paper}/publish`, { override: true, reason: 'sebab yang sah' })).status).toBe(403)
      expect((await q(`select status from papers where id = $1`, [paper]))[0]?.status).toBe('draft')
    })

    it('with a reason it publishes, lists the overridden lines and writes the audit row; the pupil then sees the paper', async () => {
      const { paper, ids } = await paperWithLegacyBlocker()
      const res = await admin.post(`/api/admin/papers/${paper}/publish`, { override: true, reason: 'Soalan lama menunggu tag DSKP' })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toMatchObject({ ok: true, errors: [] })
      expect((res.body.data.overridden as string[]).some((l) => l.includes(`Soalan ${ids[0]} tidak layak`))).toBe(true)
      expect((await q(`select status from papers where id = $1`, [paper]))[0]?.status).toBe('published')
      const audit = (await auditRows(t.db, 'bijak.paper.published_override')).filter((r) => r.target_id === paper)
      expect(audit).toHaveLength(1)
      expect(audit[0]!.detail).toMatchObject({ reason: 'Soalan lama menunggu tag DSKP', count: 1 })
      expect(((await student.get('/api/bijak/papers')).body.data as { id: string }[]).some((p) => p.id === paper)).toBe(true)
    })

    it('never overrides a question or structure error: an unfinished paper stays ok false even with a reason', async () => {
      const paper = await newPaper()
      const [a] = await sectionsOf(paper)
      expect((await place(paper, a!, await approved())).status).toBe(201)
      const res = await admin.post(`/api/admin/papers/${paper}/publish`, { override: true, reason: 'sebab yang sah' })
      expect(res.status).toBe(200)
      expect(res.body.data.ok).toBe(false)
      expect(res.body.data.errors.some((e: string) => e.includes('Kurang'))).toBe(true)
      expect(res.body.data.overridden).toBeUndefined()
      expect((await q(`select status from papers where id = $1`, [paper]))[0]?.status).toBe('draft')
    })

    it('an override sent for a paper without blockers is a plain Terbit (no override audit row)', async () => {
      const { paper } = await fullPaper()
      const res = await admin.post(`/api/admin/papers/${paper}/publish`, { override: true, reason: 'tidak diperlukan' })
      expect(res.body.data).toMatchObject({ ok: true, errors: [] })
      expect(res.body.data.overridden).toBeUndefined()
      expect((await auditRows(t.db, 'bijak.paper.published_override')).filter((r) => r.target_id === paper)).toHaveLength(0)
    })
  })

  describe('B09b: paper-review edits and the read-only guard', () => {
    it('Sunting bahagian: renames a section, sets its instruction and compulsory flag; clearing the instruction restores the derived line', async () => {
      const paper = await newPaper()
      const [a, b] = await sectionsOf(paper)
      const edit = await admin.put(`/api/admin/papers/${paper}`, { sections: [{ id: a, label: 'Bahagian Satu', instruction: 'Jawab semua soalan dengan teliti.', compulsory: true }, { id: b, label: '  Bahagian Dua  ' }] })
      expect(edit.status, JSON.stringify(edit.body)).toBe(200)
      const sections = edit.body.data.paper.sections as { id: string; label: string; instruction?: string; compulsory?: boolean }[]
      expect(sections[0]).toMatchObject({ label: 'Bahagian Satu', instruction: 'Jawab semua soalan dengan teliti.', compulsory: true })
      expect(sections[1]!.label).toBe('Bahagian Dua')
      const cleared = await admin.put(`/api/admin/papers/${paper}`, { sections: [{ id: a, instruction: null }] })
      expect(cleared.body.data.paper.sections[0].instruction).toBeUndefined()
      expect(cleared.body.data.paper.sections[0].label).toBe('Bahagian Satu')
      // a section edit without questionIds leaves the placements alone
      const id = await approved()
      expect((await place(paper, a!, id)).status).toBe(201)
      const again = await admin.put(`/api/admin/papers/${paper}`, { sections: [{ id: a, label: 'Bahagian Satu A' }] })
      expect(again.body.data.paper.sections[0].questionIds).toEqual([id])
      expect((await admin.put(`/api/admin/papers/${paper}`, { sections: [{ id: a, label: '   ' }] })).status).toBe(422)
      expect((await admin.put(`/api/admin/papers/${paper}`, { sections: [{ id: '987654321', label: 'X' }] })).status).toBe(422)
    })

    it('Bahan rujukan: replaces the reference panels; an image must be a stored question image', async () => {
      const paper = await newPaper()
      const up = await admin.upload('/api/files?purpose=question_image', makePng())
      expect(up.status, JSON.stringify(up.body)).toBe(201)
      const token = up.body.data.id as string
      const ok = await admin.put(`/api/admin/papers/${paper}`, { reference: [{ title: 'Rumus', items: ['$a^2 + b^2 = c^2$'] }, { title: 'Jadual nombor', items: [], imageFileId: token }] })
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)
      expect(ok.body.data.paper.reference).toEqual([{ title: 'Rumus', items: ['$a^2 + b^2 = c^2$'] }, { title: 'Jadual nombor', items: [], imageFileId: token }])
      const view = (await admin.get(`/api/admin/papers/${paper}/student-view`)).body.data
      expect(view.reference).toHaveLength(2)
      const bad = await admin.put(`/api/admin/papers/${paper}`, { reference: [{ title: 'X', items: [], imageFileId: 'bukan-fail-sebenar' }] })
      expect(bad.status).toBe(422)
      expect(bad.body.error.fields.reference).toBe(MSG.referenceImageInvalid)
      expect((await admin.put(`/api/admin/papers/${paper}`, { reference: Array.from({ length: 11 }, () => ({ title: 'P', items: [] })) })).status).toBe(422)
      expect((await admin.put(`/api/admin/papers/${paper}`, { reference: [] })).body.data.paper.reference ?? []).toEqual([])
    })

    it('Sunting petikan: renames the group title; the group must be on the paper', async () => {
      const stim = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan lama', body: { ms: 'Petikan ujian untuk kertas.' } })
      expect(stim.status, JSON.stringify(stim.body)).toBe(201)
      const members = [await approved(), await approved()]
      const group = await admin.post('/api/stimulus-groups', { label: 'Petikan lama', stimulusIds: [stim.body.data.id], questionIds: members })
      expect(group.status, JSON.stringify(group.body)).toBe(201)
      const groupId = group.body.data.id as string
      const paper = await newPaper()
      const [a] = await sectionsOf(paper)
      // not on the paper yet
      const early = await admin.put(`/api/admin/papers/${paper}/groups/${groupId}`, { label: 'Petikan baharu' })
      expect(early.status).toBe(422)
      expect(early.body.error.message).toBe(MSG.groupNotOnPaper)
      expect((await place(paper, a!, members[0]!)).status).toBe(201)
      const res = await admin.put(`/api/admin/papers/${paper}/groups/${groupId}`, { label: 'Petikan baharu' })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.groups.find((g: { id: string }) => g.id === groupId)).toBeDefined()
      expect((await admin.get(`/api/stimulus-groups/${groupId}`)).body.data.label).toBe('Petikan baharu')
      expect((await admin.put(`/api/admin/papers/${paper}/groups/${groupId}`, { label: '   ' })).status).toBe(422)
      expect((await student.put(`/api/admin/papers/${paper}/groups/${groupId}`, { label: 'X' })).status).toBe(403)
    })

    it('add / delete an extra question: one beyond the Kontrak blocks Terbit; deleting it clears the blocker', async () => {
      const { paper, ids, sections } = await fullPaper()
      const extra = await approved()
      expect((await place(paper, sections[0]!, extra)).status).toBe(201)
      const blocked = (await admin.get(`/api/admin/papers/${paper}/review`)).body.data
      expect(blocked.ok).toBe(false)
      expect(blocked.blockers.some((b: string) => b.includes('Lebih 1 soalan'))).toBe(true)
      const removed = await admin.del(`/api/admin/papers/${paper}/placements/${extra}`)
      expect(removed.status, JSON.stringify(removed.body)).toBe(200)
      expect(removed.body.data.removed).toEqual([extra])
      expect((await admin.get(`/api/admin/papers/${paper}/review`)).body.data.ok).toBe(true)
      expect(ids).toHaveLength(6)
    })

    it('after Terbit every edit is refused (read-only) until the paper is withdrawn; Salin set starts a new draft', async () => {
      const { paper, ids, sections } = await fullPaper()
      expect((await admin.post(`/api/admin/papers/${paper}/publish`)).body.data.ok).toBe(true)
      const locked = [
        await admin.put(`/api/admin/papers/${paper}`, { title: 'Tajuk baharu' }),
        await admin.put(`/api/admin/papers/${paper}`, { sections: [{ id: sections[0], label: 'Lain' }] }),
        await admin.put(`/api/admin/papers/${paper}`, { reference: [{ title: 'P', items: [] }] }),
        await admin.put(`/api/admin/papers/${paper}/groups/1`, { label: 'Lain' }),
        await place(paper, sections[0]!, await approved()),
        await admin.del(`/api/admin/papers/${paper}/placements/${ids[0]}`),
      ]
      for (const res of locked) {
        expect(res.status, JSON.stringify(res.body)).toBe(422)
        expect(res.body.error.message).toBe(MSG.paperLocked)
      }
      const copy = await admin.post(`/api/admin/papers/${paper}/copy`)
      expect(copy.status, JSON.stringify(copy.body)).toBe(201)
      const draft = await admin.get(`/api/admin/papers/${copy.body.data.id as string}`)
      expect(draft.body.data.paper).toMatchObject({ status: 'draf' })
      expect((await admin.put(`/api/admin/papers/${copy.body.data.id as string}`, { title: 'Salinan disunting' })).status).toBe(200)
      expect((await admin.post(`/api/admin/papers/${paper}/withdraw`)).status).toBe(200)
      expect((await admin.put(`/api/admin/papers/${paper}`, { title: 'Disunting semula' })).status).toBe(200)
    })
  })

  describe('R1-T31: the builder wire carries the whole stimulus group (D90)', () => {
    interface Wire {
      id: string
      kind: string
      label: string
      caption?: string
      source?: string
      text?: string
      table?: { head: string[]; rows: string[][] }
      image?: { url: string }
    }
    const stim = async (body: Record<string, unknown>): Promise<string> => {
      const res = await admin.post('/api/stimuli', body)
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      return res.body.data.id as string
    }
    const picture = async (): Promise<string> => {
      const up = await admin.upload('/api/files?purpose=question_image', makePng())
      expect(up.status, JSON.stringify(up.body)).toBe(201)
      return up.body.data.id as string
    }
    async function group(label: string, stimulusIds: string[]): Promise<{ id: string; members: string[] }> {
      const members = [await mk({ questionText: `Merujuk ${label}, berapakah nilai soalan satu?` }), await mk({ questionText: `Merujuk ${label}, berapakah nilai soalan dua?` })]
      const res = await admin.post('/api/stimulus-groups', { label, stimulusIds, questionIds: members })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      await approve(members)
      for (const id of members) expect((await setPool(id, ['MAT2-A'])).status).toBe(200)
      return { id: res.body.data.id as string, members }
    }

    it('editor groups, pool units, student view and the preview send stimuli[] (1 to 3, once per group) with kind, caption, source, table and a file token URL', async () => {
      const token = await picture()
      const image = await stim({ kind: 'image', label: 'Rajah 1', caption: 'Segi empat tepat', alt: 'Rajah segi empat tepat', sourceCitation: 'Sumber: buku teks', imageFileId: token })
      const table = await stim({ kind: 'table', label: 'Jadual 1', caption: 'Jualan', tableData: { head: ['Bulan', 'Jumlah'], rows: [['Jan', '10'], ['Feb', '12']] } })
      const passage = await stim({ kind: 'passage', label: 'Petikan 1', body: { ms: 'Sebuah kebun berbentuk segi empat tepat.' } })
      const g = await group('Rajah 1', [image, table, passage])

      const paper = await newPaper()
      const [a] = await sectionsOf(paper)
      expect((await place(paper, a!, g.members[1]!)).status).toBe(201)

      const check = (list: Wire[]) => {
        expect(list.map((x) => x.kind)).toEqual(['image', 'table', 'passage'])
        expect(list[0]).toMatchObject({ label: 'Rajah 1', caption: 'Segi empat tepat', source: 'Sumber: buku teks', image: { url: `/api/files/${token}` } })
        expect(list[1]).toMatchObject({ kind: 'table', caption: 'Jualan', table: { head: ['Bulan', 'Jumlah'], rows: [['Jan', '10'], ['Feb', '12']] } })
        expect(list[1]!.text).toBeUndefined()
        expect(list[2]).toMatchObject({ text: 'Sebuah kebun berbentuk segi empat tepat.' })
        expect(JSON.stringify(list)).not.toMatch(/asset|fileId/i)
      }

      // editor (paper view): groups
      const editor = (await admin.get(`/api/admin/papers/${paper}`)).body.data
      const grp = (editor.groups as { id: string; stimulus: Wire; stimuli?: Wire[]; questionIds: string[] }[]).find((x) => x.id === g.id)!
      expect(grp.questionIds).toEqual(g.members)
      check(grp.stimuli!)
      expect(grp.stimulus).toEqual(grp.stimuli![0])

      // student view: the stimuli once per group, both members under it
      const view = (await admin.get(`/api/admin/papers/${paper}/student-view`)).body.data
      const units = view.sections[0].units as { groupId?: string; stimulus?: Wire; stimuli?: Wire[]; questions: { id: string }[] }[]
      const unit = units.find((u) => u.groupId === g.id)!
      check(unit.stimuli!)
      expect(unit.stimulus).toEqual(unit.stimuli![0])
      expect(unit.questions.map((x) => x.id)).toEqual(g.members)
      expect(units.filter((u) => u.groupId === g.id)).toHaveLength(1)

      // the picture is readable by the admin through the token URL (and by no anonymous caller)
      expect((await admin.get(unit.stimuli![0]!.image!.url)).status).toBe(200)

      // section pool (another paper, nothing placed yet): the group is ONE unit with its stimuli
      const fresh = await newPaper()
      const [fa] = await sectionsOf(fresh)
      const pool = await admin.get(`/api/admin/papers/${fresh}/sections/${fa!}/pool?pageSize=100`)
      expect(pool.status, JSON.stringify(pool.body)).toBe(200)
      const poolUnit = (pool.body.data as { groupId?: string; stimuli?: Wire[]; questionIds: string[] }[]).find((u) => u.groupId === g.id)!
      expect(poolUnit.questionIds).toEqual(g.members)
      check(poolUnit.stimuli!)

      // admin preview (review content): all stimuli of the group, keyed by group id
      const preview = await admin.post('/api/admin/papers/preview', { ids: g.members })
      expect(preview.status, JSON.stringify(preview.body)).toBe(200)
      check(preview.body.data.groupStimuli[g.id])
      expect(preview.body.data.stimuli[g.id]).toEqual(preview.body.data.groupStimuli[g.id][0])
    })

    it('carries all seven kinds unchanged: image, diagram, map, infographic, graph with their pictures, table and passage', async () => {
      const kinds: [string, Record<string, unknown>][] = []
      for (const kind of ['diagram', 'map', 'graph']) kinds.push([kind, { kind, label: `Gambar ${kind}`, alt: `Huraian ${kind}`, imageFileId: await picture() }])
      const ids = await Promise.all(kinds.map(([, body]) => stim(body)))
      const g = await group('Kumpulan gambar', ids)
      const infographic = await group('Infografik', [await stim({ kind: 'infographic', label: 'Infografik 1', alt: 'Huraian infografik', imageFileId: await picture() })])
      const preview = await admin.post('/api/admin/papers/preview', { ids: [...g.members, ...infographic.members] })
      const list = preview.body.data.groupStimuli[g.id] as Wire[]
      expect(list.map((x) => x.kind)).toEqual(['diagram', 'map', 'graph'])
      expect(list.every((x) => x.image?.url.startsWith('/api/files/'))).toBe(true)
      expect(preview.body.data.groupStimuli[infographic.id][0]).toMatchObject({ kind: 'infographic', label: 'Infografik 1' })
    })
  })
})
