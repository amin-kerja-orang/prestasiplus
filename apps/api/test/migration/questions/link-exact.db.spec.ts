/**
 * `linkQuestions` step 0 (QLOAD): a migrated answer whose `legacy_question_ref` is in the `etl_id_map` of the loaded
 * questions is linked exactly, before the natural-key and hash steps. Synthetic rows.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { linkQuestions, type LinkQuestionsReport } from '../../../src/migration/backfill/link-questions'
import { contentHash } from '../../../src/migration/snapshot-dims'
import { bootBackfill, type BackfillHarness } from '../verify/helpers-backfill'

const ENV = { NODE_ENV: 'test', PP_ALLOW_MIGRATE_APPLY: '1' }
let h: BackfillHarness
const run = (mode: 'dry-run' | 'apply'): Promise<LinkQuestionsReport> => linkQuestions({ pool: h.pool, env: ENV, source: 'cloud', mode })

/** A question as `migrate:questions` leaves it: the id map entry for `legacyId` and the answer's reference. */
async function mapped(legacyId: string, opts: { isActive?: boolean; stem?: string } = {}): Promise<string> {
  const id = await h.addQuestion({ stem: opts.stem, isActive: opts.isActive, options: ['Satu', 'Dua', 'Tiga', 'Empat'] })
  await h.q(`insert into etl_id_map (legacy_source, entity, legacy_id, new_id) values ('cloud', 'questions', $1, $2)`, [legacyId, id])
  return id
}
const answerFor = async (ref: string, extra: { naturalKey?: string; numberLabel?: string; contentHash?: string } = {}): Promise<string> => {
  const id = await h.addAnswer(extra)
  await h.q(`update practice_answers set legacy_question_ref = $2 where id = $1`, [id, ref])
  return id
}

beforeAll(async () => {
  h = await bootBackfill()
}, 120_000)
afterAll(async () => {
  await h?.close()
})

describe('linkQuestions: the exact step', () => {
  it('links by the id map first; a held, unmapped or already linked answer is left to the other steps or untouched', async () => {
    const q1 = await mapped('9001')
    const q2 = await mapped('9002')
    const held = await mapped('9003', { isActive: false })
    const a1 = await answerFor('9001')
    const a2 = await answerFor('9002')
    const aHeld = await answerFor('9003')
    const aNone = await answerFor('424242')
    const aLinked = await h.addAnswer({ questionId: q1 })
    await h.q(`update practice_answers set legacy_question_ref = '9002' where id = $1`, [aLinked])

    const dry = await run('dry-run')
    expect(dry).toMatchObject({ linked: 2, linkedByExact: 2, linkedByNaturalKey: 0, linkedByHash: 0, alreadyLinked: 1 })
    expect(Object.values(await h.links()).filter((v) => v !== null)).toHaveLength(1) // dry-run wrote nothing

    const report = await run('apply')
    expect(report).toMatchObject({ linked: 2, linkedByExact: 2, ambiguous: 0 })
    const links = await h.links()
    expect(links[a1]).toBe(q1)
    expect(links[a2]).toBe(q2)
    expect(links[aHeld]).toBeNull() // the question is held (inactive): never linked
    expect(links[aNone]).toBeNull()
    expect(links[aLinked]).toBe(q1) // never overwritten
    expect(held).not.toBe(q1)
  })

  it('the exact link wins over a different natural-key match and settles a duplicate text the hash would call ambiguous', async () => {
    const stem = 'Soalan kembar untuk padanan tepat'
    const twinA = await mapped('9101', { stem })
    const twinB = await mapped('9102', { stem })
    const paper = await h.addPaper('matematik|2024|lpm|k1|sebenar')
    const keyed = await h.addQuestion({ paperId: paper, numberLabel: '5' })
    const hash = contentHash(stem, ['Satu', 'Dua', 'Tiga', 'Empat'])
    const exactB = await answerFor('9102', { contentHash: hash ?? undefined })
    const wouldKey = await answerFor('9101', { naturalKey: 'matematik|2024|lpm|k1|sebenar', numberLabel: '5' })
    const hashOnly = await h.addAnswer({ contentHash: hash ?? undefined })
    await h.q(`update practice_answers set legacy_question_ref = 'tiada' where id = $1`, [hashOnly])

    const report = await run('apply')
    expect(report.linkedByExact).toBe(2)
    expect(report.ambiguous).toBe(1) // the answer without a map entry still hits two twins by hash
    const links = await h.links()
    expect(links[exactB]).toBe(twinB)
    expect(links[wouldKey]).toBe(twinA)
    expect(links[wouldKey]).not.toBe(keyed)
    expect(links[hashOnly]).toBeNull()
  })
})
