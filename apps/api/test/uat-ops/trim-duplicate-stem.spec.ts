import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { apply, BACKUP_TABLE, dryRun, findMatches, formatReport, parseArgs, restore } from '../../scripts/uat-ops/trim-duplicate-stem'
import { toPracticeQuestion } from '../../src/modules/practice/question-bridge/be09-practice-mapping'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { flatFromVersion } from '../../src/modules/questions/projection'
import { checkStemGate } from '../../src/modules/questions/publish-gate'
import { gateDataOf } from '../../src/modules/questions/gate-data'
import { GATES } from '../../src/modules/questions/workflow/lifecycle/gates'
import { adminActor, mcqInput, tagOf, type Tag } from '../questions/fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from '../questions/helpers'

/**
 * S4-T04 part 1 (U-OP-06, FR-ADM-G7.6, DM-40): the trim-duplicate-stem script on a migrated, seeded database. Fixtures are
 * inserted by SQL with a unique label per case; the assertions name those parts, and a whole-table snapshot proves that
 * nothing else changes (and that restore returns every row exactly).
 */
describe('trim-duplicate-stem (S4-T04, U-OP-06)', () => {
  let t: QuestionsTestApp
  let client: pg.Client
  let subjectId: string
  let levelId: string
  let n = 0

  beforeAll(async () => {
    t = await bootQuestionsApp()
    client = new pg.Client({ connectionString: t.db.url })
    await client.connect()
    const tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    subjectId = tag.subjectId
    levelId = tag.levelId
  })
  afterAll(async () => {
    await client.end()
    await t.close()
  })

  /** One question with `prompts.length` root leaves. Returns the question id and the part ids in order. */
  async function question(o: { stem: string | null; stemEn?: string | null; prompts: string[]; promptsEn?: (string | null)[]; versions?: { latest: number; no: number } }): Promise<{ q: string; v: string; parts: string[] }> {
    const label = `TRIM-${String(++n)}`
    const no = o.versions?.no ?? 1
    const latest = o.versions?.latest ?? 1
    const archived = no < latest
    const q = (await t.db.query<{ id: string }>(`insert into questions (source_type, latest_version_no) values ('manual', $1) returning id::text`, [latest]))[0]!.id
    const v = (
      await t.db.query<{ id: string }>(
        `insert into question_versions (question_id, version_no, status, archive_reason, type, stem_ms, stem_en, subject_id, education_level_id, number_label)
         values ($1::bigint, $2, $3, $4, 'short', $5, $6, $7::bigint, $8::bigint, $9) returning id::text`,
        [q, no, archived ? 'archived' : 'draft', archived ? 'superseded' : null, o.stem, o.stemEn ?? null, subjectId, levelId, label],
      )
    )[0]!.id
    const parts: string[] = []
    for (const [i, prompt] of o.prompts.entries()) {
      parts.push(
        (
          await t.db.query<{ id: string }>(
            `insert into question_parts (question_version_id, position, depth, label, prompt_ms, prompt_en, marks, mode) values ($1::bigint, $2, 1, $3, $4, $5, 1, 'short_text') returning id::text`,
            [v, i + 1, String(i + 1), prompt, o.promptsEn?.[i] ?? null],
          )
        )[0]!.id,
      )
    }
    return { q, v, parts }
  }

  const prompts = async (ids: string[]): Promise<{ id: string; ms: string; en: string | null }[]> =>
    t.db.query(`select id::text, prompt_ms ms, prompt_en en from question_parts where id = any($1::bigint[]) order by id`, [ids.map(Number)])
  const snapshot = async (): Promise<string> =>
    JSON.stringify(await t.db.query(`select to_jsonb(p) j from question_parts p order by id`))
  const backupExists = async (): Promise<boolean> => (await t.db.query<{ t: string | null }>(`select to_regclass('${BACKUP_TABLE}')::text t`))[0]!.t !== null

  it('a dry run changes nothing and creates nothing; the report holds counts and ids only', async () => {
    const match = await question({ stem: '  Hitung   luas ', prompts: ['Hitung luas'] })
    const before = await snapshot()
    const report = await dryRun(client)
    expect(report.mode).toBe('dry-run')
    expect(report.matched).toBeGreaterThanOrEqual(1)
    expect(report.bySubjectLevel.reduce((s, c) => s + c.count, 0)).toBe(report.matched)
    expect(report.sample.every((s) => /^\d+$/.test(s.questionId) && /^\d+$/.test(s.partId))).toBe(true)
    const text = formatReport(report, 'x').join('\n')
    expect(text).not.toContain('Hitung')
    expect(await snapshot()).toBe(before)
    expect(await backupExists()).toBe(false)
    expect((await prompts(match.parts))[0]!.ms).toBe('Hitung luas')
  })

  it('apply trims only matching latest single-leaf rows (BM normalisation, EN rule); older versions, multi-leaf, other text are untouched', async () => {
    const exact = await question({ stem: 'Apakah ibu negara?', prompts: ['Apakah ibu negara?'] })
    const spaced = await question({ stem: '  Hitung   luas\tsegi tiga. ', prompts: ['Hitung luas\nsegi tiga.'] })
    const enBoth = await question({ stem: 'Soalan dua', stemEn: 'What is it?', prompts: ['Soalan dua'], promptsEn: ['What  is it? '] })
    const enStemOnly = await question({ stem: 'Soalan tiga', stemEn: 'Question three', prompts: ['Soalan tiga'] })
    const enPromptOnly = await question({ stem: 'Soalan empat', prompts: ['Soalan empat'], promptsEn: ['Only English prompt'] })
    const enDiffers = await question({ stem: 'Soalan lima', stemEn: 'Question five', prompts: ['Soalan lima'], promptsEn: ['Other words'] })
    const caseDiffers = await question({ stem: 'Soalan Enam', prompts: ['soalan enam'] })
    const different = await question({ stem: 'Soalan tujuh', prompts: ['Soalan tujuh lagi'] })
    const multi = await question({ stem: 'Soalan lapan', prompts: ['Soalan lapan', 'b'] })
    const emptyStem = await question({ stem: '   ', prompts: ['   '] })
    const nullStem = await question({ stem: null, stemEn: 'English stem only', prompts: ['Tiada stem'] })
    const alreadyEmpty = await question({ stem: 'Soalan sembilan', prompts: [''] })
    const olderOnly = await question({ stem: 'Soalan sepuluh', prompts: ['Soalan sepuluh'], versions: { latest: 2, no: 1 } })
    const latestDiffers = await question({ stem: 'Soalan sepuluh baru', prompts: ['Prompt lain'], versions: { latest: 2, no: 2 } })
    const untouched = [enDiffers, caseDiffers, different, multi, emptyStem, nullStem, alreadyEmpty, olderOnly, latestDiffers]

    const parts = (...qs: { parts: string[] }[]): string[] => qs.flatMap((x) => x.parts)
    const beforeUntouched = await prompts(parts(...untouched))
    const beforeAll = JSON.parse(await snapshot()) as { j: { id: number; prompt_ms: string; prompt_en: string | null } }[]

    // The EN rule: enPromptOnly (BM matches, English exists on one side only) still trims.
    const expectTrimmed = [exact, spaced, enBoth, enStemOnly, enPromptOnly]
    const expectKept = [enDiffers, caseDiffers, different, multi, emptyStem, nullStem, alreadyEmpty, olderOnly, latestDiffers]
    const dry = await findMatches(client, 10_000)
    const dryIds = new Set(dry.sample.map((s) => s.partId))
    for (const q of expectTrimmed) expect(dryIds.has(q.parts[0]!)).toBe(true)
    for (const q of expectKept) for (const p of q.parts) expect(dryIds.has(p)).toBe(false)

    const lines: string[] = []
    const report = await apply(client, { batchSize: 2, sample: 5 }, (l) => lines.push(l))
    expect(report.mode).toBe('apply')
    expect(report.matched).toBe(dry.matched)
    expect(report.batches).toBe(Math.ceil(dry.matched / 2))
    expect(await backupExists()).toBe(true)

    expect((await prompts(parts(exact, spaced, enBoth, enStemOnly, enPromptOnly))).map((p) => p.ms)).toEqual(['', '', '', '', ''])
    // English: trimmed (NULL) only when the pair existed on both sides and matched; otherwise kept.
    expect((await prompts(enBoth.parts))[0]!.en).toBeNull()
    expect((await prompts(enPromptOnly.parts))[0]!.en).toBe('Only English prompt')
    // Stems are never touched.
    expect((await t.db.query<{ stem_ms: string }>(`select stem_ms from question_versions where id = $1::bigint`, [exact.v]))[0]!.stem_ms).toBe('Apakah ibu negara?')
    expect(await prompts(parts(...untouched))).toEqual(beforeUntouched)

    // Every changed part in the table is a part that matched by an independent JS reading of the rule.
    const after = JSON.parse(await snapshot()) as typeof beforeAll
    const changed = after.filter((a, i) => JSON.stringify(a) !== JSON.stringify(beforeAll[i]))
    expect(changed.length).toBe(dry.matched)
    expect(changed.every((c) => c.j.prompt_ms === '')).toBe(true)

    // Backup: one row per trimmed part with the old values, in the same run.
    const bk = await t.db.query<{ part_id: string; old_prompt_ms: string; old_prompt_en: string | null }>(`select part_id::text, old_prompt_ms, old_prompt_en from ${BACKUP_TABLE} order by part_id`)
    expect(bk.length).toBe(dry.matched)
    expect(bk.find((r) => r.part_id === enBoth.parts[0])).toMatchObject({ old_prompt_ms: 'Soalan dua', old_prompt_en: 'What  is it? ' })
    expect(bk.find((r) => r.part_id === spaced.parts[0])!.old_prompt_ms).toBe('Hitung luas\nsegi tiga.')
  })

  it('a second apply is a no-op (nothing matches, no new backup row, no batch)', async () => {
    const rowsBefore = Number((await t.db.query<{ n: string }>(`select count(*) n from ${BACKUP_TABLE}`))[0]!.n)
    const before = await snapshot()
    const again = await apply(client, { batchSize: 5000, sample: 5 })
    expect(again).toMatchObject({ matched: 0, batches: 0, bySubjectLevel: [] })
    expect(await snapshot()).toBe(before)
    expect(Number((await t.db.query<{ n: string }>(`select count(*) n from ${BACKUP_TABLE}`))[0]!.n)).toBe(rowsBefore)
  })

  it('restore returns every row exactly; a part edited after the trim is skipped, not overwritten; a second restore is a no-op', async () => {
    const trimmedSnapshot = await snapshot()
    const edited = (await t.db.query<{ part_id: string }>(`select part_id::text from ${BACKUP_TABLE} order by id limit 1`))[0]!.part_id
    await t.db.query(`update question_parts set prompt_ms = 'ditulis semula' where id = $1::bigint`, [edited])

    const report = await restore(client, { batchSize: 2 })
    expect(report.skipped).toBe(1)
    expect(report.restored).toBe(Number((await t.db.query<{ n: string }>(`select count(*) n from ${BACKUP_TABLE}`))[0]!.n) - 1)
    expect((await prompts([edited]))[0]!.ms).toBe('ditulis semula')
    expect(trimmedSnapshot).not.toBe(await snapshot())

    // Put the trimmed value back by hand, then restore: that last part comes back.
    await t.db.query(`update question_parts set prompt_ms = '' where id = $1::bigint`, [edited])
    expect(await restore(client, { batchSize: 5000 })).toMatchObject({ restored: 1, skipped: 0 })
    expect(await restore(client, { batchSize: 5000 })).toMatchObject({ restored: 0, skipped: 0, batches: 0 })
  })

  it('apply then restore on a fresh set returns the parts exactly (prompt_ms and prompt_en), then apply again works', async () => {
    const a = await question({ stem: 'Soalan satu', stemEn: 'One', prompts: ['  Soalan   satu '], promptsEn: ['One'] })
    const b = await question({ stem: 'Soalan dua belas', prompts: ['Soalan dua belas'] })
    const before = await snapshot()
    // Earlier tests restored their own rows too, so the count is relative: every match of the table, these two included.
    const expected = (await findMatches(client)).matched
    expect(expected).toBeGreaterThanOrEqual(2)
    expect((await apply(client)).matched).toBe(expected)
    expect((await prompts([...a.parts, ...b.parts])).map((p) => [p.ms, p.en])).toEqual([['', null], ['', null]])
    expect(await restore(client)).toMatchObject({ restored: expected, skipped: 0 })
    expect(await snapshot()).toBe(before)
    expect((await apply(client)).matched).toBe(expected)
  })

  it('refuses a write without the explicit flag, and flags that exclude each other', () => {
    expect(parseArgs([])).toEqual({ mode: 'dry-run', batchSize: 5000, sample: 10 })
    expect(parseArgs(['--dry-run']).mode).toBe('dry-run')
    expect(parseArgs(['--apply', '--batch-size=100'])).toMatchObject({ mode: 'apply', batchSize: 100 })
    expect(parseArgs(['--restore']).mode).toBe('restore')
    expect(() => parseArgs(['--apply', '--restore'])).toThrow(/exclude each other/)
    expect(() => parseArgs(['--dry-run', '--apply'])).toThrow(/exclude each other/)
    expect(() => parseArgs(['--batch-size=0'])).toThrow(/integer/)
    expect(() => parseArgs(['--yes'])).toThrow(/unknown/)
  })

  it('restore without a backup table fails clearly', async () => {
    const db = new pg.Client({ connectionString: t.db.url })
    await db.connect()
    try {
      await db.query(`drop table if exists ${BACKUP_TABLE}`)
      await expect(restore(db)).rejects.toThrow(/does not exist/)
    } finally {
      await db.end()
    }
  })

  /** 45 section 1.x line 444: a question whose leaf prompt was trimmed to '' still shows its text once and still passes the gate. */
  describe('45:444 condition: an empty leaf prompt still shows the text once and passes the gate', () => {
    let svc: QuestionsService
    let repo: QuestionsRepository
    let tag: Tag
    const TEXT = 'Antara yang berikut, yang manakah ibu negara Malaysia?'

    beforeAll(async () => {
      svc = t.app.get(QuestionsService)
      repo = t.app.get(QuestionsRepository)
      tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    })

    it('practice rendering, the flat view and the submit and approve gates are the same before and after the trim', async () => {
      const created = await svc.create(mcqInput(tag, { questionText: TEXT }), await adminActor(t.db))
      // Make the duplicate explicit whatever the create path stores: stem = the only leaf prompt.
      await t.db.query(`update question_versions set stem_ms = $2 where question_id = $1::bigint`, [created.id, TEXT])
      await t.db.query(`update question_parts set prompt_ms = $2 where question_version_id in (select id from question_versions where question_id = $1::bigint)`, [created.id, `  ${TEXT}`])

      const read = async () => {
        const record = (await repo.get(created.id, 'latest'))!
        const facts = await repo.gateFacts(record.id, record.version.versionNo)
        const spmBound = await repo.isSpmBound(record.version.subjectId, record.version.educationLevelId)
        const data = gateDataOf({ id: record.id, version: record.version }, facts, spmBound)
        return {
          record,
          practice: toPracticeQuestion(record, null)?.questionText,
          flat: flatFromVersion(record.version).questionText,
          submit: GATES.submit(data),
          approve: GATES.approve(data),
          stemGate: checkStemGate(data.stem, data.parts),
          required: data.missingRequiredFields,
        }
      }

      const before = await read()
      expect(before.record.version.parts[0]!.prompt.ms.trim()).toBe(TEXT) // the duplicate really is there
      // Before the trim the practice mapping shows the text TWICE (stem, then the same leaf prompt): the defect U-OP-06 removes.
      expect(before.practice!.split(TEXT).length - 1).toBe(2)

      await apply(client)
      const after = await read()
      expect(after.record.version.parts[0]!.prompt.ms).toBe('') // trimmed
      expect(after.practice).toBe(TEXT) // shown once, not twice, not empty
      expect(after.practice!.split(TEXT).length - 1).toBe(1)
      expect(after.flat).toBe(TEXT)
      expect(after.required).toEqual([]) // hasText: the stem counts, so no REQUIRED_FIELD / questionText item
      expect(after.stemGate).toEqual({})
      expect(after.submit).toEqual(before.submit) // the same gate result as before the trim, whatever the tag facts are
      expect(after.approve).toEqual(before.approve)
      expect(Object.keys(after.submit)).not.toContain('questionText')
      expect(Object.keys(after.approve)).not.toContain('questionText')
    })
  })
})
