import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ServabilityActivity } from '@pp/contract'

import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { refreshStimulusFlag } from '../../src/modules/questions/effective-leaf'
import { ServabilityService, filterOf } from '../../src/modules/questions/serving'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * S1-T07 (DM-05, DM-53, FR-ADM-G7.3): the detectors run on every write path and store the flag; `stimulus_missing` and `figure_only` (not dismissed) give a
 * servability reason on every pupil surface and leave the draw; `stem_duplicated` is served; the indicator equals the draw outcome (D91). Also
 * `no_key` / `no_scheme` (a leaf with no `answer_keys` row) in the same rule.
 */
describe('stimulus flags and the servability rule (S1-T07)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let servability: ServabilityService
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>
  const made: Record<string, string> = {}
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string; stimulus_flag: string | null; stimulus_flag_ref: string | null; stimulus_flag_at: Date | null }>(sql, params)

  /** A question published (live version 1). */
  async function publish(key: string, text: string, over: Record<string, unknown> = {}): Promise<string> {
    const input = { ...over }
    delete input.keepDuplicatePrompt
    const created = await svc.create(mcqInput(tag, { questionText: text, tag: tagBody(tag, 4), ...input }), admin)
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [created.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
    made[key] = created.id
    // The flat create copies the question text into the only leaf prompt, which is `stem_duplicated`; give the leaf its own prompt so the fixture is plain.
    if (over.keepDuplicatePrompt !== true) {
      await q(`update question_parts set prompt_ms = 'Pilih jawapan yang betul.' where question_version_id = (select id from question_versions where question_id = $1)`, [created.id])
      await refresh(created.id)
    }
    return created.id
  }
  const refresh = (id: string) => t.db.prisma.$transaction(async (tx) => refreshStimulusFlag(tx, BigInt(id), 1, new Date()))
  const flagOf = async (key: string) => (await q(`select stimulus_flag, stimulus_flag_ref, stimulus_flag_at from question_versions where question_id = $1 and version_no = 1`, [made[key]]))[0]!
  const reasons = async (key: string, activity: ServabilityActivity) => {
    const report = await servability.report(made[key]!)
    return report!.activities.find((a) => a.activity === activity)!
  }
  /** Ids of `ids` the draw of `activity` can return (the SQL half of the rule). */
  const drawn = async (ids: string[], activity: ServabilityActivity) => new Set(await repo.eligibleAmong(ids, filterOf(activity)))

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    servability = t.app.get(ServabilityService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)
    const [math] = await q(`select id::text id from subjects where code = 'MATH'`)
    await q(`insert into spm_subject_configs (subject_id, grp, display_order, databank_order) values ($1, 'teras', 1, 3) on conflict do nothing`, [math!.id])
  })
  afterAll(async () => {
    await t.close()
  })

  it('[CI] creating "Rajah 14 menunjukkan ..." with no figure stores stimulus_missing, numbered, with a timestamp', async () => {
    await publish('rajah14', 'Rajah 14 menunjukkan satu litar sesiri. Hitung rintangan berkesan litar itu.')
    const f = await flagOf('rajah14')
    expect(f.stimulus_flag).toBe('stimulus_missing')
    expect(f.stimulus_flag_ref).toBe('numbered')
    expect(f.stimulus_flag_at).toBeInstanceOf(Date)
  })

  it('[CI] a plain question carries no flag', async () => {
    await publish('plain', 'Apakah hasil tambah dua nombor genap yang berturutan?')
    expect((await flagOf('plain')).stimulus_flag).toBeNull()
  })

  it('[CI] stimulus_missing excludes the question from the draw and gives its reason on every pupil surface', async () => {
    const ids = [made.rajah14!, made.plain!]
    for (const activity of ['latih_tubi_spm', 'databank', 'bab', 'simulasi_kuiz'] as const) {
      expect([...(await drawn(ids, activity))].sort(), `${activity} draw`).toEqual([made.plain!])
      const r = await reasons('rajah14', activity)
      expect(r.served, activity).toBe(false)
      const flagged = r.reasons.find((x) => x.code === 'stimulus_missing')
      expect(flagged?.message, activity).toBe('Rangsangan tiada — soalan merujuk Rajah 14 tetapi tiada gambar.')
      expect(flagged?.detail).toBe('numbered')
      expect((await reasons('plain', activity)).reasons.map((x) => x.code), `${activity} plain`).not.toContain('stimulus_missing')
    }
    expect((await reasons('rajah14', 'jana_kertas')).reasons.map((x) => x.code)).toContain('stimulus_missing')
  })

  it('[CI] a dismissed flag ("Bukan masalah") is served again; the reason is gone', async () => {
    await q(`update question_versions set flag_dismissed_at = now() where question_id = $1`, [made.rajah14])
    expect((await drawn([made.rajah14!], 'latih_tubi_spm')).has(made.rajah14!)).toBe(true)
    expect((await reasons('rajah14', 'latih_tubi_spm')).reasons.map((x) => x.code)).not.toContain('stimulus_missing')
    await q(`update question_versions set flag_dismissed_at = null where question_id = $1`, [made.rajah14])
    expect((await drawn([made.rajah14!], 'latih_tubi_spm')).has(made.rajah14!)).toBe(false)
  })

  it('[CI] an unnumbered reference is stored with ref unnumbered', async () => {
    await publish('graf', 'Graf di atas menunjukkan hubungan antara halaju dan masa.')
    const f = await flagOf('graf')
    expect([f.stimulus_flag, f.stimulus_flag_ref]).toEqual(['stimulus_missing', 'unnumbered'])
  })

  it('[CI] figure_only is excluded with its own reason', async () => {
    await publish('bare', 'Sementara')
    const [st] = await q(`insert into stimuli (kind, label, alt_text) values ('image', 'Rajah 5', 'Rajah') returning id::text id`)
    await q(`insert into question_version_stimuli (question_version_id, stimulus_id, position) select id, $2, 1 from question_versions where question_id = $1`, [made.bare, st!.id])
    await q(`update question_versions set stem_ms = '' where question_id = $1`, [made.bare])
    // A bare figure imported as a question: no parts at all.
    await q(`delete from question_parts where question_version_id = (select id from question_versions where question_id = $1)`, [made.bare])
    await refresh(made.bare!)
    expect((await flagOf('bare')).stimulus_flag).toBe('figure_only')
    expect((await drawn([made.bare!], 'latih_tubi_spm')).has(made.bare!)).toBe(false)
    const r = await reasons('bare', 'latih_tubi_spm')
    expect(r.reasons.find((x) => x.code === 'figure_only')?.message).toBe('Soalan ini hanya mengandungi rangsangan. Tukarkan kepada rangsangan kumpulan.')
  })

  it('[CI] stem_duplicated is stored but the question is served on every surface', async () => {
    await publish('dup', 'Yang manakah nombor perdana?', { keepDuplicatePrompt: true })
    await q(`update question_parts set prompt_ms = 'Yang   manakah nombor perdana? ' where question_version_id = (select id from question_versions where question_id = $1)`, [made.dup])
    await q(`update question_versions set stem_ms = 'Yang manakah nombor perdana?' where question_id = $1`, [made.dup])
    await refresh(made.dup!)
    expect((await flagOf('dup')).stimulus_flag).toBe('stem_duplicated')
    expect((await drawn([made.dup!], 'latih_tubi_spm')).has(made.dup!)).toBe(true)
    for (const activity of ['latih_tubi_spm', 'databank', 'bab', 'simulasi_kuiz'] as const) {
      const codes = (await reasons('dup', activity)).reasons.map((x) => x.code)
      expect(codes, activity).not.toContain('stem_duplicated' as never)
      expect(codes, activity).not.toContain('stimulus_missing')
    }
  })

  it('[CI] attaching a group clears the flag and the question is served again', async () => {
    const passage = await svc.createStimulus({ kind: 'passage', label: 'Petikan B', bodyMs: 'Teks petikan.', bodyEn: null, altText: null, assetFileId: null })
    const groupId = await svc.createStimulusGroup({ label: 'Kumpulan', scope: 'section', stimulusIds: [passage], optionBank: [] })
    expect((await flagOf('graf')).stimulus_flag).toBe('stimulus_missing')
    await repo.setGroup(made.graf!, groupId, 1)
    expect((await flagOf('graf')).stimulus_flag).toBeNull()
    expect((await flagOf('graf')).stimulus_flag_at).toBeNull()
    await repo.setGroup(made.graf!, null, null)
    expect((await flagOf('graf')).stimulus_flag).toBe('stimulus_missing')
  })

  it('[CI] a re-detected unchanged flag keeps its dismissal; a changed or cleared flag drops it', async () => {
    const id = await publish('edit', 'Rajah 2 menunjukkan satu segi tiga.')
    await q(`update question_versions set flag_dismissed_at = now() where question_id = $1 and version_no = 1`, [id])
    const dismissed = async () => (await q(`select flag_dismissed_at is not null as d, stimulus_flag from question_versions where question_id = $1 and version_no = 1`, [id]))[0] as unknown as { d: boolean; stimulus_flag: string | null }
    expect(await refresh(id)).toBe('stimulus_missing') // same flag: the dismissal stays
    expect(await dismissed()).toMatchObject({ d: true, stimulus_flag: 'stimulus_missing' })
    await q(`update question_versions set stem_ms = 'Hitung luas segi tiga itu.' where question_id = $1 and version_no = 1`, [id])
    expect(await refresh(id)).toBeNull() // cleared
    expect(await dismissed()).toMatchObject({ d: false, stimulus_flag: null })
  })

  it('[CI] a new version written by the service (edit) is detected again', async () => {
    const id = await publish('rewrite', 'Hitung luas segi tiga itu.')
    expect((await flagOf('rewrite')).stimulus_flag).toBeNull()
    // An edit of a live question writes version 2 (`addVersion`): the detectors run on it.
    await svc.update(id, { ...mcqInput(tag, { questionText: 'Rajah 9 menunjukkan segi tiga.', tag: tagBody(tag, 3) }) } as never, admin)
    const [v2] = await q(`select stimulus_flag, stimulus_flag_ref from question_versions where question_id = $1 and version_no = 2`, [id])
    expect([v2!.stimulus_flag, v2!.stimulus_flag_ref]).toEqual(['stimulus_missing', 'numbered'])
  })

  describe('no_key and no_scheme', () => {
    it('[CI] an MCQ leaf with no answer_keys row reads no_key and leaves the draw', async () => {
      await publish('mcqNoKey', 'Soalan objektif tanpa kunci jawapan yang disimpan.')
      await q(`delete from answer_keys where part_id in (select p.id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1)`, [made.mcqNoKey])
      await publish('mcqKeyed', 'Soalan objektif dengan kunci jawapan yang disimpan.')
      for (const activity of ['latih_tubi_spm', 'databank', 'bab', 'simulasi_kuiz'] as const) {
        expect([...(await drawn([made.mcqNoKey!, made.mcqKeyed!], activity))], `${activity} draw`).toEqual([made.mcqKeyed!])
        const r = await reasons('mcqNoKey', activity)
        expect(r.served, activity).toBe(false)
        expect(r.reasons.map((x) => x.code), activity).toEqual(['no_key'])
        expect(r.reasons[0]!.message).toBe('Tiada kunci jawapan.')
      }
      expect((await reasons('mcqNoKey', 'simulasi_paper')).reasons.map((x) => x.code)).toEqual(['no_key'])
    })

    it('[CI] a non-MCQ leaf with no answer_keys row reads no_scheme', async () => {
      const struct = await svc.create(
        mcqInput(tag, {
          questionType: 'essay',
          options: undefined,
          correctAnswer: undefined,
          questionText: 'Soalan berstruktur tanpa skema pemarkahan.',
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
      expect((await reasons('structured', 'latih_tubi_spm')).reasons.map((x) => x.code)).not.toContain('no_scheme')
      await q(`delete from answer_keys where part_id = (select min(p.id) from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1 and p.mode is not null)`, [struct.id])
      for (const activity of ['latih_tubi_spm', 'databank', 'bab', 'simulasi_kuiz'] as const) {
        const r = await reasons('structured', activity)
        expect(r.reasons.map((x) => x.code), activity).toEqual(['no_scheme'])
        expect(r.reasons[0]!.message).toBe('Tiada skema — tidak disajikan.')
        expect((await drawn([struct.id], activity)).size, `${activity} draw`).toBe(0)
      }
    })
  })

  it('[CI] the indicator equals the draw outcome on 50 sampled questions (D91)', async () => {
    // 50 questions: servable, stimulus_missing (numbered and unnumbered), dismissed, stem_duplicated, no key. Deterministic stems.
    const kinds = ['plain', 'rajah', 'graf', 'dismissed', 'dup', 'nokey'] as const
    const sampled: { id: string; kind: (typeof kinds)[number] }[] = []
    for (let i = 0; i < 50; i += 1) {
      const kind = kinds[i % kinds.length]!
      const n = i + 1
      const text =
        kind === 'rajah' ? `Rajah ${n} menunjukkan satu bentuk. Nyatakan nama bentuk itu.` : kind === 'graf' ? `Graf soalan ${n} di atas menunjukkan perubahan suhu.` : `Soalan sampel nombor ${n} tentang pecahan dan perpuluhan.`
      const id = await publish(`s${n}`, text)
      sampled.push({ id, kind })
      if (kind === 'dismissed') {
        await q(`update question_versions set stimulus_flag = 'stimulus_missing', stimulus_flag_ref = 'numbered', stimulus_flag_at = now(), flag_dismissed_at = now() where question_id = $1`, [id])
      }
      if (kind === 'dup') {
        await q(`update question_parts set prompt_ms = $2 where question_version_id = (select id from question_versions where question_id = $1)`, [id, text])
        await q(`update question_versions set stem_ms = $2, stimulus_flag = 'stem_duplicated', stimulus_flag_at = now() where question_id = $1`, [id, text])
      }
      if (kind === 'nokey') {
        await q(`delete from answer_keys where part_id in (select p.id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1)`, [id])
      }
    }
    const ids = sampled.map((s) => s.id)
    const reports = await servability.reports(ids)
    let checked = 0
    for (const activity of ['latih_tubi_spm', 'databank', 'bab', 'simulasi_kuiz'] as const) {
      const draw = await drawn(ids, activity)
      for (const s of sampled) {
        const result = reports.get(s.id)!.activities.find((a) => a.activity === activity)!
        expect(result.served, `${s.kind} ${s.id} on ${activity}: ${result.reasons.map((r) => r.code).join(',')}`).toBe(draw.has(s.id))
        checked += 1
      }
    }
    expect(checked).toBe(200)
    // The expectation is not vacuous: the kinds really differ.
    const served = (kind: string) => sampled.filter((s) => s.kind === kind).every((s) => reports.get(s.id)!.activities.find((a) => a.activity === 'latih_tubi_spm')!.served)
    expect(served('plain')).toBe(true)
    expect(served('dismissed')).toBe(true)
    expect(served('dup')).toBe(true)
    expect(sampled.filter((s) => ['rajah', 'graf', 'nokey'].includes(s.kind)).some((s) => reports.get(s.id)!.activities.find((a) => a.activity === 'latih_tubi_spm')!.served)).toBe(false)
  })
})
