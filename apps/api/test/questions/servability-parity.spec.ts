import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { describeQuestion } from '@pp/exam-core'
import { SERVABILITY_ACTIVITIES, type ServabilityActivity, type ServabilityReport } from '@pp/contract'

import { mulberry32 } from '../../src/db/prng'
import { Be09BijakQuestionSource } from '../../src/modules/bijak/question-bridge/be09-question-source'
import { markableLeaf, leavesOf, resolveStimuli } from '../../src/modules/bijak/kuiz/kuiz.mapper'
import { CurriculumRepository } from '../../src/modules/curriculum'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge/be09-practice-question-source'
import type { UsersRepository } from '../../src/modules/users'
import { QuestionsBijakPoolSource } from '../../src/modules/questions/bijak-pool'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { ServabilityService, filterOf } from '../../src/modules/questions/serving'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * R1-T29 parity: `ServabilityService.evaluate` agrees, question by question, with what each activity's REAL reader draws, on a mixed
 * fixture (the seeded bank plus plain, grouped, picture, structured, draft, withdrawn, other-level and published-paper questions).
 * Readers: the practice source (`sample` with `spmPool`, `chapterPage`), the Bijak bridge (`loadQuestions`), the kuiz mapper over the
 * bank's SQL draw, and the Jana pool facts with exam-core eligibility.
 */
describe('servability evaluate vs the real readers (R1-T29)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let servability: ServabilityService
  let practice: Be09PracticeQuestionSource
  let bijak: Be09BijakQuestionSource
  let pool: QuestionsBijakPoolSource
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>
  let reports: ReadonlyMap<string, ServabilityReport>
  let allIds: string[]
  const made: Record<string, string> = {}

  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string; code: string; public_id: string }>(sql, params)
  let fileSeq = 0
  async function fileRow(): Promise<string> {
    const n = String(++fileSeq)
    const [row] = await q(
      `insert into files (public_id, owner_user_id, purpose, mime, size_bytes, sha256, storage_key)
       values ($1, null, 'question_image', 'image/png', 10, $2, $3) returning id::text id`,
      [`par${n}`.padEnd(22, 'A'), 'b'.repeat(64), `par-key-${n}`],
    )
    return row!.id
  }

  /** A question published (live version 1) with the given tweaks. */
  async function publish(key: string, text: string, over: Record<string, unknown> = {}): Promise<string> {
    const created = await svc.create(mcqInput(tag, { questionText: text, ...over }), admin)
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [created.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
    made[key] = created.id
    return created.id
  }

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    servability = t.app.get(ServabilityService)
    pool = t.app.get(QuestionsBijakPoolSource)
    practice = new Be09PracticeQuestionSource(repo, {} as UsersRepository)
    bijak = new Be09BijakQuestionSource(repo, t.app.get(CurriculumRepository), {
      publicIdsOf: async (ids: readonly string[]) => {
        const rows = ids.length === 0 ? [] : await q(`select id::text id, public_id from files where id = any($1::bigint[])`, [ids])
        return new Map(rows.map((r) => [r.id, r.public_id]))
      },
    })
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)

    // SPM lists: MATH is a Databank subject, SCI is a Latih Tubi subject without a Databank position.
    const subjects = await q(`select id::text id, code from subjects where code in ('MATH', 'SCI')`)
    const idOf = (code: string) => subjects.find((s) => s.code === code)!.id
    await q(`insert into spm_subject_configs (subject_id, grp, display_order, databank_order) values ($1, 'teras', 1, 3), ($2, 'teras', 2, null) on conflict do nothing`, [idOf('MATH'), idOf('SCI')])

    const [chapter] = await q(`select id::text id from chapters where subject_id = $1 limit 1`, [tag.subjectId])

    await publish('plain', 'Soalan biasa teks sahaja untuk kesamaan kebolehhidangan.', { tag: tagBody(tag, 4) })
    if (chapter) await q(`update question_versions set chapter_id = $2 where question_id = $1`, [made.plain, chapter.id])
    await publish('noChapter', 'Soalan teks tanpa bab untuk kesamaan kebolehhidangan.')

    // Stem picture: an image stimulus linked straight to the version.
    await publish('stemImage', 'Soalan dengan gambar soalan sendiri untuk kesamaan kebolehhidangan.')
    const stimulus = await q(`insert into stimuli (kind, label, alt_text, asset_file_id) values ('image', 'Rajah 1', 'Rajah', $1) returning id::text id`, [await fileRow()])
    await q(`insert into question_version_stimuli (question_version_id, stimulus_id, position) select id, $2, 1 from question_versions where question_id = $1`, [made.stemImage, stimulus[0]!.id])

    // Option picture.
    await publish('optionImage', 'Soalan dengan gambar pada pilihan untuk kesamaan kebolehhidangan.')
    await q(`update part_options set image_file_id = $2 where id = (select o.id from part_options o join question_parts p on p.id = o.part_id join question_versions v on v.id = p.question_version_id where v.question_id = $1 order by o.id limit 1)`, [made.optionImage, await fileRow()])

    // A D90 group: one passage, two member questions.
    const passage = await svc.createStimulus({ kind: 'passage', label: 'Petikan A', bodyMs: 'Teks petikan.', bodyEn: null, altText: null, assetFileId: null })
    const groupId = await svc.createStimulusGroup({ label: 'Kumpulan', scope: 'section', stimulusIds: [passage], optionBank: [] })
    await publish('groupA', 'Ahli kumpulan satu untuk kesamaan kebolehhidangan.', { stimulusGroupId: groupId })
    await publish('groupB', 'Ahli kumpulan dua untuk kesamaan kebolehhidangan.', { stimulusGroupId: groupId })

    // Structured (two leaves).
    const struct = await svc.create(
      mcqInput(tag, {
        questionType: 'essay',
        options: undefined,
        correctAnswer: undefined,
        questionText: 'Soalan berstruktur untuk kesamaan kebolehhidangan.',
        parts: [
          { label: '(a)', prompt: { ms: 'Bahagian a' }, mode: 'short_text', marks: 2, key: { kind: 'accepted', values: ['x'] } },
          { label: '(b)', prompt: { ms: 'Bahagian b' }, mode: 'short_text', marks: 2, key: { kind: 'accepted', values: ['y'] } },
        ] as never,
      }),
      admin,
    )
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [struct.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [struct.id])
    made.structured = struct.id

    // Not servable states.
    made.draft = (await svc.create(mcqInput(tag, { questionText: 'Soalan draf untuk kesamaan kebolehhidangan.' }), admin)).id
    await publish('withdrawn', 'Soalan ditarik balik untuk kesamaan kebolehhidangan.')
    await q(`update questions set is_active = false where id = $1`, [made.withdrawn])
    await publish('archivedLive', 'Soalan diarkib untuk kesamaan kebolehhidangan.')
    await q(`update question_versions set status = 'archived' where question_id = $1`, [made.archivedLive])
    await q(`update questions set live_version_no = null where id = $1`, [made.archivedLive])

    // A secondary level the SPM activities do not offer (not T4 or T5), when the seed has one.
    const other = await q(`select id::text id from education_levels where stage <> 'primary' and is_active and code not in ('T4', 'T5') order by id limit 1`)
    await publish('otherLevel', 'Soalan tahap lain untuk kesamaan kebolehhidangan.')
    if (other[0]) await q(`update question_versions set education_level_id = $2 where question_id = $1`, [made.otherLevel, other[0].id])

    // On a published paper (Simulasi), and one that is only a draft paper.
    for (const [key, status] of [['onPaper', 'published'], ['onDraftPaper', 'draft'], ['archivedOnPaper', 'published']] as const) {
      const id = await publish(key, `Soalan pada kertas ${status} untuk kesamaan kebolehhidangan.`)
      const [paper] = await q(
        `insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, published_at) values ('pilihan', $1, $2, 2, 90, $3, ${status === 'published' ? 'now()' : 'null'}) returning id::text id`,
        [`Kertas ${status}`, tag.subjectId, status],
      )
      const [section] = await q(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', 1, 1) returning id::text id`, [paper!.id])
      await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, 1)`, [section!.id, id])
    }

    // H-A13: archived after the paper was published. The paper still lists it, but a new sitting cannot start (no live approved version).
    await q(`update question_versions set status = 'archived' where question_id = $1`, [made.archivedOnPaper])
    await q(`update questions set live_version_no = null where id = $1`, [made.archivedOnPaper])

    allIds = (await q(`select id::text id from questions order by id`)).map((r) => r.id)
    reports = await servability.reports(allIds)
  })
  afterAll(async () => {
    await t.close()
  })

  const servedBy = (activity: ServabilityActivity): Set<string> =>
    new Set([...reports].filter(([, r]) => r.activities.find((a) => a.activity === activity)?.served).map(([id]) => id))
  const reasonsOf = (key: string, activity: ServabilityActivity) => reports.get(made[key]!)!.activities.find((a) => a.activity === activity)!.reasons.map((r) => r.code)
  const sorted = (s: Iterable<string>) => [...s].sort((a, b) => Number(BigInt(a) - BigInt(b)))

  it('reports every known question once, with all six activities in contract order', () => {
    expect(reports.size).toBeGreaterThan(20)
    for (const r of reports.values()) {
      expect(r.activities.map((a) => a.activity)).toEqual([...SERVABILITY_ACTIVITIES])
      expect(r.servedCount).toBe(r.activities.filter((a) => a.served).length)
      for (const a of r.activities) expect(a.served).toBe(a.reasons.length === 0)
    }
  })

  it('latih_tubi_spm and databank: the practice source draw of every subject (spmPool) equals the served set, bar the subject lists', async () => {
    const subjects = await q(`select distinct subject_id::text id from question_versions where subject_id is not null`)
    const drawn = new Set<string>()
    for (const s of subjects) for (const id of await practice.sample({ subjectId: s.id, spmPool: true }, 20_000, mulberry32(7))) drawn.add(id)
    expect(drawn.size).toBeGreaterThan(0)
    const latih = servedBy('latih_tubi_spm')
    const databank = servedBy('databank')
    // Served implies drawn; what is drawn but not served is exactly the questions whose subject is not on the list.
    for (const id of latih) expect(drawn.has(id), `latih ${id}`).toBe(true)
    for (const id of drawn) {
      if (latih.has(id)) continue
      expect(reports.get(id)!.activities.find((a) => a.activity === 'latih_tubi_spm')!.reasons.map((r) => r.code), `latih ${id}`).toEqual(['subject_not_listed'])
    }
    // Databank is Latih Tubi narrowed to the subjects with a Tahun Lepas position.
    for (const id of databank) expect(latih.has(id)).toBe(true)
    const dropped = sorted(latih).filter((id) => !databank.has(id))
    for (const id of dropped) expect(reports.get(id)!.activities.find((a) => a.activity === 'databank')!.reasons.map((r) => r.code)).toEqual(['subject_not_listed'])
    // The fixture: MATH is listed, so the plain question is in both.
    expect(latih.has(made.plain!)).toBe(true)
    expect(databank.has(made.plain!)).toBe(true)
  })

  it('latih_tubi_spm gives the practice reason for each refused shape and the SQL scope filter agrees', async () => {
    expect(reasonsOf('stemImage', 'latih_tubi_spm')).toEqual(['has_stimulus'])
    expect(reasonsOf('optionImage', 'latih_tubi_spm')).toEqual(['has_option_image'])
    expect(reasonsOf('groupA', 'latih_tubi_spm')).toEqual(['has_stimulus'])
    expect(reasonsOf('structured', 'latih_tubi_spm')).toEqual(['shape_unsupported'])
    expect(reasonsOf('draft', 'latih_tubi_spm')).toEqual(['not_approved'])
    expect(reasonsOf('archivedLive', 'latih_tubi_spm')).toEqual(['archived'])
    expect(reasonsOf('withdrawn', 'latih_tubi_spm')).toEqual(['withdrawn'])
    if ((await q(`select 1 from education_levels where stage <> 'primary' and is_active and code not in ('T4', 'T5')`)).length > 0) {
      expect(reasonsOf('otherLevel', 'latih_tubi_spm')).toEqual(['level_not_offered'])
    }
    // The SQL half: every id the evaluator serves passes the filter, and every id that passes the filter and the practice
    // mapper is served (the filter is the reader's own `QuestionFilter`).
    const inScope = new Set(await repo.eligibleAmong(allIds, filterOf('latih_tubi_spm')))
    for (const id of servedBy('latih_tubi_spm')) expect(inScope.has(id), id).toBe(true)
  })

  it('bab: the chapter reader returns exactly the served questions of a chapter', async () => {
    const chapters = await q(`select distinct chapter_id::text id from question_versions where chapter_id is not null`)
    expect(chapters.length).toBeGreaterThan(0)
    const drawn = new Set<string>()
    for (const c of chapters) for (const id of await practice.chapterPage(c.id, [], 20_000)) drawn.add(id)
    const withChapter = new Set(
      [...reports.keys()].filter((id) => !reasonsOfId(id, 'bab').includes('no_chapter')),
    )
    function reasonsOfId(id: string, a: ServabilityActivity): string[] {
      return reports.get(id)!.activities.find((x) => x.activity === a)!.reasons.map((r) => r.code)
    }
    // Bab has no SPM level rule: drawn equals served among questions that have a chapter.
    expect(sorted(drawn)).toEqual(sorted([...servedBy('bab')].filter((id) => withChapter.has(id))))
    expect(servedBy('bab').has(made.plain!)).toBe(true)
    expect(reasonsOf('noChapter', 'bab')).toEqual(['no_chapter'])
    expect(reasonsOf('groupA', 'bab')).toContain('has_stimulus')
  })

  it('simulasi_kuiz: the bank SQL draw plus the kuiz mapper keep exactly the served set (groups and pictures allowed, D90)', async () => {
    const drawn = new Set(await repo.sampleIds(filterOf('simulasi_kuiz'), 20_000, 11))
    const kept = new Set<string>()
    for (const record of await repo.getMany([...drawn], 'live')) {
      const group = record.groupId ? await repo.groupOf(record.id) : null
      const assets = new Map((await repo.stimulusAssets(record.version.stimulusIds)).map((a) => [a.id, a]))
      const leaf = leavesOf(record.id, record.version.parts)[0]
      if (record.isActive && leaf && markableLeaf(leaf) !== null && resolveStimuli(record, group, assets).complete) kept.add(record.id)
    }
    expect(sorted(kept)).toEqual(sorted(servedBy('simulasi_kuiz')))
    expect(servedBy('simulasi_kuiz').has(made.groupA!)).toBe(true)
    expect(servedBy('simulasi_kuiz').has(made.stemImage!)).toBe(true)
    expect(reasonsOf('structured', 'simulasi_kuiz')).toEqual(['shape_unsupported'])
  })

  it('simulasi_paper: a NEW sitting can be started (live approved, bridge accepts) AND the question sits on a published paper', async () => {
    // `getMany` is the paper eligibility read of BE-15 (`published = true`): the live approved version only, whatever `is_active`.
    // An archived question is not in it, so the paper cannot be started (H-A13); `loadQuestions` (running sittings) still reads it.
    const startable = new Set((await bijak.getMany(allIds)).keys())
    expect(startable.has(made.withdrawn!)).toBe(true)
    expect(startable.has(made.archivedLive!)).toBe(false)
    expect(startable.has(made.archivedOnPaper!)).toBe(false)
    expect((await bijak.loadQuestions(allIds)).has(made.archivedOnPaper!)).toBe(true)
    const onPaper = new Set((await q(`select distinct pl.question_id::text id from paper_placements pl join paper_sections ps on ps.id = pl.paper_section_id join papers p on p.id = ps.paper_id where p.status = 'published' and p.kind <> 'jana'`)).map((r) => r.id))
    const expected = [...startable].filter((id) => onPaper.has(id))
    expect(sorted(servedBy('simulasi_paper'))).toEqual(sorted(expected))
    expect(servedBy('simulasi_paper').has(made.onPaper!)).toBe(true)
    expect(reasonsOf('onDraftPaper', 'simulasi_paper')).toEqual(['not_on_published_paper'])
    expect(reasonsOf('plain', 'simulasi_paper')).toEqual(['not_on_published_paper'])
    expect(reasonsOf('archivedOnPaper', 'simulasi_paper')).toEqual(['archived'])
    expect(reasonsOf('archivedLive', 'simulasi_paper')).toEqual(['archived'])
    // Every startable question that is on no published paper is reported with exactly that reason.
    for (const id of startable) if (!onPaper.has(id)) expect(reports.get(id)!.activities.find((a) => a.activity === 'simulasi_paper')!.reasons.map((r) => r.code)).toEqual(['not_on_published_paper'])
  })

  it('jana_kertas: pool facts eligible by exam-core and served by the bridge', async () => {
    const subjects = await q(`select distinct subject_id::text id from question_versions where subject_id is not null`)
    const eligible = new Set<string>()
    for (const s of subjects) for (const facts of await pool.candidatesOf(s.id)) if (describeQuestion(facts).reasons.length === 0) eligible.add(facts.id)
    const live = await repo.getMany([...eligible], 'live')
    const bridged = new Set((await bijak.loadQuestions(live.map((r) => r.id))).keys())
    const expected = [...eligible].filter((id) => bridged.has(id))
    expect(sorted(servedBy('jana_kertas'))).toEqual(sorted(expected))
    // The fixture questions carry a unit and TP (tag) and a key, so the plain one is eligible; a structured one without a
    // mark scheme rule violation is reported with the exam-core reason it fails, if any.
    expect(servedBy('jana_kertas').has(made.plain!)).toBe(true)
  })

  it('cost: one batch report of the whole fixture and one single report stay far inside a request budget (measure, D92)', async () => {
    const t0 = performance.now()
    await servability.reports(allIds)
    const batchMs = performance.now() - t0
    const t1 = performance.now()
    await servability.report(made.plain!)
    const singleMs = performance.now() - t1
    process.stderr.write(`[servability] ${String(allIds.length)} questions in one batch: ${batchMs.toFixed(0)} ms; one question: ${singleMs.toFixed(0)} ms\n`)
    expect(batchMs).toBeLessThan(5000)
    expect(singleMs).toBeLessThan(3000)
  })

  it('a single report equals the batch report, and an unknown id has none', async () => {
    const one = await servability.report(made.groupA!)
    expect(one).toEqual(reports.get(made.groupA!))
    expect(await servability.report('999999999')).toBeNull()
    expect((await servability.reports([])).size).toBe(0)
  })
})
