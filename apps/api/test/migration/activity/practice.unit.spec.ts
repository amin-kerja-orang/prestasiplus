/**
 * Practice, exam and wallet transforms and the snapshot-dims pure functions (BE-29 Part A), no database.
 * Values are fictitious; ids are surrogate.
 */
import { describe, expect, it } from 'vitest'

import { transformExamAttempt, parseScore, parseSectionScores, snapshotTitle, EXAM_FALLBACK_TITLE } from '../../../src/migration/transform/exam'
import {
  parseClientUuid,
  transformAnswer,
  transformSession,
  type AnswerRefs,
} from '../../../src/migration/transform/practice'
import {
  ledgerSignOk,
  transformLedger,
  transformWallet,
  walletDriftKinds,
} from '../../../src/migration/transform/wallet'
import { contentHash, normaliseText } from '../../../src/migration/snapshot-dims/content-hash'
import { mapQuestionType, parseDifficulty, resolveSnapshot, type DimMaps, type RawDims } from '../../../src/migration/snapshot-dims/dims'

const session = (over: Record<string, string | null> = {}) => ({
  id: '1', user_id: '1', subject_id: '1', mode: 'latih_tubi', paper: 'paper1', client_uuid: null,
  total_questions: '10', correct: '4', duration_seconds: '300', syiling_earned: '2',
  started_at: '2026-01-01 00:00:00+00', created_at: '2026-01-01 00:00:00+00', updated_at: null, ...over,
})

describe('transformSession', () => {
  const refs = { userId: '9', subjectId: '5' as string | null | undefined }

  it('maps a completed session', () => {
    const out = transformSession(session(), refs, null)
    expect(out.ok && out.value).toMatchObject({
      user_id: '9', subject_id: '5', mode: 'latih_tubi', question_count: 10, correct_count: 4, time_spent_sec: 300,
      coins_earned: 2, points_earned: 0, status: 'completed', legacy_paper: 'paper1', question_set_id: null, completed_at: null,
    })
  })

  it('rejects spm and battle as UNKNOWN_ENUM (Q5) and never defaults the mode', () => {
    for (const mode of ['spm', 'battle', 'mod_baru']) {
      const out = transformSession(session({ mode }), refs, null)
      expect(out).toMatchObject({ ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'mode' } })
    }
  })

  it('rejects an unloaded user or subject, correct > total and bad numbers', () => {
    expect(transformSession(session(), { userId: undefined, subjectId: null }, null)).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT', column: 'user_id' } })
    expect(transformSession(session(), { userId: '9', subjectId: undefined }, null)).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT', column: 'subject_id' } })
    expect(transformSession(session({ correct: '11' }), refs, null)).toMatchObject({ ok: false, reject: { reason: 'INVALID_VALUE', column: 'correct' } })
    expect(transformSession(session({ total_questions: '-1' }), refs, null)).toMatchObject({ ok: false, reject: { column: 'total_questions' } })
    expect(transformSession(session({ total_questions: '99999' }), refs, null)).toMatchObject({ ok: false, reject: { column: 'total_questions' } })
    expect(transformSession(session({ started_at: null }), refs, null)).toMatchObject({ ok: false, reject: { column: 'started_at' } })
  })

  it('treats blank counters as zero and a blank subject as none', () => {
    const out = transformSession(session({ correct: null, duration_seconds: null, syiling_earned: null }), { userId: '9', subjectId: null }, null)
    expect(out.ok && out.value).toMatchObject({ correct_count: 0, time_spent_sec: 0, coins_earned: 0, subject_id: null })
  })
})

describe('parseClientUuid', () => {
  it('keeps a uuid lower-case, nulls a blank and flags an invalid value', () => {
    expect(parseClientUuid('00000000-0000-0000-0000-00000000000A')).toEqual({ value: '00000000-0000-0000-0000-00000000000a', invalid: false })
    expect(parseClientUuid(' ')).toEqual({ value: null, invalid: false })
    expect(parseClientUuid('not-a-uuid')).toEqual({ value: null, invalid: true })
  })
})

describe('transformAnswer', () => {
  const dims = resolveSnapshot(undefined, emptyMaps(), '7')
  const refs = (over: Partial<AnswerRefs> = {}): AnswerRefs => ({
    userId: '9', sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', clientUuid: null, sessionStartedAt: '2026-01-01 00:00:00+00', dims, ...over,
  })
  const attempt = (over: Record<string, string | null> = {}) => ({
    id: '1', user_id: '1', practice_session_id: '1', question_id: '31337', selected_option: 'b', is_correct: '1',
    time_seconds: '12', created_at: '2026-01-01 00:00:05+00', ...over,
  })

  it('builds a historical snapshot row without a question link', () => {
    const out = transformAnswer(attempt(), refs())
    expect(out.ok && out.value).toMatchObject({
      question_id: null, historical: true, subject_id: '7', selected_label: 'B', is_correct: true, time_seconds: 12,
      legacy_question_ref: '31337', answered_at: '2026-01-01 00:00:05+00',
    })
  })

  it('rejects labels outside A-H, unreadable correctness and negative time', () => {
    expect(transformAnswer(attempt({ selected_option: 'Z' }), refs())).toMatchObject({ ok: false, reject: { reason: 'INVALID_VALUE', column: 'selected_option' } })
    expect(transformAnswer(attempt({ selected_option: '12' }), refs())).toMatchObject({ ok: false })
    expect(transformAnswer(attempt({ is_correct: null }), refs())).toMatchObject({ ok: false, reject: { column: 'is_correct' } })
    expect(transformAnswer(attempt({ is_correct: 'maybe' }), refs())).toMatchObject({ ok: false, reject: { column: 'is_correct' } })
    expect(transformAnswer(attempt({ time_seconds: '-3' }), refs())).toMatchObject({ ok: false, reject: { column: 'time_seconds' } })
  })

  it('allows a blank selection, an attempt without a session, and rejects an unloaded session or user', () => {
    expect(transformAnswer(attempt({ selected_option: null }), refs())).toMatchObject({ ok: true, value: { selected_label: null } })
    expect(transformAnswer(attempt(), refs({ sessionId: null }))).toMatchObject({ ok: true, value: { session_id: null } })
    expect(transformAnswer(attempt(), refs({ sessionId: undefined }))).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT', column: 'practice_session_id' } })
    expect(transformAnswer(attempt(), refs({ userId: undefined }))).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT', column: 'user_id' } })
  })

  it('passes an unknown dimension through as the reject', () => {
    const bad = resolveSnapshot(undefined, emptyMaps(), null)
    expect(transformAnswer(attempt(), refs({ dims: bad }))).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT', column: 'subject_id' } })
  })
})

function emptyMaps(over: Partial<DimMaps> = {}): DimMaps {
  return { subjects: new Map(), levels: new Map(), chapters: new Map(), topics: new Map(), ...over }
}

describe('snapshot dims', () => {
  const raw = (over: Partial<RawDims> = {}): RawDims => ({
    legacyQuestionId: '1', subjectId: '1', levelId: '1', chapterId: '1', topicId: '1', difficultyRaw: '3', typeRaw: 'objektif',
    contentHash: 'abc', sourceNaturalKey: 'k-2025-1', numberLabel: '4', ...over,
  })
  const maps = emptyMaps({
    subjects: new Map([['1', '11']]), levels: new Map([['1', '21']]), chapters: new Map([['1', '31']]), topics: new Map([['1', '41']]),
  })

  it('resolves every dimension through the id maps', () => {
    const out = resolveSnapshot(raw(), maps, '99')
    expect(out.ok && out.value).toMatchObject({
      subject_id: '11', education_level_id: '21', chapter_id: '31', topic_id: '41', difficulty: 3, question_type: 'mcq',
      legacy_content_hash: 'abc', source_natural_key: 'k-2025-1', number_label: '4', notes: [],
    })
  })

  it('uses the session subject only when the question has none', () => {
    expect(resolveSnapshot(raw({ subjectId: null }), maps, '99')).toMatchObject({ ok: true, value: { subject_id: '99' } })
    expect(resolveSnapshot(undefined, maps, '99')).toMatchObject({ ok: true, value: { subject_id: '99', notes: ['question_not_in_archive'] } })
    expect(resolveSnapshot(raw({ subjectId: null }), maps, null)).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT', column: 'subject_id' } })
  })

  it('rejects a set but unloaded curriculum id instead of falling back', () => {
    expect(resolveSnapshot(raw({ subjectId: '5' }), maps, '99')).toMatchObject({ ok: false, reject: { column: 'subject_id' } })
    expect(resolveSnapshot(raw({ chapterId: '5' }), maps, '99')).toMatchObject({ ok: false, reject: { column: 'chapter_id' } })
    expect(resolveSnapshot(raw({ topicId: '5' }), maps, '99')).toMatchObject({ ok: false, reject: { column: 'topic_id' } })
    expect(resolveSnapshot(raw({ levelId: '5' }), maps, '99')).toMatchObject({ ok: false, reject: { column: 'education_level_id' } })
  })

  it('keeps difficulty on the raw 1-5 scale and notes anything else', () => {
    expect(parseDifficulty('1')).toBe(1)
    expect(parseDifficulty(' 5 ')).toBe(5)
    for (const v of ['0', '6', 'mudah', '', null, '2.5']) expect(parseDifficulty(v as string | null)).toBeNull()
    expect(resolveSnapshot(raw({ difficultyRaw: 'mudah', typeRaw: 'esei' }), maps, null)).toMatchObject({
      ok: true, value: { difficulty: null, question_type: null, notes: ['difficulty_unparsed', 'question_type_unmapped'] },
    })
  })

  it('maps the question type explicitly', () => {
    expect(mapQuestionType('Objektif')).toBe('mcq')
    expect(mapQuestionType('mcq')).toBe('mcq')
    expect(mapQuestionType('lain')).toBeNull()
    expect(mapQuestionType(null)).toBeNull()
  })
})

describe('content hash', () => {
  it('is a stable SHA-256 of the normalised stem and sorted options', () => {
    const a = contentHash('  Berapakah   1 + 1? ', ['Dua', 'Tiga', 'EMPAT'])
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(contentHash('berapakah 1 + 1?', ['empat', 'dua', 'tiga'])).toBe(a)
    expect(contentHash('berapakah 1 + 1?', ['empat', 'dua'])).not.toBe(a)
    expect(contentHash('lain', ['empat', 'dua', 'tiga'])).not.toBe(a)
  })

  it('has no hash when there is no text, and never contains the text', () => {
    expect(contentHash(null, [])).toBeNull()
    expect(contentHash('   ', [' '])).toBeNull()
    expect(contentHash('SENTINEL_FREE_TEXT', ['SENTINEL_FREE_TEXT'])).not.toMatch(/sentinel/i)
    expect(normaliseText('Á  B')).toBe('á b')
  })
})

describe('transformWallet', () => {
  const wallet = (over: Record<string, string | null> = {}) => ({
    id: '1', user_id: '1', syiling_balance: '10', syiling_lifetime: '20', streak_days: '1', gamification_tier_id: '1',
    created_at: '2026-01-01 00:00:00+00', updated_at: null, ...over,
  })
  const refs = { userId: '9', isStudent: true, tierId: '3' as string | null | undefined }

  it('keeps the .cloud balance and lifetime as they are', () => {
    const out = transformWallet(wallet({ syiling_balance: '999', syiling_lifetime: '5' }), refs)
    expect(out.ok && out.value).toMatchObject({ current_syiling: 999, total_syiling_earned: 5, token_balance: 0, xp: 0, level: 1, tier_id: '3' })
  })

  it('rejects a negative or blank balance, a non-student and an unloaded tier or user', () => {
    expect(transformWallet(wallet({ syiling_balance: '-1' }), refs)).toMatchObject({ ok: false, reject: { reason: 'INVALID_VALUE', column: 'syiling_balance' } })
    expect(transformWallet(wallet({ syiling_balance: null }), refs)).toMatchObject({ ok: false, reject: { column: 'syiling_balance' } })
    expect(transformWallet(wallet(), { ...refs, isStudent: false })).toMatchObject({ ok: false, reject: { reason: 'UNSUPPORTED' } })
    expect(transformWallet(wallet(), { ...refs, userId: undefined })).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT', column: 'user_id' } })
  })

  it('loads a wallet whose tier was not adopted with a null tier instead of dropping it', () => {
    expect(transformWallet(wallet(), { ...refs, tierId: undefined })).toMatchObject({ ok: true, value: { tier_id: null, current_syiling: 10 } })
  })

  it('allows a wallet with no tier', () => {
    expect(transformWallet(wallet({ gamification_tier_id: null }), { ...refs, tierId: null })).toMatchObject({ ok: true, value: { tier_id: null } })
  })
})

describe('transformLedger', () => {
  const tx = (over: Record<string, string | null> = {}) => ({
    id: '1', user_id: '1', type: 'earn', source: 'practice', amount: '5', balance_after: '5', created_at: '2026-01-01 00:00:00+00', ...over,
  })
  const refs = { userId: '9', isStudent: true }

  it('maps type and source, keeps balance_after and leaves source_id and description empty', () => {
    const out = transformLedger(tx(), refs)
    expect(out.ok && out.value).toMatchObject({ type: 'earn', source: 'quiz_practice', amount: 5, balance_after: 5, source_id: null, description: '' })
  })

  it('rejects a wrong sign and never flips it', () => {
    expect(transformLedger(tx({ type: 'spend', amount: '5' }), refs)).toMatchObject({ ok: false, reject: { reason: 'INVALID_VALUE', column: 'amount' } })
    expect(transformLedger(tx({ type: 'earn', amount: '-5' }), refs)).toMatchObject({ ok: false, reject: { column: 'amount' } })
    expect(transformLedger(tx({ type: 'spend', amount: '-5', balance_after: '0' }), refs)).toMatchObject({ ok: true, value: { amount: -5 } })
    expect(ledgerSignOk('earn', 0)).toBe(true)
    expect(ledgerSignOk('convert', 1)).toBe(false)
  })

  it('rejects an unknown type or source and a non-student', () => {
    expect(transformLedger(tx({ type: 'mystery' }), refs)).toMatchObject({ ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'type' } })
    expect(transformLedger(tx({ source: 'lucky' }), refs)).toMatchObject({ ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'source' } })
    expect(transformLedger(tx(), { userId: '9', isStudent: false })).toMatchObject({ ok: false, reject: { reason: 'UNSUPPORTED' } })
  })
})

describe('walletDriftKinds', () => {
  it('reports each disagreeing counter and nothing when they agree', () => {
    expect(walletDriftKinds({ current: 10, ledgerSum: 10, lastBalance: 10 })).toEqual([])
    expect(walletDriftKinds({ current: 10, ledgerSum: 4, lastBalance: 10 })).toEqual(['sum'])
    expect(walletDriftKinds({ current: 10, ledgerSum: 10, lastBalance: 7 })).toEqual(['last_balance'])
    expect(walletDriftKinds({ current: 10, ledgerSum: 4, lastBalance: 7 })).toEqual(['sum', 'last_balance'])
    expect(walletDriftKinds({ current: 10, ledgerSum: null, lastBalance: null })).toEqual(['sum'])
    expect(walletDriftKinds({ current: 0, ledgerSum: null, lastBalance: null })).toEqual([])
  })
})

describe('transformExamAttempt', () => {
  const attempt = (over: Record<string, string | null> = {}) => ({
    id: '1', user_id: '1', exam_paper_id: '1', mode: 'latihan', status: 'selesai', score: '20', max_score: '40',
    section_scores: '{"a":10,"b":10}', created_at: '2026-01-01 00:00:00+00', updated_at: '2026-01-01 01:00:00+00', ...over,
  })
  const refs = { userId: '9', paperTitle: 'Kertas Contoh (2025)' as string | null }

  it('builds the header with the documented sentinels and the result with the score', () => {
    const out = transformExamAttempt(attempt(), refs)
    expect(out.ok && out.value.attempt).toMatchObject({
      paper_id: null, paper_kind: 'pilihan', kertas: 1, duration_min: 1, title: 'Kertas Contoh (2025)', mode: 'latihan',
      status: 'submitted', flags: ['historical'], composition: [], picks: {}, started_at: '2026-01-01 00:00:00+00',
      submitted_at: '2026-01-01 01:00:00+00',
    })
    expect(out.ok && out.value.result).toEqual({ score: '20.00', max_score: '40.00', section_scores: { a: 10, b: 10 } })
  })

  it('keeps only numeric leaves of section_scores and drops text (AC2)', () => {
    const scores = (raw: string | null) => {
      const out = transformExamAttempt(attempt({ section_scores: raw }), refs)
      return out.ok ? out.value.result?.section_scores : 'rejected'
    }
    expect(scores('{"a":10,"b":"Cikgu kata bagus","c":"12","d":{"x":1.5,"note":"teks bebas"},"e":{"note":"teks"},"f":true,"g":null}'))
      .toEqual({ a: 10, d: { x: 1.5 } })
    expect(scores('[3,"teks",4]')).toEqual([3, null, 4])
    expect(scores('{"a":"teks","b":{"c":"teks"}}')).toBeNull()
    expect(scores('["teks"]')).toBeNull()
    expect(scores('"teks"')).toBeNull()
    expect(scores('bukan json')).toBeNull()
    expect(scores(null)).toBeNull()
    expect(parseSectionScores('{"a":0}')).toEqual({ a: 0 })
  })

  it('maps the status, leaves an abandoned attempt unsubmitted and rejects an unknown one', () => {
    expect(transformExamAttempt(attempt({ status: 'tamat_masa' }), refs)).toMatchObject({ ok: true, value: { attempt: { status: 'auto_submitted' } } })
    expect(transformExamAttempt(attempt({ status: 'ditinggalkan' }), refs)).toMatchObject({ ok: true, value: { attempt: { status: 'abandoned', submitted_at: null } } })
    expect(transformExamAttempt(attempt({ status: 'sedang_berjalan' }), refs)).toMatchObject({ ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'status' } })
    expect(transformExamAttempt(attempt({ mode: 'misteri' }), refs)).toMatchObject({ ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'mode' } })
  })

  it('uses the fixed title when the paper is unknown, skips the result without a score, rejects bad scores', () => {
    expect(transformExamAttempt(attempt(), { userId: '9', paperTitle: null })).toMatchObject({ ok: true, value: { attempt: { title: EXAM_FALLBACK_TITLE } } })
    expect(transformExamAttempt(attempt({ score: null }), refs)).toMatchObject({ ok: true, value: { result: null } })
    expect(transformExamAttempt(attempt({ score: '-1' }), refs)).toMatchObject({ ok: false, reject: { column: 'score' } })
    expect(transformExamAttempt(attempt({ max_score: '1000000' }), refs)).toMatchObject({ ok: false, reject: { column: 'max_score' } })
    expect(transformExamAttempt(attempt(), { userId: undefined, paperTitle: null })).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT' } })
  })

  it('parses scores to two decimals and the title with its year once', () => {
    expect(parseScore('12.5')).toBe('12.50')
    expect(parseScore('abc')).toBe('invalid')
    expect(parseScore(null)).toBeNull()
    expect(snapshotTitle('Kertas Contoh', '2025')).toBe('Kertas Contoh (2025)')
    expect(snapshotTitle('Kertas 2025', '2025')).toBe('Kertas 2025')
    expect(snapshotTitle(null, '2025')).toBe(EXAM_FALLBACK_TITLE)
  })
})
