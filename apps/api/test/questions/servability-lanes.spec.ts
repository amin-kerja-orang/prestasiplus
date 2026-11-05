import {
  ServabilityDatabankRowSchema,
  ServabilityLaneRowSchema,
  ServabilityLatihTubiCellSchema,
  ServabilityLatihTubiLaneSchema,
  ServabilityOverviewSchema,
  ServabilityPaperRowSchema,
  SERVABILITY_HUB_CARDS,
  SERVABILITY_HUB_COPY,
  SERVABILITY_LANE_WINDOW_MS,
  SERVABILITY_REASON_MS,
  SERVABILITY_REASON_SOURCE,
  type ServabilityDatabankRow,
  type ServabilityLaneRow,
  type ServabilityLatihTubiCell,
  type ServabilityPaperRow,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { ServabilityReadsService } from '../../src/modules/questions/serving'
import { OverviewCache, SwrSlot } from '../../src/modules/questions/serving/overview-cache'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, expectError, loginAs, parseData, parseList, type Client, type QuestionsTestApp } from './helpers'

/**
 * R1-T45 part 2, hub and lanes (AC-R1-21.1 / 21.2, Panel P1 / P2). V2 reference: docs/discovery/cloud-student-mechanism.md 3.0
 * (hub cards, lane filters, columns), BIJAK-SPM-cloud.md 3.10 (hub total = every paper including drafts; attention only for
 * PUBLISHED papers: "Disajikan tetapi tiada soalan"). The hub cards count the rows of the lane they open; this spec pages through
 * the whole lane and compares. Card order, texts and the BM sentences are pinned verbatim.
 */
describe('hub cards and lane filters (R1-21.1, R1-21.2)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let admin: Client
  let tag: Tag
  let sciId: string
  const made: Record<string, string> = {}
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

  async function approve(key: string, text: string, over: Record<string, unknown> = {}): Promise<string> {
    const created = await svc.create(mcqInput(tag, { questionText: text, tag: tagBody(tag, 4), ...over }), await adminActor(t.db))
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [created.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
    made[key] = created.id
    return created.id
  }

  async function paper(title: string, status: string, subjectId: string, questionIds: string[]): Promise<string> {
    const [p] = await q(
      `insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, published_at) values ('pilihan', $1, $2, 2, 90, $3, ${status === 'published' ? 'now()' : 'null'}) returning id::text id`,
      [title, subjectId, status],
    )
    const [s] = await q(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', $2, $2) returning id::text id`, [p!.id, Math.max(1, questionIds.length)])
    for (const [i, id] of questionIds.entries()) await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)`, [s!.id, id, i + 1])
    return p!.id
  }

  async function wholeLane<T>(lane: string, schema: Parameters<typeof parseList>[1], query = ''): Promise<{ rows: T[]; total: number }> {
    const rows: T[] = []
    for (let page = 1; ; page++) {
      const res = await admin.get(`/api/admin/servability/lanes/${lane}?pageSize=100&page=${String(page)}${query}`)
      const part = parseList(res, schema) as T[]
      rows.push(...part)
      if (rows.length >= res.body.meta.totalItems || part.length === 0) return { rows, total: res.body.meta.totalItems as number }
    }
  }

  beforeAll(async () => {
    process.env.THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE = '1000'
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    admin = await loginAs(t, 'admin')
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    const subjects = await q(`select id::text id from subjects where code = 'SCI'`)
    sciId = subjects[0]!.id
    await q(`insert into spm_subject_configs (subject_id, grp, display_order, databank_order) values ($1, 'teras', 1, 3), ($2, 'teras', 2, 4) on conflict do nothing`, [tag.subjectId, sciId])

    await approve('plain', 'Soalan teks sahaja untuk kad hab.')
    await approve('second', 'Soalan kedua teks sahaja untuk kad hab.')
    await approve('liveWithDraft', 'Soalan hidup dengan draf untuk kad hab.')
    await svc.update(made.liveWithDraft!, mcqInput(tag, { questionText: 'Draf kedua untuk kad hab.' }), await adminActor(t.db))
    made.draft = (await svc.create(mcqInput(tag, { questionText: 'Soalan draf untuk kad hab.' }), await adminActor(t.db))).id
    // A question the Bijak bridge refuses (table_fill) on a published paper.
    const tableFill = await svc.create(
      mcqInput(tag, {
        questionType: 'essay',
        options: undefined,
        correctAnswer: undefined,
        questionText: 'Soalan isi jadual untuk kad hab.',
        tag: tagBody(tag, 4),
        parts: [{ label: '', prompt: { ms: 'Isi jadual.' }, mode: 'table_fill', marks: 2, key: { kind: 'mapping', cells: { r1c1: ['x'] } } }] as never,
      }),
      await adminActor(t.db),
    )
    await q(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [tableFill.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [tableFill.id])
    made.tableFill = tableFill.id

    made.okPaper = await paper('Kertas elok kad hab', 'published', tag.subjectId, [made.plain!, made.second!])
    made.refusedPaper = await paper('Kertas ditolak kad hab', 'published', tag.subjectId, [made.plain!, made.tableFill!])
    made.emptyPaper = await paper('Kertas kosong kad hab', 'published', tag.subjectId, [])
    made.draftRefusedPaper = await paper('Kertas draf ditolak kad hab', 'draft', tag.subjectId, [made.tableFill!])
    made.draftEmptyPaper = await paper('Kertas draf kosong kad hab', 'draft', tag.subjectId, [])
    made.readyPaper = await paper('Kertas sedia kad hab', 'ready', tag.subjectId, [made.plain!])
    made.withdrawnPaper = await paper('Kertas ditarik kad hab', 'withdrawn', tag.subjectId, [])
    made.sciPaper = await paper('Kertas sains kad hab', 'published', sciId, [])

    // Subjektif lane: an essay question with a key, one whose non-MCQ leaf lost it, one whose MCQ leaf lost it.
    const essay = async (text: string): Promise<string> =>
      (
        await svc.create(
          mcqInput(tag, {
            questionType: 'essay',
            options: undefined,
            correctAnswer: undefined,
            questionText: text,
            tag: tagBody(tag, 4),
            parts: [{ label: '', prompt: { ms: 'Huraikan.' }, mode: 'essay', marks: 2, key: { kind: 'points', marks: 2, points: [{ id: 'p', code: 'K', label: 'k', marks: 2 }] } }] as never,
          }),
          await adminActor(t.db),
        )
      ).id
    const dropKey = (id: string) =>
      q(`delete from answer_keys where part_id in (select p.id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1)`, [id])
    made.subjektifOk = await essay('Soalan subjektif ada skema.')
    made.subjektifNoScheme = await essay('Soalan subjektif tiada skema.')
    await dropKey(made.subjektifNoScheme)
    made.subjektifNoKey = await essay('Soalan subjektif objektif tiada kunci.')
    await dropKey(made.subjektifNoKey)
    await q(`update question_parts set mode = 'mcq' where question_version_id in (select id from question_versions where question_id = $1)`, [made.subjektifNoKey])
    // Live: the two sentences are for what pupils could be served. A draft or an inactive question with no key carries neither.
    await q(`update question_versions set status = 'approved', published_at = now() where question_id = any($1::bigint[])`, [[made.subjektifOk, made.subjektifNoScheme, made.subjektifNoKey]])
    made.subjektifDraftNoScheme = await essay('Soalan subjektif draf tiada skema.')
    await dropKey(made.subjektifDraftNoScheme)
    made.subjektifInactiveNoScheme = await essay('Soalan subjektif tidak aktif tiada skema.')
    await dropKey(made.subjektifInactiveNoScheme)
    await q(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [made.subjektifInactiveNoScheme])
    await q(`update questions set is_active = false where id = $1`, [made.subjektifInactiveNoScheme])

    // Tracking A lane: size 2 for the subject, one full set and one short of a question.
    await q(`update spm_subject_configs set target_type = 'latihan', target_size = 2 where subject_id = $1`, [tag.subjectId])
    const set = async (setNo: number, ids: string[]): Promise<string> => {
      const [row] = await q(`insert into spm_tracking_sets (subject_id, year, set_no) values ($1, 2026, $2) returning id::text id`, [tag.subjectId, setNo])
      for (const [i, id] of ids.entries()) await q(`insert into spm_tracking_set_questions (set_id, question_id, position) values ($1, $2, $3)`, [row!.id, id, i + 1])
      return row!.id
    }
    made.fullSet = await set(1, [made.plain!, made.second!])
    made.shortSet = await set(2, [made.plain!])
    // A draft leaves the set's count, as it does for the pupil. Set 10 proves the sort is numeric.
    made.draftSet = await set(3, [made.plain!, made.draft!])
    made.tenthSet = await set(10, [made.plain!, made.second!])
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  // --- AC-R1-21.1: the hub cards ------------------------------------------------------------------

  it('FR-ADM-Q01.1: six cards in the PRD order with the PRD texts', async () => {
    const overview = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema)
    expect(overview.cards).toHaveLength(6)
    expect(overview.cards.map((c) => ({ lane: c.lane, title: c.title, description: c.description, attentionLabel: c.attentionLabel }))).toEqual([
      { lane: 'databank', title: 'Databank Soalan', description: 'Bank soalan objektif SPM mengikut subjek.', attentionLabel: 'tidak boleh ditanda' },
      { lane: 'tracking-a', title: 'Tracking A', description: 'Set objektif penuh dan lane bahasa.', attentionLabel: 'set tidak lengkap' },
      { lane: 'subjektif', title: 'Subjektif', description: 'Soalan berstruktur dan esei.', attentionLabel: 'tiada skema — tidak disajikan' },
      { lane: 'bijak-spm', title: 'Bijak SPM', description: 'Kertas SPM penuh dalam format sebenar.', attentionLabel: 'tiada kunci jawapan' },
      { lane: 'kertas-subjektif', title: 'Kertas Subjektif', description: 'Kertas 2, 3 & 4 percubaan negeri.', attentionLabel: 'tiada kandungan' },
      { lane: 'latih-tubi', title: 'Latih Tubi', description: 'Latihan ikut topik dan bab.', attentionLabel: 'tidak boleh ditanda' },
    ])
    // The text lives in one table; the hub chrome is pinned too.
    expect(SERVABILITY_HUB_CARDS).toEqual({
      databank: { title: 'Databank Soalan', description: 'Bank soalan objektif SPM mengikut subjek.', attentionLabel: 'tidak boleh ditanda' },
      'tracking-a': { title: 'Tracking A', description: 'Set objektif penuh dan lane bahasa.', attentionLabel: 'set tidak lengkap' },
      subjektif: { title: 'Subjektif', description: 'Soalan berstruktur dan esei.', attentionLabel: 'tiada skema — tidak disajikan' },
      'bijak-spm': { title: 'Bijak SPM', description: 'Kertas SPM penuh dalam format sebenar.', attentionLabel: 'tiada kunci jawapan' },
      'kertas-subjektif': { title: 'Kertas Subjektif', description: 'Kertas 2, 3 & 4 percubaan negeri.', attentionLabel: 'tiada kandungan' },
      'latih-tubi': { title: 'Latih Tubi', description: 'Latihan ikut topik dan bab.', attentionLabel: 'tidak boleh ditanda' },
    })
    expect(SERVABILITY_HUB_COPY).toEqual({
      title: 'SPM',
      intro: 'Setiap kad di bawah ialah satu laluan yang pelajar boleh buka. Nombor merah menunjukkan berapa banyak item yang perlu diperiksa.',
      allGood: 'Semua elok',
      open: 'Buka senarai',
    })
  })

  it('R1-21.1: the Databank card counts the Databank lane rows (total = rows, attention = rows with a reason)', async () => {
    const card = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema).cards.find((c) => c.lane === 'databank')!
    const lane = await wholeLane<ServabilityDatabankRow>('databank', ServabilityDatabankRowSchema)
    expect(lane.rows.length).toBe(lane.total)
    expect(card.total).toBe(lane.total)
    expect(card.attention).toBe(lane.rows.filter((r) => r.attention.length > 0).length)
    expect(card.attention).toBeGreaterThan(0)
    expect(card.attention).toBeLessThan(card.total)
    const byId = new Map(lane.rows.map((r) => [r.questionId, r]))
    expect(byId.get(made.plain!)?.attention).toEqual([])
    expect(byId.get(made.liveWithDraft!)).toMatchObject({ status: 'draft', attention: [] })
    expect(byId.get(made.draft!)?.attention.map((r) => r.code)).toEqual(['not_approved'])
  })

  it('R1-21.1: the Bijak SPM card counts the paper lane rows (every pilihan paper, any status; attention = rows with a reason)', async () => {
    const card = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema).cards.find((c) => c.lane === 'bijak-spm')!
    const lane = await wholeLane<ServabilityPaperRow>('bijak-spm', ServabilityPaperRowSchema)
    expect(lane.rows.length).toBe(lane.total)
    expect(card.total).toBe(lane.total)
    expect(card.total).toBe(8) // V2: the lane total counts drafts too
    const withReason = lane.rows.filter((r) => r.attention.length > 0)
    expect(card.attention).toBe(withReason.length)
    expect(withReason.map((r) => r.paperId).sort()).toEqual([made.refusedPaper, made.emptyPaper, made.sciPaper].sort())
  })

  it('V2 rule: only PUBLISHED papers carry attention; an empty published paper says "Disajikan tetapi tiada soalan"', async () => {
    const lane = (await wholeLane<ServabilityPaperRow>('bijak-spm', ServabilityPaperRowSchema)).rows
    const row = (key: string) => lane.find((r) => r.paperId === made[key])!
    expect(row('emptyPaper')).toMatchObject({ status: 'published', questionCount: 0, attentionCount: 0 })
    expect(row('emptyPaper').attention).toEqual([{ code: 'paper_empty', message: 'Disajikan tetapi tiada soalan', count: 1 }])
    expect(row('refusedPaper')).toMatchObject({ questionCount: 2, attentionCount: 1 })
    expect(row('refusedPaper').attention[0]).toMatchObject({ code: 'bridge_refused', count: 1 })
    expect(row('refusedPaper').attention[0]?.message.startsWith('Tidak dihidangkan kerana ')).toBe(true)
    expect(row('okPaper').attention).toEqual([])
    // draft, ready and withdrawn papers are rows (and count in the total) but never need attention
    for (const key of ['draftRefusedPaper', 'draftEmptyPaper', 'readyPaper', 'withdrawnPaper']) expect(row(key).attention, key).toEqual([])
    expect(row('readyPaper').status).toBe('ready')
    expect(row('withdrawnPaper').status).toBe('withdrawn')
  })

  // --- AC-R1-21.2: lane filters -------------------------------------------------------------------

  it('R1-21.2: Bijak SPM lane filters Subjek, Status and Cari, alone and together; Set Semula (no filter) returns everything', async () => {
    const ids = async (query: string) => (await wholeLane<ServabilityPaperRow>('bijak-spm', ServabilityPaperRowSchema, query)).rows.map((r) => r.paperId).sort()
    const all = await ids('')
    expect(all).toHaveLength(8)
    expect(await ids(`&subjectId=${sciId}`)).toEqual([made.sciPaper])
    expect(await ids(`&subjectId=${tag.subjectId}`)).toEqual(all.filter((id) => id !== made.sciPaper))
    expect(await ids('&status=draft')).toEqual([made.draftRefusedPaper, made.draftEmptyPaper].sort())
    expect(await ids('&status=ready')).toEqual([made.readyPaper])
    expect(await ids('&status=withdrawn')).toEqual([made.withdrawnPaper])
    expect(await ids('&status=published')).toEqual([made.okPaper, made.refusedPaper, made.emptyPaper, made.sciPaper].sort())
    expect(await ids('&search=elok%20kad')).toEqual([made.okPaper])
    expect(await ids(`&status=published&subjectId=${tag.subjectId}&search=kosong`)).toEqual([made.emptyPaper])
    // unknown values match nothing; a LIKE wildcard is literal
    expect(await ids('&status=archived')).toEqual([])
    expect(await ids('&subjectId=abc')).toEqual([])
    expect(await ids('&search=%25')).toEqual([])
    // newest first
    const order = (await wholeLane<ServabilityPaperRow>('bijak-spm', ServabilityPaperRowSchema)).rows.map((r) => BigInt(r.paperId))
    expect(order).toEqual([...order].sort((a, b) => (a < b ? 1 : -1)))
  })

  it('R1-21.2: Databank lane filters Subjek, Status and Cari together; each row carries the columns Tajuk, Perhatian (and subject, status)', async () => {
    const rows = async (query: string) => (await wholeLane<ServabilityDatabankRow>('databank', ServabilityDatabankRowSchema, query)).rows
    const all = await rows('')
    const bySubject = (id: string) => all.filter((r) => r.subject?.id === id).map((r) => r.questionId)
    expect(bySubject(tag.subjectId).length).toBeGreaterThan(0)
    expect((await rows(`&subjectId=${tag.subjectId}`)).map((r) => r.questionId)).toEqual(bySubject(tag.subjectId))
    expect((await rows(`&subjectId=${sciId}`)).map((r) => r.questionId)).toEqual(bySubject(sciId))
    expect(bySubject(tag.subjectId).length + bySubject(sciId).length).toBe(all.length)
    expect((await rows('&status=draft&search=kad')).map((r) => r.questionId).sort()).toEqual([made.liveWithDraft, made.draft].sort())
    expect((await rows('&status=approved&search=teks%20sahaja')).map((r) => r.questionId).sort()).toEqual([made.plain, made.second].sort())
    const row = all.find((r) => r.questionId === made.plain)!
    expect(Object.keys(row).sort()).toEqual(['attention', 'meta', 'questionId', 'status', 'subject', 'title'])
    expect(row.subject).toEqual({ id: tag.subjectId, name: expect.any(String) })
  })

  // --- REQ-C-020: the Subjek filter options travel with the lane ------------------------------------

  it('REQ-C-020: each lane page carries `subjects` [{id, name}] for its Subjek filter, whatever the other filters are', async () => {
    const subjectsOf = async (lane: string, query = '') => (await admin.get(`/api/admin/servability/lanes/${lane}?pageSize=5${query}`)).body.subjects as { id: string; name: string }[]
    const names = new Map((await t.db.query<{ id: string; name: string }>(`select id::text id, name from subjects`)).map((r) => [r.id, r.name]))
    // Field 02-01, SR-13: every lane offers every active subject, with their names.
    const active = await t.db.query<{ id: string }>(`select id::text id from subjects where is_active`)
    const databank = await subjectsOf('databank')
    expect(databank.map((s) => s.id).sort()).toEqual(active.map((r) => r.id).sort())
    for (const s of databank) expect(s.name).toBe(names.get(s.id))
    const papers = await subjectsOf('bijak-spm')
    expect(papers).toEqual(databank)
    for (const lane of ['tracking-a', 'subjektif', 'kertas-subjektif', 'latih-tubi']) expect(await subjectsOf(lane), lane).toEqual(databank)
    // Filters narrow the rows, never the options.
    expect(await subjectsOf('databank', `&subjectId=${sciId}&status=draft&search=zzz`)).toEqual(databank)
    expect(await subjectsOf('bijak-spm', `&subjectId=${sciId}&status=ready`)).toEqual(papers)
    // Every id the lane shows in a row is one of its options.
    const rows = (await wholeLane<ServabilityPaperRow>('bijak-spm', ServabilityPaperRowSchema)).rows
    for (const r of rows) expect(papers.map((s) => s.id)).toContain(r.subject?.id)
  })

  // --- every BM string, pinned --------------------------------------------------------------------

  it('pins every servability sentence and where it comes from (V2 verbatim or [PROPOSED])', () => {
    expect(SERVABILITY_REASON_MS).toEqual({
      not_approved: 'Belum diluluskan — tekan Terbitkan untuk memaparkannya.',
      archived: 'Diarkibkan — pulihkan ke draf dahulu.',
      dskp_incomplete: 'DSKP belum lengkap — lengkapkan Tag dan TP di borang soalan.',
      untagged_legacy: 'Belum ditanda DSKP — tidak dimasukkan dalam kertas blueprint dan Jana set.',
      image_games: 'Soalan bergambar tidak digunakan dalam permainan.',
      image_missing: 'Imej belum dimuat naik — muat naik di borang sunting.',
      level_inactive: 'Tahap tidak aktif untuk murid.',
      no_key: 'Tiada kunci jawapan.',
      no_scheme: 'Tiada skema — tidak disajikan.',
      paper_not_published: 'Kertas belum diterbitkan.',
      not_on_published_paper: 'Tiada dalam mana-mana kertas diterbitkan.',
      not_in_tracking_set: 'Tiada dalam mana-mana set Tracking A.',
      shape_unsupported: 'Bentuk soalan ini tidak dipaparkan di {aktiviti}.',
      withdrawn: 'Soalan ditarik balik (tidak aktif) — aktifkan semula di senarai soalan.',
      pksk: 'Soalan PKSK dipaparkan di modul PKSK sahaja.',
      level_primary: 'Tahap sekolah rendah tidak dipaparkan kepada murid.',
      level_not_offered: 'Hanya soalan Tingkatan 4 dan 5 dipaparkan di {aktiviti}.',
      subject_unavailable: 'Subjek tidak aktif atau tidak dipautkan kepada tahap soalan ini.',
      subject_not_listed: 'Subjek ini tiada dalam senarai {aktiviti}.',
      no_chapter: 'Bab belum dipaut - tidak disajikan dalam Soalan by Chapter.',
      has_stimulus: 'Ada rangsangan atau imej — {aktiviti} hanya memaparkan soalan teks.',
      has_option_image: 'Ada imej pada pilihan jawapan — {aktiviti} hanya memaparkan soalan teks.',
      bridge_refused: 'Tidak dapat dihidangkan di {aktiviti}.',
      no_marks: 'Tiada markah pada bahagian soalan.',
      tag_review: 'Perlu semakan tag DSKP.',
      paper_empty: 'Disajikan tetapi tiada soalan',
      stimulus_shared_ungrouped: 'Rangsangan ini dikongsi oleh beberapa soalan tetapi bukan kumpulan rangsangan — jadikan soalan-soalan itu satu kumpulan rangsangan (D90).',
      question_missing: 'Soalan pada kertas ini tiada dalam bank soalan — kertas tidak boleh dimulakan; gantikan atau buang soalan itu.',
      group_incomplete: 'Kumpulan belum lengkap - {n} soalan belum diluluskan.',
      stimulus_missing: 'Rangsangan tiada — soalan merujuk {rujukan} tetapi tiada gambar.',
      figure_only: 'Soalan ini hanya mengandungi rangsangan. Tukarkan kepada rangsangan kumpulan.',
    })
    const v2 = Object.entries(SERVABILITY_REASON_SOURCE).filter(([, src]) => src === 'V2').map(([code]) => code)
    expect(v2.sort()).toEqual(['bridge_refused', 'no_key', 'no_scheme', 'paper_empty'])
    expect(SERVABILITY_LANE_WINDOW_MS).toBe('Halaman terlalu jauh. Gunakan Tapis atau Cari untuk mengecilkan senarai.') // [PROPOSED]
  })

  // --- S3-T03: the six lanes ------------------------------------------------------------------------

  it('S3-T03: the hub card total equals the unfiltered list `count` of the same lane, for every lane', async () => {
    const overview = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema)
    for (const card of overview.cards) {
      const res = await admin.get(`/api/admin/servability/lanes/${card.lane}?pageSize=5`)
      expect(res.status, card.lane).toBe(200)
      expect(res.body.count, card.lane).toBe(card.total)
      expect(res.body.attention, card.lane).toEqual(card.attentionLines)
    }
  })

  it('S3-T03: an unknown lane is 404', async () => {
    expectError(await admin.get('/api/admin/servability/lanes/tiada'), 'NOT_FOUND')
  })

  it('FR-ADM-Q02.1: a Databank row carries the meta line and a stem of up to 120 characters', async () => {
    const lane = await wholeLane<ServabilityDatabankRow>('databank', ServabilityDatabankRowSchema)
    const row = lane.rows.find((r) => r.questionId === made.plain)!
    expect(row.meta).toMatch(new RegExp(`^#${made.plain} · .+ · 4 pilihan$`))
    for (const r of lane.rows) expect(r.title.length).toBeLessThanOrEqual(120)
  })

  it('FR-ADM-Q02.4: Latih Tubi lists subject x Tingkatan cells that add up to the overview row and to the card', async () => {
    const res = await admin.get('/api/admin/servability/lanes/latih-tubi?pageSize=100')
    expect(ServabilityLatihTubiLaneSchema.safeParse(res.body).success).toBe(true)
    const cells = parseList(res, ServabilityLatihTubiCellSchema) as ServabilityLatihTubiCell[]
    const overview = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema)
    const row = overview.activities.find((a) => a.activity === 'latih_tubi_spm')!
    const card = overview.cards.find((c) => c.lane === 'latih-tubi')!
    expect(cells.reduce((n, c) => n + c.servable, 0)).toBe(row.served)
    expect(cells.reduce((n, c) => n + c.total, 0)).toBe(card.total)
    expect(card.attention).toBe(cells.reduce((n, c) => n + c.total - c.servable, 0))
    const math = cells.find((c) => c.subject.id === tag.subjectId && c.servable > 0)!
    expect(math.actions).toEqual([])
    expect(math.meta).toBe(`#${math.subject.id} · ${String(math.servable)} soalan`) // PO: the cell label is the servable "{n} soalan"
    const filtered = await admin.get(`/api/admin/servability/lanes/latih-tubi?subjectId=${sciId}`)
    for (const c of filtered.body.data as ServabilityLatihTubiCell[]) expect(c.subject.id).toBe(sciId)
    const none = await admin.get('/api/admin/servability/lanes/latih-tubi?search=zzz-tiada')
    expect(none.body.data).toEqual([])
    expect(none.body.count).toBe(0)
  })

  it('FR-ADM-Q02.4: the switch is ON with no flag store (FR-ADM-N06.4), and every cell says so', async () => {
    const res = await admin.get('/api/admin/servability/lanes/latih-tubi?pageSize=5')
    expect(res.body.meta.switchEnabled).toBe(true)
    for (const c of res.body.data as ServabilityLatihTubiCell[]) expect(c.status).toBe('open')
  })

  it('FR-ADM-Q02.4: the switch follows the flag store once it exists; a key with no row is ON', async () => {
    await t.db.query(`create table feature_flags (key text primary key, enabled boolean not null)`)
    try {
      const read = async () => (await admin.get('/api/admin/servability/lanes/latih-tubi?pageSize=5')).body as { meta: { switchEnabled: boolean }; data: ServabilityLatihTubiCell[] }
      expect((await read()).meta.switchEnabled).toBe(true)
      await t.db.query(`insert into feature_flags (key, enabled) values ('latih-tubi', false)`)
      const closed = await read()
      expect(closed.meta.switchEnabled).toBe(false)
      for (const c of closed.data) expect(c.status).toBe('closed')
    } finally {
      await t.db.query(`drop table feature_flags`)
    }
  })

  it('S3-T03: Tracking A rows and the card use the pupil rule: a set short of its size is incomplete', async () => {
    const lane = await wholeLane<ServabilityLaneRow>('tracking-a', ServabilityLaneRowSchema)
    const full = lane.rows.find((r) => r.id === made.fullSet)!
    const short = lane.rows.find((r) => r.id === made.shortSet)!
    expect(full.attention).toEqual([])
    expect(full.title).toMatch(/ · 2026 Set 1$/)
    expect(full.meta).toBe(`#${made.fullSet} · ramalan · 2 soalan`)
    expect(short.attention).toHaveLength(1)
    expect(short.attention[0]).toMatch(/^Hanya 1 daripada 2 soalan — \d+ tersedia untuk diisi$/)
    const drafted = lane.rows.find((r) => r.id === made.draftSet)!
    expect(drafted.meta).toBe(`#${made.draftSet} · ramalan · 1 soalan`)
    expect(drafted.attention[0]).toMatch(/^Hanya 1 daripada 2 soalan/)
    const ids = lane.rows.map((r) => r.id)
    expect(ids.indexOf(made.shortSet!)).toBeLessThan(ids.indexOf(made.tenthSet!))
    const card = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema).cards.find((c) => c.lane === 'tracking-a')!
    expect(card.total).toBe(lane.total)
    expect(card.attention).toBe(lane.rows.filter((r) => r.attention.length > 0).length)
    expect(card.attentionLines).toEqual([{ count: card.attention, text: `${String(card.attention)} set tidak lengkap` }])
  })

  it('FR-ADM-Q23.3: the Subjektif lane gives each reason its sentence and the card its two lines', async () => {
    const lane = await wholeLane<ServabilityLaneRow>('subjektif', ServabilityLaneRowSchema)
    const row = (id: string | undefined) => lane.rows.find((r) => r.id === id)!
    expect(row(made.subjektifOk).attention).toEqual([])
    expect(row(made.subjektifNoScheme).attention).toEqual([SERVABILITY_REASON_MS.no_scheme])
    expect(row(made.subjektifNoKey).attention).toEqual([SERVABILITY_REASON_MS.no_key])
    expect(row(made.subjektifDraftNoScheme).attention).toEqual([])
    expect(row(made.subjektifInactiveNoScheme).attention).toEqual([])
    expect(row(made.subjektifOk).actions).toEqual(['preview', 'edit'])
    const has = (m: string) => lane.rows.filter((r) => r.attention.includes(m)).length
    const noScheme = has(SERVABILITY_REASON_MS.no_scheme)
    const noKey = has(SERVABILITY_REASON_MS.no_key)
    const card = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema).cards.find((c) => c.lane === 'subjektif')!
    expect(card.attention).toBe(lane.rows.filter((r) => r.attention.length > 0).length)
    expect(card.attentionLines).toEqual([
      { count: noScheme, text: `${String(noScheme)} tiada skema — tidak disajikan` },
      { count: noKey, text: `${String(noKey)} tiada kunci jawapan` },
    ])
  })

  it('S3-T03: Kertas Subjektif is empty and has no attention rule until DM-23 exists; Bijak SPM stays as it was', async () => {
    const lane = await admin.get('/api/admin/servability/lanes/kertas-subjektif')
    expect(lane.body.data).toEqual([])
    expect(lane.body.count).toBe(0)
    const card = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema).cards.find((c) => c.lane === 'kertas-subjektif')!
    expect(card).toMatchObject({ total: 0, attention: 0, attentionLines: [] })
    expect(card.attentionOpen).toBeUndefined()
  })

  it('S3-T03: once papers carry a surface, a Kertas Subjektif paper leaves the Bijak SPM lane for its own', async () => {
    await t.db.query(`alter table papers add column surface text not null default 'simulasi'`)
    try {
      await t.db.query(`update papers set surface = 'subjektif' where id = $1`, [made.sciPaper])
      const own = await wholeLane<ServabilityLaneRow>('kertas-subjektif', ServabilityLaneRowSchema)
      expect(own.rows.map((r) => r.id)).toEqual([made.sciPaper])
      const bijak = await wholeLane<ServabilityPaperRow>('bijak-spm', ServabilityPaperRowSchema)
      expect(bijak.rows.map((r) => r.paperId)).not.toContain(made.sciPaper)

      // FR-ADM-Q18.3: a paper with no placement reads "tiada kandungan", and the hub counts the same rows.
      await t.db.query(`update papers set surface = 'subjektif' where id = $1`, [made.refusedPaper])
      ;(t.app.get(OverviewCache) as unknown as { slots: Map<string, unknown> }).slots.clear()
      const both = await wholeLane<ServabilityLaneRow>('kertas-subjektif', ServabilityLaneRowSchema)
      expect(both.rows.find((r) => r.id === made.sciPaper)?.attention).toEqual(['tiada kandungan'])
      expect(both.rows.find((r) => r.id === made.refusedPaper)?.attention).toEqual([])
      const card = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema).cards.find((c) => c.lane === 'kertas-subjektif')!
      expect(card).toMatchObject({ total: 2, attention: 1, attentionLines: [{ count: 1, text: '1 tiada kandungan' }] })
    } finally {
      await t.db.query(`alter table papers drop column surface`)
    }
  })

  it('field 02-03: Cari over 100 characters gets the SR-4 message', async () => {
    const res = expectError(await admin.get(`/api/admin/servability/lanes/subjektif?search=${'a'.repeat(101)}`), 'VALIDATION_ERROR')
    expect(res.fields?.search).toBe('Carian tidak boleh melebihi 100 aksara.')
  })

  it('a lane read never computes the overview: no `attention` while the cache is cold, the hub lines once it is warm', async () => {
    const reads = t.app.get(ServabilityReadsService)
    ;(t.app.get(OverviewCache) as unknown as { slots: Map<string, unknown> }).slots.clear()
    const spy = vi.spyOn(reads, 'overview')
    try {
      for (const lane of ['databank', 'bijak-spm', 'tracking-a', 'subjektif', 'kertas-subjektif', 'latih-tubi']) {
        const res = await admin.get(`/api/admin/servability/lanes/${lane}?pageSize=5`)
        expect(res.status, lane).toBe(200)
        expect(res.body.attention, lane).toBeUndefined()
      }
      expect(spy).not.toHaveBeenCalled()
      const overview = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema)
      const res = await admin.get('/api/admin/servability/lanes/subjektif?pageSize=5')
      expect(res.body.attention).toEqual(overview.cards.find((c) => c.lane === 'subjektif')!.attentionLines)
    } finally {
      spy.mockRestore()
    }
  })

  it('SR-3: one card that fails is flagged, the others stay, and the first read after it recovers', async () => {
    const reads = t.app.get(ServabilityReadsService)
    ;(t.app.get(OverviewCache) as unknown as { slots: Map<string, unknown> }).slots.clear()
    vi.spyOn(reads as unknown as { trackingCard: () => Promise<unknown> }, 'trackingCard').mockRejectedValueOnce(new Error('ujian'))
    const first = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema)
    expect(first.cards.find((c) => c.lane === 'tracking-a')).toMatchObject({ failed: true, total: 0 })
    expect(first.cards.filter((c) => c.failed)).toHaveLength(1)
    expect((await admin.get('/api/admin/servability/lanes/tracking-a')).body.attention).toBeUndefined()
    const next = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema)
    expect(next.cards.some((c) => c.failed)).toBe(false)
  })

  it('SwrSlot.evict drops the value, so the next read computes and does not serve it again', async () => {
    const slot = new SwrSlot<number>({ ttlMs: 1000, settleMs: 0, now: () => 0 })
    await slot.get(() => Promise.resolve(7))
    slot.evict()
    expect(slot.peek()).toBeNull()
    expect((await slot.get(() => Promise.resolve(8))).value).toBe(8)
  })

  it('SwrSlot.peek reads what is held and never computes', async () => {
    const slot = new SwrSlot<number>({ ttlMs: 1000, settleMs: 0, now: () => 0 })
    expect(slot.peek()).toBeNull()
    await slot.get(() => Promise.resolve(7))
    expect(slot.peek()?.value).toBe(7)
  })

  it('D90: what could fill a set counts a stimulus group once', async () => {
    const available = async (): Promise<number> => {
      const lane = await wholeLane<ServabilityLaneRow>('tracking-a', ServabilityLaneRowSchema)
      return Number(/— (\d+) tersedia/.exec(lane.rows.find((r) => r.id === made.shortSet)!.attention[0]!)![1])
    }
    const before = await available()
    const first = await approve('groupOne', 'Soalan pertama kumpulan untuk unit D90.')
    const second = await approve('groupTwo', 'Soalan kedua kumpulan untuk unit D90.')
    expect(await available()).toBe(before + 2)
    const [group] = await q(`insert into stimulus_groups (label) values ('Kumpulan D90') returning id::text id`)
    for (const [i, id] of [first, second].entries()) await q(`update questions set group_id = $1, group_position = $2 where id = $3`, [group!.id, i + 1, id])
    expect(await available()).toBe(before + 1)
  })

  it('the lane window message reaches the client on `page`', async () => {
    const res = expectError(await admin.get('/api/admin/servability/lanes/bijak-spm?pageSize=100&page=101'), 'VALIDATION_ERROR')
    expect(res.fields?.page).toBe(SERVABILITY_LANE_WINDOW_MS)
  })
})
