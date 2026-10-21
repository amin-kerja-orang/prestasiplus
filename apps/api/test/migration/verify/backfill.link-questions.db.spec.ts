/**
 * BE-30 Part C (card AC4): `linkQuestions` against a real PostgreSQL. A private migrated database with hand-inserted
 * rows; every test plants its own fictitious data with a fresh natural key, so the tests do not depend on each other.
 */
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { linkQuestions, LinkQuestionsBusyError, type LinkQuestionsReport } from '../../../src/migration/backfill/link-questions'
import { ApplyGuardError } from '../../../src/migration/kit/apply-guard'
import { contentHash } from '../../../src/migration/snapshot-dims'
import { bootBackfill, type BackfillHarness } from './helpers-backfill'

const APPLY_ENV = { NODE_ENV: 'test', PP_ALLOW_MIGRATE_APPLY: '1' }

let h: BackfillHarness
let n = 0
const key = (): string => `matematik|2023|lpm|k${(n += 1)}|sebenar`

const run = (mode: 'dry-run' | 'apply', extra: Partial<Parameters<typeof linkQuestions>[0]> = {}): Promise<LinkQuestionsReport> =>
  linkQuestions({ pool: h.pool, env: APPLY_ENV, source: 'cloud', mode, ...extra })

beforeAll(async () => {
  h = await bootBackfill()
})
afterAll(async () => {
  await h?.close()
})

describe('linkQuestions: the four AC4 cases', () => {
  it('links when exactly one question matches; ambiguous, unmatched and already-linked rows are left alone', async () => {
    const k1 = key()
    const k2 = key()
    const p1 = await h.addPaper(k1)
    const p2 = await h.addPaper(k2)
    const target = await h.addQuestion({ paperId: p1, numberLabel: '7' })
    await h.addQuestion({ paperId: p1, numberLabel: '8' })
    const dup1 = await h.addQuestion({ paperId: p2, numberLabel: '3' })
    const dup2 = await h.addQuestion({ paperId: p2, numberLabel: '3' })
    const other = await h.addQuestion({ paperId: null, numberLabel: null })
    const wouldMatch = await h.addQuestion({ paperId: p1, numberLabel: '9' })

    const one = await h.addAnswer({ naturalKey: k1, numberLabel: '7' })
    const two = await h.addAnswer({ naturalKey: k2, numberLabel: '3' })
    const none = await h.addAnswer({ naturalKey: key(), numberLabel: '1' })
    const noKey = await h.addAnswer({})
    const linked = await h.addAnswer({ naturalKey: k1, numberLabel: '9', questionId: other })

    const before = await h.protectedFingerprint()
    const alreadyBefore = (await h.q<{ n: number }>(`select count(*)::int as n from practice_answers where question_id is not null`))[0]?.n ?? 0
    const report = await run('apply')
    const links = await h.links()

    expect(links[one]).toBe(target)
    expect(links[two]).toBeNull()
    expect(links[none]).toBeNull()
    expect(links[noKey]).toBeNull()
    expect(links[linked]).toBe(other) // not the question (wouldMatch) the natural key points to
    expect(links[linked]).not.toBe(wouldMatch)
    expect([dup1, dup2]).not.toContain(links[two])

    expect(report).toMatchObject({ mode: 'apply', examined: 4, linked: 1, ambiguous: 1, unmatched: 2, alreadyLinked: alreadyBefore })
    expect(report.linkedByNaturalKey).toBe(1)
    expect(report.ambiguousIds).toEqual([two])
    expect(report.unmatchedIds.sort()).toEqual([none, noKey].sort())
    expect(await h.protectedFingerprint()).toBe(before)
  })

  it('compares natural key and number label lower-cased and trimmed, and never an empty value', async () => {
    const k = key()
    const paper = await h.addPaper(k)
    const target = await h.addQuestion({ paperId: paper, numberLabel: ' 12A ' })
    const emptyPaper = await h.addPaper(null)
    await h.addQuestion({ paperId: emptyPaper, numberLabel: '' })
    const a = await h.addAnswer({ naturalKey: `  ${k.toUpperCase()} `, numberLabel: '12a' })
    const blank = await h.addAnswer({ naturalKey: '  ', numberLabel: '  ' })
    await run('apply')
    const links = await h.links()
    expect(links[a]).toBe(target)
    expect(links[blank]).toBeNull()
  })
})

describe('linkQuestions: candidate questions', () => {
  it('only active questions whose live version is published are candidates', async () => {
    const k = key()
    const paper = await h.addPaper(k)
    await h.addQuestion({ paperId: paper, numberLabel: '1', status: 'draft', liveVersionNo: null })
    await h.addQuestion({ paperId: paper, numberLabel: '2', status: 'archived', liveVersionNo: 1 })
    await h.addQuestion({ paperId: paper, numberLabel: '3', status: 'published', isActive: false })
    await h.addQuestion({ paperId: paper, numberLabel: '4', status: 'published', liveVersionNo: 2 }) // live version is not this one
    const ok = await h.addQuestion({ paperId: paper, numberLabel: '5' })
    const ids = await Promise.all(['1', '2', '3', '4', '5'].map((l) => h.addAnswer({ naturalKey: k, numberLabel: l })))
    await run('apply')
    const links = await h.links()
    expect(ids.slice(0, 4).map((id) => links[id])).toEqual([null, null, null, null])
    expect(links[ids[4] as string]).toBe(ok)
  })

  it('falls back to the content hash only when the natural key found nothing, and uses the same recipe as BE-29', async () => {
    const stem = 'Berapakah   2 + 2 ?'
    const options = ['Satu', 'Empat', 'DUA']
    const target = await h.addQuestion({ stem: 'berapakah 2 + 2 ?', options: ['dua', 'satu', 'Empat'] })
    const hash = contentHash(stem, options) as string
    const viaHash = await h.addAnswer({ contentHash: hash })
    // The natural key has a candidate: it wins, the hash is not consulted.
    const k = key()
    const paper = await h.addPaper(k)
    const byKey = await h.addQuestion({ paperId: paper, numberLabel: '1' })
    const both = await h.addAnswer({ naturalKey: k, numberLabel: '1', contentHash: hash })
    // A natural key with candidates but none for this label does not stop the hash step.
    const keyMissHashHit = await h.addAnswer({ naturalKey: k, numberLabel: '99', contentHash: hash })
    const wrongHash = await h.addAnswer({ contentHash: contentHash('Soalan lain', []) as string })

    const report = await run('apply')
    const links = await h.links()
    expect(links[viaHash]).toBe(target)
    expect(links[both]).toBe(byKey)
    expect(links[keyMissHashHit]).toBe(target)
    expect(links[wrongHash]).toBeNull()
    expect(report.linkedByHash).toBe(2)
    expect(report.linkedByNaturalKey).toBe(1)
  })

  it('two questions with the same hash are ambiguous', async () => {
    await h.addQuestion({ stem: 'Soalan kembar', options: ['x', 'y'] })
    await h.addQuestion({ stem: 'soalan  kembar', options: ['y', 'x'] })
    const a = await h.addAnswer({ contentHash: contentHash('Soalan kembar', ['x', 'y']) as string })
    const report = await run('apply')
    expect((await h.links())[a]).toBeNull()
    expect(report.ambiguousIds).toContain(a)
  })
})

describe('linkQuestions: safety', () => {
  it('dry-run reports the same counts but changes nothing', async () => {
    const k = key()
    const paper = await h.addPaper(k)
    await h.addQuestion({ paperId: paper, numberLabel: '1' })
    const a = await h.addAnswer({ naturalKey: k, numberLabel: '1' })
    const beforeLinks = await h.links()
    const beforeFp = await h.protectedFingerprint()

    const dry = await linkQuestions({ pool: h.pool, env: {}, source: 'cloud' }) // default mode, no apply switch needed
    expect(dry.mode).toBe('dry-run')
    expect(dry.linked).toBeGreaterThanOrEqual(1)
    expect(await h.links()).toEqual(beforeLinks)
    expect(await h.protectedFingerprint()).toBe(beforeFp)

    const real = await run('apply')
    expect(real.linked).toBe(dry.linked)
    expect(real.unmatched).toBe(dry.unmatched)
    expect(real.ambiguous).toBe(dry.ambiguous)
    expect((await h.links())[a]).not.toBeNull()
  })

  it('a second apply is a no-op', async () => {
    const k = key()
    const paper = await h.addPaper(k)
    await h.addQuestion({ paperId: paper, numberLabel: '1' })
    await h.addAnswer({ naturalKey: k, numberLabel: '1' })
    const first = await run('apply')
    const afterFirst = await h.links()
    const fp = await h.protectedFingerprint()
    const second = await run('apply')
    expect(first.linked).toBeGreaterThanOrEqual(1)
    expect(second.linked).toBe(0)
    expect(second.examined).toBe(first.examined - first.linked)
    expect(second.alreadyLinked).toBe(first.alreadyLinked + first.linked)
    expect(await h.links()).toEqual(afterFirst)
    expect(await h.protectedFingerprint()).toBe(fp)
  })

  it('apply is refused without PP_ALLOW_MIGRATE_APPLY and in production without the matching target db', async () => {
    const k = key()
    const paper = await h.addPaper(k)
    await h.addQuestion({ paperId: paper, numberLabel: '1' })
    const a = await h.addAnswer({ naturalKey: k, numberLabel: '1' })
    await expect(linkQuestions({ pool: h.pool, env: {}, source: 'cloud', mode: 'apply' })).rejects.toBeInstanceOf(ApplyGuardError)
    await expect(
      linkQuestions({ pool: h.pool, env: { NODE_ENV: 'production', PP_ALLOW_MIGRATE_APPLY: '1' }, source: 'cloud', mode: 'apply' }),
    ).rejects.toBeInstanceOf(ApplyGuardError)
    expect((await h.links())[a]).toBeNull()
  })

  it('touches only the requested legacy source and never a native (non-migrated) answer', async () => {
    const k = key()
    const paper = await h.addPaper(k)
    await h.addQuestion({ paperId: paper, numberLabel: '1' })
    const mine = await h.addAnswer({ naturalKey: k, numberLabel: '1', legacySource: 'my' })
    const native = await h.addAnswer({ naturalKey: k, numberLabel: '1', legacySource: null })
    const cloud = await h.addAnswer({ naturalKey: k, numberLabel: '1' })
    await run('apply')
    const links = await h.links()
    expect(links[mine]).toBeNull()
    expect(links[native]).toBeNull()
    expect(links[cloud]).not.toBeNull()
  })

  it('batches of one give the same result and the report holds no text or hashes', async () => {
    const k = key()
    const paper = await h.addPaper(k)
    const stem = 'Teks rahsia untuk ujian pelaporan'
    await h.addQuestion({ paperId: paper, numberLabel: '1', stem, options: ['aa', 'bb'] })
    await h.addQuestion({ paperId: paper, numberLabel: '2' })
    const ids = [
      await h.addAnswer({ naturalKey: k, numberLabel: '1' }),
      await h.addAnswer({ naturalKey: k, numberLabel: '2' }),
      await h.addAnswer({ naturalKey: k, numberLabel: '3', contentHash: contentHash(stem, ['aa', 'bb']) as string }),
      await h.addAnswer({ naturalKey: key(), numberLabel: '1' }),
    ]
    const report = await run('apply', { batchSize: 1 })
    const links = await h.links()
    expect(ids.slice(0, 3).every((id) => links[id] !== null)).toBe(true)
    expect(links[ids[3] as string]).toBeNull()
    expect(report.linked).toBeGreaterThanOrEqual(3)
    const text = JSON.stringify(report)
    expect(text).not.toContain('rahsia')
    expect(text).not.toContain(contentHash(stem, ['aa', 'bb']) as string)
  })

  it('pages by numeric id: every row is examined exactly once whatever the batch size', async () => {
    const total = (await h.q<{ n: number }>(`select count(*)::int as n from practice_answers where question_id is null and legacy_source = 'cloud'`))[0]?.n ?? 0
    // Ids pass 100 here: ordering them as text ("100" before "96") would repeat or skip rows between pages.
    await h.q(`select setval(pg_get_serial_sequence('practice_answers', 'id'), 95)`).catch(() => undefined)
    for (let i = 0; i < 12; i += 1) await h.addAnswer({ naturalKey: key(), numberLabel: String(i) })
    const small = await run('dry-run', { batchSize: 2, listCap: 1000 })
    const big = await run('dry-run', { batchSize: 1000, listCap: 1000 })
    expect(small.examined).toBe(total + 12)
    expect(small.examined).toBe(big.examined)
    expect(new Set(small.unmatchedIds).size).toBe(small.unmatchedIds.length)
    expect(small.unmatchedIds.length + small.ambiguousIds.length).toBe(small.examined)
  })

  it('a row linked by another process between examine and update is skipped, reported as raced and not overwritten', async () => {
    const k = key()
    const paper = await h.addPaper(k)
    const target = await h.addQuestion({ paperId: paper, numberLabel: '1' })
    const elsewhere = await h.addQuestion({ paperId: null })
    const raced = await h.addAnswer({ naturalKey: k, numberLabel: '1' })
    const normal = await h.addAnswer({ naturalKey: k, numberLabel: '1' })
    const report = await run('apply', {
      onBeforeUpdate: async (ids) => {
        expect(ids).toContain(raced)
        await h.q(`update practice_answers set question_id = $1 where id = $2`, [elsewhere, raced])
      },
    })
    const links = await h.links()
    expect(links[raced]).toBe(elsewhere)
    expect(links[normal]).toBe(target)
    expect(report.raced).toBe(1)
    expect(report.linked).toBe(1)
  })

  it('works on a pool of one connection (the hash index uses the checked-out connection)', async () => {
    const stem = 'Soalan kolam tunggal'
    const target = await h.addQuestion({ stem, options: ['p', 'q'] })
    const a = await h.addAnswer({ contentHash: contentHash(stem, ['p', 'q']) as string })
    const one = new pg.Pool({ connectionString: h.env.db.url, max: 1 })
    try {
      const dry = await linkQuestions({ pool: one, env: {}, source: 'cloud' })
      expect(dry.linkedByHash).toBeGreaterThanOrEqual(1)
      expect((await h.links())[a]).toBeNull()
      await linkQuestions({ pool: one, env: APPLY_ENV, source: 'cloud', mode: 'apply' })
      expect((await h.links())[a]).toBe(target)
    } finally {
      await one.end()
    }
  })

  it('apply is refused while another backfill holds the advisory lock, and works again once it is released', async () => {
    const k = key()
    const paper = await h.addPaper(k)
    await h.addQuestion({ paperId: paper, numberLabel: '1' })
    const a = await h.addAnswer({ naturalKey: k, numberLabel: '1' })
    const other = await h.pool.connect()
    try {
      await other.query(`select pg_advisory_lock(hashtextextended('etl:link-questions:cloud', 0))`)
      await expect(run('apply')).rejects.toBeInstanceOf(LinkQuestionsBusyError)
      expect((await h.links())[a]).toBeNull()
      // A dry-run takes no lock and is not refused.
      await expect(run('dry-run')).resolves.toMatchObject({ mode: 'dry-run' })
      await other.query(`select pg_advisory_unlock(hashtextextended('etl:link-questions:cloud', 0))`)
    } finally {
      other.release()
    }
    await run('apply')
    expect((await h.links())[a]).not.toBeNull()
    // The lock was released by the finished run: it can be taken again.
    const again = await h.q<{ ok: boolean }>(`select pg_try_advisory_lock(hashtextextended('etl:link-questions:cloud', 0)) as ok`)
    expect(again[0]?.ok).toBe(true)
    await h.q(`select pg_advisory_unlock_all()`)
  })

  it('apply is refused while etl_runs has a running apply run for the source', async () => {
    const k = key()
    const paper = await h.addPaper(k)
    await h.addQuestion({ paperId: paper, numberLabel: '1' })
    const a = await h.addAnswer({ naturalKey: k, numberLabel: '1' })
    const run1 = await h.q<{ id: string }>(
      `insert into etl_runs (mode, sources, status) values ('apply', ARRAY['cloud'], 'running') returning id::text as id`,
    )
    const id = run1[0]?.id as string
    try {
      await expect(run('apply')).rejects.toBeInstanceOf(LinkQuestionsBusyError)
      expect((await h.links())[a]).toBeNull()
      // A running run of another source, or a finished one, does not block.
      await h.q(`update etl_runs set sources = ARRAY['my'] where id = $1`, [id])
      await run('apply')
      expect((await h.links())[a]).not.toBeNull()
      await h.q(`update etl_runs set sources = ARRAY['cloud'], status = 'succeeded' where id = $1`, [id])
      await expect(run('apply')).resolves.toMatchObject({ linked: 0 })
    } finally {
      await h.q(`delete from etl_runs where id = $1`, [id])
    }
  })

  it('caps the listed ids but keeps the counts', async () => {
    const before = (await run('dry-run')).unmatched
    for (let i = 0; i < 3; i += 1) await h.addAnswer({ naturalKey: key(), numberLabel: String(i) })
    const report = await run('dry-run', { listCap: 2 })
    expect(report.unmatched).toBe(before + 3)
    expect(report.unmatchedIds).toHaveLength(2)
  })

  it('validates its options and sanitises database errors', async () => {
    await expect(run('dry-run', { batchSize: 0 })).rejects.toBeInstanceOf(RangeError)
    await expect(linkQuestions({ pool: h.pool, env: {}, source: 'nope' as never })).rejects.toBeInstanceOf(RangeError)
    const broken = { ...h.pool, connect: h.pool.connect.bind(h.pool), query: () => Promise.reject(Object.assign(new Error('secret value (x@y.z)'), { code: '42P01', severity: 'ERROR', table: 't' })) }
    const err = await linkQuestions({ pool: broken as never, env: {}, source: 'cloud' }).catch((e: unknown) => e)
    expect(String((err as Error).message)).toContain('SQLSTATE 42P01')
    expect(String((err as Error).message)).not.toContain('secret')
  })
})
