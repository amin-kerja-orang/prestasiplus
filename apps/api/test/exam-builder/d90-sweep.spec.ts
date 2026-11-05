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
 *
 * MUTATIONS (what was changed, and which test went red):
 * (S = builder.service.ts, C = paper-check.ts, Q = question-bank.source.ts; every mutation is ONE edit, restored afterwards; the other tests stayed green.
 *  Re-run: apply the edit, run this file, `git checkout` the source file.)
 *  1. S `update`: `normalizeUnits(patch.questionIds, ...)` -> `[...patch.questionIds]`                         -> "naming ONE member ...", "a PUT that lists the members apart ...", "Padam soalan on an added question that was grouped ..."
 *  2. S `update`: the `repeated` group-member refusal disabled                                                -> "adding a member to another Bahagian while the group stays in the first ..."
 *  3. C `normalizeUnits`: the expanded group members reversed                                                 -> the same three tests as 1
 *  4. S `createQuestion`: the new question is placed BEFORE the existing placements                           -> "Tambah soalan appends a SOLO question after the group ..."
 *  5. S `deleteAddedQuestion`: the `notAdded` refusal removed                                                 -> "Padam soalan on a member of a group placed from the bank is refused ..."
 *  6. C `checkPaperDetailed`: the D93 `GROUP_MIN_MEMBERS` line removed                                        -> "Padam soalan on an added question that was grouped ... D93 blocks Terbit"
 *  7. S `deleteAddedQuestion`: `rest` emptied (Padam soalan unplaces every other question)                    -> the same test as 6
 *  8. S `copy`: every pin forced to 99                                                                         -> "copies the group whole in the SOURCE order ... version IN FORCE ..."
 *  9. S `copy`: the last placement dropped                                                                     -> the same test as 8
 * 10. S `copy`: the placements sorted by question id (the solo was made BEFORE the group, placed AFTER it)     -> the same test as 8
 * 11. S `copy`: the SOURCE pin kept instead of the version in force (member 2 has an approved v2)              -> the same test as 8
 * 12. Q `describe`: `latestVersionNo` before `liveVersionNo` (the Draf v3 would be pinned)                     -> the same test as 8
 * 13. S `sectionPool`: eligibility read from the FIRST member only                                            -> "a group is offered as ONE unit; tagging only the FIRST or only the LAST member ..." (last-only case)
 * 14. S `sectionPool`: eligibility read from the LAST member only                                             -> the same test as 13 (first-only case)
 * 15. S `sectionPool` (fallback text search): `some` -> `every` over the group's members                      -> "a text hit on ONE member offers the whole group as ONE unit ..."
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
  async function group(n = 2, text?: string): Promise<{ groupId: string; members: string[] }> {
    const stim = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan ujian', caption: 'Kapsyen', body: { ms: 'Petikan ujian untuk kertas.' } })
    expect(stim.status, JSON.stringify(stim.body)).toBe(201)
    const members: string[] = []
    // `text` makes the members findable by the pool text filter, so a test can scope the pool to its own fixtures on the shared database
    for (let i = 0; i < n; i++) members.push(await mk(text === undefined ? {} : { questionText: `${text} soalan ${String(i + 1)}` }))
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
      // the new question did not join the group: the group's rows in the bank are still exactly its two members, in order
      expect((await q(`select id::text id from questions where group_id = $1 order by group_position`, [g.groupId])).map((r) => r.id)).toEqual(g.members)
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

    it('Padam soalan on an added question that was grouped in the Studio afterwards removes only that member: the survivor is a one-member group, which is valid (S1-T01)', async () => {
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
      // S1-T01: a one-member group is a valid group, so no GROUP_MIN_MEMBERS blocker
      expect((await reviewOf(paper)).blockerDetails.map((b) => b.code)).not.toContain('GROUP_MIN_MEMBERS')
    })
  })

  describe('Salin set (copy) with a group', () => {
    it('copies the group whole in the SOURCE order (a solo placed after the group stays after it) and pins every question to the version IN FORCE, not the source pin and not the latest Draf', async () => {
      // the solo is made BEFORE the group (lower ids) and placed AFTER it: an id-sorted copy would put it first
      const solo = await approved()
      const g = await group(3)
      const paper = await newPaper()
      const [secA] = await sectionsOf(paper)
      expect((await place(paper, secA!, g.members[1]!)).status).toBe(201)
      expect((await place(paper, secA!, solo)).status).toBe(201)
      expect(await idsIn(paper, secA!)).toEqual([...g.members, solo])
      expect(Number(solo)).toBeLessThan(Number(g.members[0]))
      expect(await pinsOf(paper)).toEqual(Object.fromEntries([...g.members, solo].map((x) => [x, 1])))
      // after placing: member 2 gets a NEW approved version 2 (version in force), then a newer Draf version 3 (latest, not in force)
      const edit = (text: string) =>
        admin.put(`/api/questions/${g.members[1]}`, { subjectId: subject, educationLevelId: level, difficultyLevel: 3, questionType: 'mcq', questionText: text, options: ['4', '5', '6', '7'], correctAnswer: 1, kertas: '2', cognitiveLevel: 'mengaplikasi', tag })
      expect((await edit('Soalan disunting: versi dua')).status).toBe(200)
      // S1-T01: a bulk list holds a whole group or none of it, so the whole group is approved (the other members are already approved: no-ops)
      await approve(g.members)
      expect((await q(`select live_version_no::int n from questions where id = $1`, [g.members[1]]))[0]!.n).toBe(2)
      expect((await edit('Soalan disunting: versi tiga (draf)')).status).toBe(200)
      expect(await q(`select live_version_no::int live, latest_version_no::int latest from questions where id = $1`, [g.members[1]])).toEqual([{ live: 2, latest: 3 }])
      const res = await admin.post(`/api/admin/papers/${paper}/copy`)
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const copy = res.body.data.id as string
      const [copyA] = await sectionsOf(copy)
      // order follows the source: the group whole and contiguous, then the solo
      expect(await idsIn(copy, copyA!)).toEqual([...g.members, solo])
      // the editor lists the group once, with all its members (it also lists the groups of the picker's candidates: filter to this one)
      const groups = ((await editorOf(copy)).groups as { id: string; questionIds: string[] }[]).filter((x) => x.id === g.groupId)
      expect(groups).toHaveLength(1)
      expect(groups[0]!.questionIds).toEqual(g.members)
      // pins: the copy pins the version in force (member 2 -> 2); everything else is still version 1. The source keeps its own pins.
      expect(await pinsOf(copy)).toEqual({ [g.members[0]!]: 1, [g.members[1]!]: 2, [g.members[2]!]: 1, [solo]: 1 })
      expect(await pinsOf(paper)).toEqual(Object.fromEntries([...g.members, solo].map((x) => [x, 1])))
      // the position column is dense and in the same order as the source
      const pos = (id: string) => q(`select pl.question_id::text qid from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1 and s.position = 1 order by pl.position`, [id])
      expect(await pos(copy)).toEqual(await pos(paper))
    })
  })

  describe('candidate search (the pool text search)', () => {
    it('a text hit on ONE member offers the whole group as ONE unit; a hit on both members does not offer it twice', async () => {
      // every search term carries a token unique to this run, so the pool is scoped to this test's own fixtures on the shared database
      const tok = `kmp${String(Date.now())}`
      const lone = await mk({ questionText: `Zebrakuda${tok} tunggal unik soalan` })
      const first = await mk({ questionText: `Harimau${tok} bertompok soalan pertama kelompok${tok}` })
      const second = await mk({ questionText: `Gajah${tok} berbelang soalan kedua kelompok${tok}` })
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
      const hitOne = await search(`gajah${tok}`)
      expect(hitOne).toHaveLength(1)
      expect(hitOne[0]).toMatchObject({ groupId: made.body.data.id, questionIds: [first, second] })
      expect(hitOne[0]!.stimulus).toBeDefined()
      expect(hitOne[0]!.questions.map((x) => x.id)).toEqual([first, second])
      // the word is in BOTH members: still one unit
      const hitBoth = await search(`kelompok${tok}`)
      expect(hitBoth).toHaveLength(1)
      expect(hitBoth[0]!.questionIds).toEqual([first, second])
      // a solo question stays solo and a miss offers nothing
      expect((await search(`zebrakuda${tok}`)).map((u) => u.questionIds)).toEqual([[lone]])
      expect(await search(`tiada padanan sama sekali ${tok}`)).toEqual([])
    })
  })

  describe('section pool tags', () => {
    it('a group is offered as ONE unit; tagging only the FIRST or only the LAST member leaves the unit with a reason, tagging every member clears it', async () => {
      const tok = `plt${String(Date.now())}`
      const g = await group(3, tok) // members are findable by `tok`, so the pool listing below is scoped to this test's own group
      const paper = await newPaper()
      const [secA] = await sectionsOf(paper)
      const pool = async () => {
        const res = await admin.get(`/api/admin/papers/${paper}/sections/${secA}/pool?pageSize=100&q=${encodeURIComponent(tok)}`)
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        return res.body.data as { groupId?: string; questionIds: string[]; eligible: boolean; reasons: string[] }[]
      }
      const tag = async (member: string, pools: string[]) => expect((await admin.put(`/api/admin/section-pools/${member}`, { pools })).status).toBe(200)
      const [first, middle, last] = g.members as [string, string, string]
      const expectOneUnit = async (eligible: boolean) => {
        const units = await pool()
        expect(units).toHaveLength(1)
        expect(units[0]).toMatchObject({ groupId: g.groupId, questionIds: g.members, eligible, reasons: eligible ? [] : ['bukan dalam kolam bahagian ini'] })
      }
      await tag(first, ['MAT2-A'])
      await expectOneUnit(false) // only the first member
      await tag(first, [])
      await tag(last, ['MAT2-A'])
      await expectOneUnit(false) // only the last member
      await tag(middle, ['MAT2-A'])
      await expectOneUnit(false) // the last and the middle, not the first
      await tag(first, ['MAT2-A'])
      await expectOneUnit(true) // every member
    })
  })
})
