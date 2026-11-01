import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { giveBab } from '../support/bab'
import { serveSeededBlueprints } from '../support/serve-blueprints'
import { bootFullApp, loginFull, type FullApp, type FullClient } from '../r1/full-app'
import { ACCOUNTS } from './helpers'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * D90 builder group-integrity sweep (lane A3). D90: a shared image or passage is ONE group, shown once with all its questions; it is never a
 * standalone question and carries no marks; in the builder a group moves as a unit. These specs close the paths that the older specs
 * (builder-placements, builder-api, builder-parity) leave open, on the real bank and the real servability rules: HTTP only.
 */
describe('D90 builder sweep: a stimulus group is one unit on every builder path', () => {
  let t: FullApp
  let admin: FullClient
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
      cognitiveLevel: 'mengaplikasi',
      tag,
      ...over,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  async function approve(ids: string[]): Promise<void> {
    await giveBab(t.db, ids)
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.failed, `${action}: ${JSON.stringify(res.body.data)}`).toEqual([])
    }
  }
  const approved = async (): Promise<string> => {
    const id = await mk()
    await approve([id])
    return id
  }
  /** A real stimulus group of `n` approved members (a passage stimulus), members in the order made. */
  async function group(n = 2): Promise<{ groupId: string; members: string[] }> {
    const stim = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan ujian', caption: 'Kapsyen', body: { ms: 'Petikan ujian untuk kertas.' } })
    expect(stim.status, JSON.stringify(stim.body)).toBe(201)
    const members: string[] = []
    for (let i = 0; i < n; i++) members.push(await mk())
    const made = await admin.post('/api/stimulus-groups', { label: 'Petikan ujian', stimulusIds: [stim.body.data.id], questionIds: members })
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    await approve(members)
    return { groupId: made.body.data.id as string, members }
  }
  const newPaper = async (): Promise<string> => {
    const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const editorOf = async (paper: string) => (await admin.get(`/api/admin/papers/${paper}`)).body.data
  const sectionsOf = async (paper: string): Promise<string[]> => ((await editorOf(paper)).paper.sections as { id: string }[]).map((s) => s.id)
  const idsIn = async (paper: string, section: string): Promise<string[]> => ((await editorOf(paper)).paper.sections as { id: string; questionIds: string[] }[]).find((s) => s.id === section)!.questionIds
  const place = (paper: string, sectionId: string, questionId: string) => admin.post(`/api/admin/papers/${paper}/placements`, { sectionId, questionId })
  const put = (paper: string, sections: Record<string, unknown>[]) => admin.put(`/api/admin/papers/${paper}`, { sections })
  const addSection = async (paper: string, label: string): Promise<string> => {
    const res = await admin.post(`/api/admin/papers/${paper}/sections`, { label })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const all = res.body.data.paper.sections as { id: string }[]
    return all[all.length - 1]!.id
  }
  const reviewOf = async (paper: string) => (await admin.get(`/api/admin/papers/${paper}/review`)).body.data as { ok: boolean; blockerDetails: { code: string; message: string; overridable: boolean }[] }

  beforeAll(async () => {
    t = await bootFullApp()
    await serveSeededBlueprints(t.db)
    admin = await loginFull(t, ACCOUNTS.admin)
    subject = await one(`select id::text id from subjects where code = 'MATH'`)
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }
  })
  afterAll(async () => {
    await t.close()
  })

  const pinsOf = async (paper: string): Promise<Record<string, number>> =>
    Object.fromEntries((await q(`select pl.question_id::text id, pl.pinned_version_no n from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`, [paper])).map((r) => [String(r.id), Number(r.n)]))

  describe('move between Bahagian and reorder (PUT paper sections, the bulk path)', () => {
    it('naming ONE member in another Bahagian moves the whole group there, in group order; the old Bahagian keeps its other questions', async () => {
      const [a, b] = [await approved(), await approved()]
      const g = await group(2)
      const paper = await newPaper()
      const [secA, secB] = await sectionsOf(paper)
      expect((await put(paper, [{ id: secA, questionIds: [a, g.members[0]!, b] }])).status).toBe(200)
      expect(await idsIn(paper, secA!)).toEqual([a, g.members[0], g.members[1], b])
      // move: A without the group, B names the SECOND member only
      const moved = await put(paper, [
        { id: secA, questionIds: [a, b] },
        { id: secB, questionIds: [g.members[1]!] },
      ])
      expect(moved.status, JSON.stringify(moved.body)).toBe(200)
      expect(await idsIn(paper, secA!)).toEqual([a, b])
      expect(await idsIn(paper, secB!)).toEqual([g.members[0], g.members[1]])
      // the group is still one group in the editor, once
      const groups = (await editorOf(paper)).groups as { id: string; questionIds: string[] }[]
      expect(groups.filter((x) => x.id === g.groupId)).toHaveLength(1)
      expect(groups.find((x) => x.id === g.groupId)!.questionIds).toEqual(g.members)
    })

    it('adding a member to another Bahagian while the group stays in the first is refused (a group lives in ONE Bahagian); nothing changes', async () => {
      const g = await group(2)
      const paper = await newPaper()
      const [secA, secB] = await sectionsOf(paper)
      expect((await place(paper, secA!, g.members[0]!)).status).toBe(201)
      // only B is patched: A still holds the group, so the member would be on the paper twice
      const res = await put(paper, [{ id: secB, questionIds: [g.members[1]!] }])
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(await idsIn(paper, secA!)).toEqual(g.members)
      expect(await idsIn(paper, secB!)).toEqual([])
      // the same refusal when one request lists the group in both Bahagian
      const both = await put(paper, [{ id: secA, questionIds: g.members }, { id: secB, questionIds: [g.members[0]!] }])
      expect(both.status, JSON.stringify(both.body)).toBe(422)
      expect(await idsIn(paper, secA!)).toEqual(g.members)
    })

    it('a PUT that lists the members apart, out of order and after other questions still leaves the group whole, contiguous and in published order', async () => {
      const [a, b] = [await approved(), await approved()]
      const g = await group(3)
      const paper = await newPaper()
      const [secA] = await sectionsOf(paper)
      const res = await put(paper, [{ id: secA, questionIds: [g.members[2]!, a, g.members[0]!, b, g.members[1]!] }])
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      // the group sits at the position of the first member the request named, expanded in published order
      expect(await idsIn(paper, secA!)).toEqual([g.members[0], g.members[1], g.members[2], a, b])
    })
  })

  describe('"Tambah soalan" and "Padam soalan" next to a group', () => {
    it('Tambah soalan appends a SOLO question after the group: it never joins the group, the group stays whole and contiguous', async () => {
      const paper = await newPaper()
      const d = await addSection(paper, 'Bahagian D')
      const g = await group(2)
      expect((await place(paper, d, g.members[1]!)).status).toBe(201)
      const added = await admin.post(`/api/admin/papers/${paper}/sections/${d}/questions`, { number: '21', mode: 'mcq', marks: 2 })
      expect(added.status, JSON.stringify(added.body)).toBe(201)
      const id = (added.body.data.added as string[])[0]!
      expect(await idsIn(paper, d)).toEqual([g.members[0], g.members[1], id])
      expect((await q(`select group_id from questions where id = $1`, [id]))[0]!.group_id).toBeNull()
      const groups = (added.body.data.editor.groups as { id: string; questionIds: string[] }[]).filter((x) => x.id === g.groupId)
      expect(groups).toHaveLength(1)
      expect(groups[0]!.questionIds).toEqual(g.members)
      // placing a group AFTER a Tambah soalan question also appends it whole
      const g2 = await group(2)
      expect((await place(paper, d, g2.members[0]!)).status).toBe(201)
      expect(await idsIn(paper, d)).toEqual([g.members[0], g.members[1], id, g2.members[0], g2.members[1]])
    })

    it('Padam soalan on a member of a group placed from the bank is refused (not an added question); the group stays whole', async () => {
      const paper = await newPaper()
      const d = await addSection(paper, 'Bahagian D')
      const g = await group(2)
      expect((await place(paper, d, g.members[0]!)).status).toBe(201)
      for (const member of g.members) {
        const res = await admin.del(`/api/admin/papers/${paper}/questions/${member}`)
        expect(res.status, JSON.stringify(res.body)).toBe(422)
        expect(res.body.error.message).toBe(`Soalan ${member} bukan soalan tambahan kertas ini`)
      }
      expect(await idsIn(paper, d)).toEqual(g.members)
      // the group's own route still removes the whole group (D90)
      const removed = await admin.del(`/api/admin/papers/${paper}/placements/${g.members[1]}`)
      expect(removed.body.data.removed).toEqual(g.members)
    })

    it('Padam soalan on an added question that was grouped in the Studio afterwards removes only that member: the survivor is a one-member group and D93 blocks Terbit (hard)', async () => {
      const paper = await newPaper()
      const d = await addSection(paper, 'Bahagian D')
      const added = await admin.post(`/api/admin/papers/${paper}/sections/${d}/questions`, { number: '21', mode: 'mcq', marks: 2 })
      const x = (added.body.data.added as string[])[0]!
      const y = await mk()
      const stim = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan dua', body: { ms: 'Petikan dua.' } })
      const made = await admin.post('/api/stimulus-groups', { label: 'Petikan dua', stimulusIds: [stim.body.data.id], questionIds: [x, y] })
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      // the group is on the paper whole (a PUT expands it), with the number label kept
      expect((await put(paper, [{ id: d, questionIds: [x] }])).status).toBe(200)
      expect(await idsIn(paper, d)).toEqual([x, y])
      expect((await reviewOf(paper)).blockerDetails.map((b) => b.code)).not.toContain('GROUP_MIN_MEMBERS')
      const del = await admin.del(`/api/admin/papers/${paper}/questions/${x}`)
      expect(del.status, JSON.stringify(del.body)).toBe(200)
      expect(del.body.data.removed).toEqual([x])
      // current behaviour: Padam soalan removes the one question, not the group unit (removePlacement is the unit route)
      expect(await idsIn(paper, d)).toEqual([y])
      expect((await q(`select count(*)::int n from questions where group_id = $1`, [made.body.data.id]))[0]!.n).toBe(1)
      // the safety net: D93, a paper-level hard blocker the override cannot lift
      const review = await reviewOf(paper)
      expect(review.blockerDetails).toContainEqual({ code: 'GROUP_MIN_MEMBERS', message: 'Kumpulan perlu sekurang-kurangnya 2 soalan.', overridable: false })
      const forced = await admin.post(`/api/admin/papers/${paper}/publish`, { override: true, reason: 'sebab yang sah untuk ujian' })
      expect(forced.body.data).toMatchObject({ ok: false, canOverride: false })
      expect((await q(`select status from papers where id = $1`, [paper]))[0]!.status).toBe('draft')
    })
  })

  describe('Salin set (copy) with a group', () => {
    it('copies the group whole, contiguous and in order, with every member pinned to the version in force (a newer Draf version is not pinned)', async () => {
      const a = await approved()
      const g = await group(3)
      const paper = await newPaper()
      const [secA] = await sectionsOf(paper)
      expect((await place(paper, secA!, a)).status).toBe(201)
      expect((await place(paper, secA!, g.members[1]!)).status).toBe(201)
      expect(await idsIn(paper, secA!)).toEqual([a, ...g.members])
      // a member is edited after it was placed: a new Draf version 2, version 1 stays the one in force
      const body = { subjectId: subject, educationLevelId: level, difficultyLevel: 3, questionType: 'mcq', questionText: 'Soalan disunting selepas diletakkan?', options: ['4', '5', '6', '7'], correctAnswer: 1, kertas: '2', cognitiveLevel: 'mengaplikasi', tag }
      expect((await admin.put(`/api/questions/${g.members[2]}`, body)).status).toBe(200)
      expect((await q(`select max(version_no)::int n from question_versions where question_id = $1`, [g.members[2]]))[0]!.n).toBe(2)
      const res = await admin.post(`/api/admin/papers/${paper}/copy`)
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const copy = res.body.data.id as string
      const [copyA] = await sectionsOf(copy)
      expect(await idsIn(copy, copyA!)).toEqual([a, ...g.members])
      // the editor lists the group once, with all its members (it also lists the groups of the picker's candidates: filter to this one)
      const groups = ((await editorOf(copy)).groups as { id: string; questionIds: string[] }[]).filter((x) => x.id === g.groupId)
      expect(groups).toHaveLength(1)
      expect(groups[0]!.questionIds).toEqual(g.members)
      expect(await pinsOf(copy)).toEqual(Object.fromEntries([a, ...g.members].map((id) => [id, 1])))
      expect(await pinsOf(copy)).toEqual(await pinsOf(paper))
      // the position column is dense and in the same order as the source
      const pos = (id: string) => q(`select pl.question_id::text qid from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1 and s.position = 1 order by pl.position`, [id])
      expect(await pos(copy)).toEqual(await pos(paper))
    })
  })

  describe('candidate search (the pool text search)', () => {
    it('a text hit on ONE member offers the whole group as ONE unit; a hit on both members does not offer it twice', async () => {
      const lone = await mk({ questionText: 'Zebrakuda tunggal unik soalan' })
      const first = await mk({ questionText: 'Harimau bertompok soalan pertama kumpulan' })
      const second = await mk({ questionText: 'Gajah berbelang soalan kedua kumpulan' })
      const stim = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan haiwan', body: { ms: 'Petikan tentang haiwan.' } })
      const made = await admin.post('/api/stimulus-groups', { label: 'Petikan haiwan', stimulusIds: [stim.body.data.id], questionIds: [first, second] })
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      await approve([lone, first, second])
      const paper = await newPaper()
      const [secA] = await sectionsOf(paper)
      const search = async (text: string) => {
        const res = await admin.get(`/api/admin/papers/${paper}/sections/${secA}/pool?pageSize=100&q=${encodeURIComponent(text)}`)
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        return res.body.data as { groupId?: string; questionIds: string[]; stimulus?: unknown; questions: { id: string }[] }[]
      }
      // the word is in the SECOND member only: the unit is the whole group, with the stimulus once
      const hitOne = await search('gajah')
      expect(hitOne).toHaveLength(1)
      expect(hitOne[0]).toMatchObject({ groupId: made.body.data.id, questionIds: [first, second] })
      expect(hitOne[0]!.stimulus).toBeDefined()
      expect(hitOne[0]!.questions.map((x) => x.id)).toEqual([first, second])
      // the word is in BOTH members: still one unit
      const hitBoth = await search('kumpulan')
      expect(hitBoth).toHaveLength(1)
      expect(hitBoth[0]!.questionIds).toEqual([first, second])
      // a solo question stays solo and a miss offers nothing
      expect((await search('zebrakuda')).map((u) => u.questionIds)).toEqual([[lone]])
      expect(await search('tiada padanan sama sekali')).toEqual([])
    })
  })

  describe('section pool tags', () => {
    it('a group is offered as ONE unit; tagging only one member leaves the unit with a reason, tagging both clears it', async () => {
      const g = await group(2)
      const paper = await newPaper()
      const [secA] = await sectionsOf(paper)
      const pool = async () => {
        const res = await admin.get(`/api/admin/papers/${paper}/sections/${secA}/pool?pageSize=100`)
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        return (res.body.data as { groupId?: string; questionIds: string[]; eligible: boolean; reasons: string[] }[]).filter((u) => u.questionIds.some((id) => g.members.includes(id)))
      }
      expect((await admin.put(`/api/admin/section-pools/${g.members[0]}`, { pools: ['MAT2-A'] })).status).toBe(200)
      const half = await pool()
      expect(half).toHaveLength(1)
      expect(half[0]).toMatchObject({ groupId: g.groupId, questionIds: g.members })
      expect(half[0]).toMatchObject({ eligible: false, reasons: ['bukan dalam kolam bahagian ini'] })
      expect((await admin.put(`/api/admin/section-pools/${g.members[1]}`, { pools: ['MAT2-A'] })).status).toBe(200)
      const full = await pool()
      expect(full).toHaveLength(1)
      expect(full[0]).toMatchObject({ groupId: g.groupId, questionIds: g.members, eligible: true, reasons: [] })
    })
  })
})
