import {
  ServabilityDatabankRowSchema,
  ServabilityOverviewSchema,
  ServabilityPaperRowSchema,
  SERVABILITY_HUB_CARDS,
  SERVABILITY_HUB_COPY,
  SERVABILITY_LANE_WINDOW_MS,
  SERVABILITY_REASON_MS,
  SERVABILITY_REASON_SOURCE,
  type ServabilityDatabankRow,
  type ServabilityPaperRow,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
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

  async function wholeLane<T>(lane: 'databank' | 'bijak-spm', schema: Parameters<typeof parseList>[1], query = ''): Promise<{ rows: T[]; total: number }> {
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
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  // --- AC-R1-21.1: the hub cards ------------------------------------------------------------------

  it('R1-21.1: cards in V2 order with V2 texts: Databank Soalan, then Bijak SPM (R2 and KIV lanes are not returned)', async () => {
    const overview = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema)
    expect(overview.cards).toHaveLength(2)
    expect(overview.cards.map((c) => ({ lane: c.lane, title: c.title, description: c.description, attentionLabel: c.attentionLabel }))).toEqual([
      { lane: 'databank', title: 'Databank Soalan', description: 'Bank soalan objektif SPM mengikut subjek.', attentionLabel: 'tidak boleh ditanda' },
      { lane: 'bijak-spm', title: 'Bijak SPM', description: 'Kertas SPM penuh dalam format sebenar.', attentionLabel: 'tiada kunci jawapan' },
    ])
    // The text lives in one table; the hub chrome is pinned too.
    expect(SERVABILITY_HUB_CARDS).toEqual({
      databank: { title: 'Databank Soalan', description: 'Bank soalan objektif SPM mengikut subjek.', attentionLabel: 'tidak boleh ditanda' },
      'bijak-spm': { title: 'Bijak SPM', description: 'Kertas SPM penuh dalam format sebenar.', attentionLabel: 'tiada kunci jawapan' },
    })
    expect(SERVABILITY_HUB_COPY).toEqual({
      title: 'Kandungan SPM',
      intro: 'Setiap kad ialah satu laluan yang pelajar boleh buka. Nombor merah menunjukkan berapa banyak item yang perlu diperiksa.',
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
    expect(Object.keys(row).sort()).toEqual(['attention', 'questionId', 'status', 'subject', 'title'])
    expect(row.subject).toEqual({ id: tag.subjectId, name: expect.any(String) })
  })

  // --- every BM string, pinned --------------------------------------------------------------------

  it('pins every servability sentence and where it comes from (V2 verbatim or [PROPOSED])', () => {
    expect(SERVABILITY_REASON_MS).toEqual({
      not_approved: 'Belum diluluskan — tekan Terbitkan untuk memaparkannya.',
      archived: 'Diarkibkan — pulihkan ke draf dahulu.',
      dskp_incomplete: 'DSKP belum lengkap — lengkapkan Tag dan TP di borang soalan.',
      untagged_legacy: 'Belum ditanda DSKP — tidak dimasukkan dalam kertas blueprint dan Jana set.',
      image_games: 'Ada imej dan permainan ini tidak memaparkan imej.',
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
      no_chapter: 'Belum dipautkan kepada bab — pilih Bab di borang soalan.',
      has_stimulus: 'Ada rangsangan atau imej — {aktiviti} hanya memaparkan soalan teks.',
      has_option_image: 'Ada imej pada pilihan jawapan — {aktiviti} hanya memaparkan soalan teks.',
      bridge_refused: 'Tidak dapat dihidangkan di {aktiviti}.',
      no_marks: 'Tiada markah pada bahagian soalan.',
      tag_review: 'Perlu semakan tag DSKP.',
      paper_empty: 'Disajikan tetapi tiada soalan',
      stimulus_shared_ungrouped: 'Rangsangan ini dikongsi oleh beberapa soalan tetapi bukan kumpulan rangsangan — jadikan soalan-soalan itu satu kumpulan rangsangan (D90).',
    })
    const v2 = Object.entries(SERVABILITY_REASON_SOURCE).filter(([, src]) => src === 'V2').map(([code]) => code)
    expect(v2.sort()).toEqual(['bridge_refused', 'no_key', 'no_scheme', 'paper_empty'])
    expect(SERVABILITY_LANE_WINDOW_MS).toBe('Halaman terlalu jauh. Gunakan Tapis atau Cari untuk mengecilkan senarai.') // [PROPOSED]
  })

  it('the lane window message reaches the client on `page`', async () => {
    const res = expectError(await admin.get('/api/admin/servability/lanes/bijak-spm?pageSize=100&page=101'), 'VALIDATION_ERROR')
    expect(res.fields?.page).toBe(SERVABILITY_LANE_WINDOW_MS)
  })
})
