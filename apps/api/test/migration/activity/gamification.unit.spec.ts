/**
 * BE-29 Part B pure transforms (no database): gamification, content and operations. Synthetic values only.
 */
import { describe, expect, it } from 'vitest'

import { generateTinyFixture } from '../fixtures/generate-tiny'

import {
  ARTICLE_CATEGORY_MAP,
  BANNER_TYPE_MAP,
  NOTE_TYPE_MAP,
  articleAuthor,
  transformArticle,
  transformAudioSet,
  transformBanner,
  transformNote,
  transformVideo,
  videoPlatform,
} from '../../../src/migration/transform/content'
import {
  CHALLENGE_TYPE_MAP,
  completionLegacyId,
  challengeDifficulty,
  challengeTarget,
  isPlatformChallenge,
  parseSpmTargets,
  settingEntries,
  tierMatchKey,
  transformAchievement,
  transformChallenge,
  transformCompletion,
  transformReferral,
  transformReferralCode,
  transformSetting,
  transformSpmTarget,
  transformUnlock,
  type CompletionRow,
} from '../../../src/migration/transform/gamification'
import {
  TICKET_STATUS_MAP,
  overallScore,
  transformFeedback,
  transformTicket,
  transformTimeline,
} from '../../../src/migration/transform/support'

const rejectOf = (o: { ok: boolean; reject?: { reason: string; column: string } }): string | null =>
  o.ok ? null : `${o.reject?.reason}:${o.reject?.column}`

describe('tiers and challenges', () => {
  it('matches a tier on its trimmed, lower-cased label', () => {
    expect(tierMatchKey('  Gangsa  ')).toBe('gangsa')
    expect(tierMatchKey(' ')).toBeNull()
  })

  it('tells platform challenges from teacher challenges', () => {
    expect(isPlatformChallenge({ created_by: null, classroom_id: null })).toBe(true)
    expect(isPlatformChallenge({ created_by: ' ', classroom_id: '' })).toBe(true)
    expect(isPlatformChallenge({ created_by: '7', classroom_id: null })).toBe(false)
    expect(isPlatformChallenge({ created_by: null, classroom_id: '3' })).toBe(false)
  })

  it('reads the target from the numeric target_value column: a whole number from 1 to 1,000,000', () => {
    expect(challengeTarget('5')).toBe(5)
    expect(challengeTarget(' 12.00 ')).toBe(12)
    expect(challengeTarget('1000000')).toBe(1_000_000)
    expect(challengeTarget('0')).toBeNull()
    expect(challengeTarget('1.5')).toBeNull()
    expect(challengeTarget('-3')).toBeNull()
    expect(challengeTarget('1000001')).toBeNull()
    expect(challengeTarget('selesaikan 5 kuiz')).toBeNull()
    expect(challengeTarget('{"target": 5}')).toBeNull()
    expect(challengeTarget(null)).toBeNull()
  })

  it('maps the challenge type with an explicit table and rejects the rest; metric stays null', () => {
    expect(Object.keys(CHALLENGE_TYPE_MAP).sort()).toEqual([
      'accuracy', 'bilangan_kuiz', 'ketepatan', 'kombo', 'masa', 'quiz_count', 'streak', 'time_spent', 'topic_variety', 'topik_berbeza',
    ])
    const ok = transformChallenge({ title: ' Cabaran  Satu ', challenge_type: 'Quiz Count', target_value: '3.00' })
    expect(ok.ok && ok.value).toMatchObject({ title: 'Cabaran Satu', challenge_type: 'quiz_count', metric: null, target_value: 3, difficulty: 'medium' })
    expect(rejectOf(transformChallenge({ title: 'A', challenge_type: 'harian', target_value: '3' }))).toBe('UNKNOWN_ENUM:challenge_type')
    expect(rejectOf(transformChallenge({ title: 'A', challenge_type: 'accuracy', target_value: 'teks' }))).toBe('INVALID_VALUE:target_value')
    expect(rejectOf(transformChallenge({ title: '', challenge_type: 'accuracy', target_value: '3' }))).toBe('INVALID_VALUE:title')
    expect(rejectOf(transformChallenge({ title: 'x'.repeat(201), challenge_type: 'accuracy', target_value: '3' }))).toBe('INVALID_VALUE:title')
  })

  describe('the .cloud challenge_type codes map to the v2 types (FIT-FIX OQ5, LEAD 25 Oct 13:15 MYT)', () => {
    const typeOf = (raw: string | null) => {
      const o = transformChallenge({ title: 'A', challenge_type: raw, target_value: '3' })
      return o.ok ? o.value.challenge_type : rejectOf(o)
    }
    it.each([
      ['bilangan_kuiz', 'quiz_count'],
      ['ketepatan', 'accuracy'],
      ['topik_berbeza', 'topic_variety'],
      ['kombo', 'streak'],
      ['masa', 'time_spent'],
    ])('maps %s to %s', (code, v2) => {
      expect(typeOf(code)).toBe(v2)
    })

    it('is case- and space-insensitive (the enumKey rule)', () => {
      expect(typeOf(' KOMBO ')).toBe('streak')
      expect(typeOf('Topik Berbeza')).toBe('topic_variety')
      expect(typeOf('Bilangan-Kuiz')).toBe('quiz_count')
      expect(typeOf('MASA')).toBe('time_spent')
      expect(typeOf('Ketepatan')).toBe('accuracy')
    })

    it('maps every challenge of the cloud-tiny fixture except its one unknown code (harian)', () => {
      const rows = generateTinyFixture().get('challenges.ndjson')!.trim().split('\n').map((l) => JSON.parse(l) as Record<string, string>)
      expect(rows.map((r) => typeOf(r.challenge_type ?? null))).toEqual([
        'UNKNOWN_ENUM:challenge_type', 'quiz_count', 'accuracy', 'topic_variety', 'streak', 'time_spent',
      ])
    })

    it('keeps the identity codes and still rejects an unknown or blank code', () => {
      for (const v2 of ['quiz_count', 'accuracy', 'topic_variety', 'streak', 'time_spent']) expect(typeOf(v2)).toBe(v2)
      expect(typeOf('harian')).toBe('UNKNOWN_ENUM:challenge_type')
      expect(typeOf('kombo_harian')).toBe('UNKNOWN_ENUM:challenge_type')
      expect(typeOf('')).toBe('INVALID_VALUE:challenge_type')
      expect(typeOf(null)).toBe('INVALID_VALUE:challenge_type')
    })
  })

  describe('challenge rewards, difficulty, flag and order (FIT-FIX OQ5)', () => {
    const base = { title: 'A', challenge_type: 'accuracy', target_value: '3' }
    const valueOf = (extra: Record<string, string | null>) => {
      const o = transformChallenge({ ...base, ...extra })
      return o.ok ? o.value : null
    }

    it('takes the v2 defaults when the columns are absent or NULL', () => {
      expect(valueOf({})).toMatchObject({ reward_syiling: 0, reward_xp: 0, difficulty: 'medium', sort_order: 0, is_active: true })
      expect(valueOf({ reward_syiling: null, reward_xp: ' ', difficulty: null, sort_order: null, is_active: null }))
        .toMatchObject({ reward_syiling: 0, reward_xp: 0, difficulty: 'medium', sort_order: 0, is_active: true })
    })

    it('maps valid values', () => {
      expect(valueOf({ reward_syiling: '15', reward_xp: '5', difficulty: 'hard', sort_order: '3', is_active: '0' }))
        .toMatchObject({ reward_syiling: 15, reward_xp: 5, difficulty: 'hard', sort_order: 3, is_active: false })
      expect(valueOf({ reward_syiling: '100000', reward_xp: '0', sort_order: '2147483647', is_active: 'true' }))
        .toMatchObject({ reward_syiling: 100000, reward_xp: 0, sort_order: 2147483647, is_active: true })
      expect(valueOf({ sort_order: '-2' })).toMatchObject({ sort_order: -2 })
    })

    it('rejects an invalid, negative or too large reward, order or flag, naming the column', () => {
      for (const col of ['reward_syiling', 'reward_xp'] as const) {
        for (const bad of ['-1', '1.5', 'banyak', '100001', '99999999999999']) {
          expect(rejectOf(transformChallenge({ ...base, [col]: bad })), `${col}=${bad}`).toBe(`INVALID_VALUE:${col}`)
        }
      }
      for (const bad of ['2147483648', '-2147483649', '1.5', 'x']) {
        expect(rejectOf(transformChallenge({ ...base, sort_order: bad })), `sort_order=${bad}`).toBe('INVALID_VALUE:sort_order')
      }
      for (const bad of ['mungkin', '2', 'aktif']) {
        expect(rejectOf(transformChallenge({ ...base, is_active: bad })), `is_active=${bad}`).toBe('INVALID_VALUE:is_active')
      }
    })

    it('maps difficulty by identity only, case and space insensitive; anything else keeps medium and is flagged unmapped', () => {
      for (const d of ['easy', 'medium', 'hard']) {
        expect(challengeDifficulty(d)).toEqual({ value: d, unmapped: false })
        expect(challengeDifficulty(` ${d.toUpperCase()} `)).toEqual({ value: d, unmapped: false })
      }
      expect(challengeDifficulty(null)).toEqual({ value: 'medium', unmapped: false })
      expect(challengeDifficulty('  ')).toEqual({ value: 'medium', unmapped: false })
      for (const d of ['mudah', 'sederhana', 'sukar', 'extreme']) expect(challengeDifficulty(d)).toEqual({ value: 'medium', unmapped: true })
      expect(valueOf({ difficulty: 'Sukar' })).toMatchObject({ difficulty: 'medium' })
      expect(valueOf({ difficulty: 'Hard' })).toMatchObject({ difficulty: 'hard' })
    })
  })

  it('keeps the achievement criteria as legacy text only', () => {
    const out = transformAchievement({ name: ' Pencapaian ', criteria: 'Syarat' })
    expect(out.ok && out.value).toMatchObject({ name: 'Pencapaian', legacy_criteria_text: 'Syarat' })
    expect(rejectOf(transformAchievement({ name: '  ' }))).toBe('INVALID_VALUE:name')
  })
})

describe('settings pivot', () => {
  it('gives one entry per non-empty column, in key order', () => {
    const entries = settingEntries({ reward_budget_sen_month: '300', flat_quiz_reward: null, current_session_year: '2026', games_award_syiling: '0' })
    expect(entries.map((e) => `${e.key}=${e.raw}`)).toEqual(['reward_budget_sen_month=300', 'current_session_year=2026', 'games_award_syiling=0'])
  })

  it('accepts numeric(12,2) and rejects negative or non-numeric values', () => {
    const entry = (raw: string) => ({ index: 0, key: 'flat_quiz_reward' as const, raw })
    expect(transformSetting({}, entry('2.5')).ok).toBe(true)
    expect(rejectOf(transformSetting({}, entry('-1')))).toBe('INVALID_VALUE:flat_quiz_reward')
    expect(rejectOf(transformSetting({}, entry('1.234')))).toBe('INVALID_VALUE:flat_quiz_reward')
    expect(rejectOf(transformSetting({}, entry('abc')))).toBe('INVALID_VALUE:flat_quiz_reward')
  })
})

describe('completions and unlocks', () => {
  const row = (over: Partial<CompletionRow> = {}): CompletionRow => ({
    challenge_id: '1', user_id: '2', dkey: '2026-01-02', cat: '2026-01-01 23:30:00+00', rk: 1, rn: 1, ...over,
  })
  const parents = { userId: '20', challengeId: '10' }

  it('loads a completion with its day, excludes one with no day, rejects a repeat day', () => {
    const ok = transformCompletion(row(), parents)
    expect(ok.ok && 'value' in ok && ok.value).toMatchObject({ user_id: '20', challenge_id: '10', completion_date: '2026-01-02', is_test: false })
    expect(transformCompletion(row({ dkey: null, cat: null, rk: 0 }), parents)).toEqual({ ok: true, excluded: true })
    expect(rejectOf(transformCompletion(row({ rn: 2 }), parents) as never)).toBe('DUPLICATE_KEY:claimed_on')
  })

  it('rejects an unknown user or challenge as ORPHAN_PARENT', () => {
    expect(rejectOf(transformCompletion(row(), { userId: undefined, challengeId: '10' }) as never)).toBe('ORPHAN_PARENT:user_id')
    expect(rejectOf(transformCompletion(row(), { userId: '20', challengeId: undefined }) as never)).toBe('ORPHAN_PARENT:challenge_id')
  })

  it('keeps one legacy id per day ordinal', () => {
    expect(completionLegacyId(row())).toBe('1:2:1')
    expect(completionLegacyId(row({ rk: 2 }))).toBe('1:2:2')
  })

  it('rejects a repeated unlock, an unknown parent and a missing time', () => {
    const base = { achievement_id: '1', user_id: '2', unlocked_at: '2026-01-01 00:00:00+00', rn: 1 }
    expect(transformUnlock(base, { userId: '20', achievementId: '10' }).ok).toBe(true)
    expect(rejectOf(transformUnlock({ ...base, rn: 2 }, { userId: '20', achievementId: '10' }))).toBe('DUPLICATE_KEY:user_id')
    expect(rejectOf(transformUnlock(base, { userId: undefined, achievementId: '10' }))).toBe('ORPHAN_PARENT:user_id')
    expect(rejectOf(transformUnlock({ ...base, unlocked_at: null }, { userId: '20', achievementId: '10' }))).toBe('INVALID_VALUE:unlocked_at')
  })
})

describe('referrals', () => {
  it('validates the code length and requires a user', () => {
    expect(transformReferralCode({ referral_code: ' ABC ' }, '5').ok).toBe(true)
    expect(rejectOf(transformReferralCode({ referral_code: 'x'.repeat(51) }, '5'))).toBe('INVALID_VALUE:referral_code')
    expect(rejectOf(transformReferralCode({ referral_code: 'ABC' }, undefined))).toBe('ORPHAN_PARENT:user_id')
  })

  it('rejects a self-referral, a missing referrer and a referrer without a code', () => {
    const ok = transformReferral({ id: '2', referred_by: '1' }, { refereeId: '22', referrerId: '11', referrerCode: 'REFA' })
    expect(ok.ok && ok.value).toMatchObject({ referrer_id: '11', referee_id: '22', code_used: 'REFA', rewarded: false })
    expect(rejectOf(transformReferral({ id: '2', referred_by: '2' }, { refereeId: '22', referrerId: '22', referrerCode: 'X' }))).toBe('INVALID_VALUE:referred_by')
    expect(rejectOf(transformReferral({ id: '2', referred_by: '9' }, { refereeId: '22', referrerId: undefined, referrerCode: null }))).toBe('ORPHAN_PARENT:referred_by')
    expect(rejectOf(transformReferral({ id: '2', referred_by: '1' }, { refereeId: '22', referrerId: '11', referrerCode: null }))).toBe('ORPHAN_PARENT:referral_code')
  })
})

describe('spm targets', () => {
  it('parses an object of subject id to grade and an array of entries', () => {
    expect(parseSpmTargets('{"1": "A+", "2": "b"}').map((e) => [e.subjectRef, e.grade])).toEqual([['1', 'A+'], ['2', 'B']])
    expect(parseSpmTargets('[{"subject_id": 3, "target_grade": "C+"}]').map((e) => [e.subjectRef, e.grade])).toEqual([['3', 'C+']])
    expect(parseSpmTargets('  ')).toEqual([])
    expect(parseSpmTargets('{}')).toEqual([])
  })

  it('marks an unknown shape and a repeated subject', () => {
    expect(parseSpmTargets('not json')[0]?.badShape).toBe(true)
    expect(parseSpmTargets('"A"')[0]?.badShape).toBe(true)
    expect(parseSpmTargets('{"matematik": "A"}')[0]?.badShape).toBe(true)
    const entries = parseSpmTargets('[{"subject_id": 1, "grade": "A"}, {"subject_id": 1, "grade": "B"}]')
    expect(entries.map((e) => e.repeat)).toEqual([false, true])
  })

  it('accepts only the nine grades and never defaults one', () => {
    const stamp = { created_at: 'a', updated_at: 'b' }
    const parents = { userId: '1', subjectId: '2' }
    for (const g of ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E']) {
      expect(transformSpmTarget({ index: 0, subjectRef: '1', grade: g, badShape: false, repeat: false }, parents, stamp).ok).toBe(true)
    }
    const bad = (grade: string | null) => transformSpmTarget({ index: 0, subjectRef: '1', grade, badShape: false, repeat: false }, parents, stamp)
    expect(rejectOf(bad('G'))).toBe('INVALID_VALUE:target_grade')
    expect(rejectOf(bad('F'))).toBe('INVALID_VALUE:target_grade')
    expect(rejectOf(bad(null))).toBe('INVALID_VALUE:target_grade')
    expect(rejectOf(transformSpmTarget({ index: 0, subjectRef: '1', grade: 'A', badShape: false, repeat: false }, { userId: '1', subjectId: undefined }, stamp))).toBe('ORPHAN_PARENT:subject_id')
  })
})

describe('content', () => {
  const article = { title: 'Artikel', slug: 'artikel-a', category: 'Panduan Guru', views: '4', is_published: '1', created_at: '2026-01-01T00:00:00Z' }

  it('maps the article category to its upper-case code and sets published_at from created_at', () => {
    expect(Object.values(ARTICLE_CATEGORY_MAP)).toContain('PANDUAN_GURU')
    const out = transformArticle({ ...article, content: '<p>x</p>' }, { authorId: '9' })
    expect(out.ok && out.value).toMatchObject({ category: 'PANDUAN_GURU', grade_level: 'SEMUA', published_at: '2026-01-01T00:00:00Z', author_id: '9', featured_image_file_id: null })
    const draft = transformArticle({ ...article, is_published: '0', content: 'x' }, { authorId: '9' })
    expect(draft.ok && draft.value.published_at).toBeNull()
  })

  it('rejects an article with no content, an unknown category or an unresolved author', () => {
    expect(rejectOf(transformArticle(article, { authorId: '9' }))).toBe('INVALID_VALUE:content')
    expect(rejectOf(transformArticle({ ...article, category: 'lain' }, { authorId: '9' }))).toBe('UNKNOWN_ENUM:category')
    expect(rejectOf(transformArticle({ ...article, content: 'x' }, { authorId: undefined }))).toBe('ORPHAN_PARENT:author_id')
    expect(rejectOf(transformArticle({ ...article, content: 'x', is_published: 'maybe' }, { authorId: '9' }))).toBe('INVALID_VALUE:is_published')
  })

  describe('article author falls back to the content owner (D1, LEAD 29 Oct)', () => {
    it('keeps a resolved author, even when an owner is configured', () => {
      const out = transformArticle({ ...article, content: 'x' }, { authorId: '9', ownerId: '77' })
      expect(out.ok && out.value.author_id).toBe('9')
      expect(articleAuthor('9', '77')).toEqual({ id: '9', fromOwner: false })
    })

    it('uses the content owner when the author does not resolve', () => {
      const out = transformArticle({ ...article, content: 'x' }, { authorId: undefined, ownerId: '77' })
      expect(out.ok && out.value.author_id).toBe('77')
      expect(articleAuthor(undefined, '77')).toEqual({ id: '77', fromOwner: true })
    })

    it('is ORPHAN_PARENT on author_id only when neither resolves', () => {
      expect(rejectOf(transformArticle({ ...article, content: 'x' }, { authorId: undefined, ownerId: undefined }))).toBe('ORPHAN_PARENT:author_id')
      expect(articleAuthor(undefined, undefined)).toEqual({ id: undefined, fromOwner: false })
    })

    it('the owner does not stand in for missing content: still INVALID_VALUE on content', () => {
      expect(rejectOf(transformArticle(article, { authorId: undefined, ownerId: '77' }))).toBe('INVALID_VALUE:content')
    })

    it('keeps the staged excerpt (blank is null) next to the content', () => {
      const out = transformArticle({ ...article, content: '<p>x</p>', excerpt: 'Ringkasan' }, { authorId: '9' })
      expect(out.ok && out.value.excerpt).toBe('Ringkasan')
      const blank = transformArticle({ ...article, content: '<p>x</p>', excerpt: '  ' }, { authorId: '9' })
      expect(blank.ok && blank.value.excerpt).toBeNull()
    })
  })

  it('maps the banner type, keeps dates and counts files and dropped targets', () => {
    expect([...new Set(Object.values(BANNER_TYPE_MAP))].sort()).toEqual(['ANNOUNCEMENT', 'EVENT', 'HERO', 'PROMO'])
    const o = transformBanner({ title: 'Sepanduk', type: 'Hero', image_path: 'a.png', target: '/dalam', sort_order: '2', is_active: '1' }, { start: '2026-03-02', end: '2026-03-10' })
    expect(o.hadImage).toBe(true)
    expect(o.droppedTarget).toBe(true)
    expect(o.out.ok && o.out.value).toMatchObject({ banner_type: 'HERO', link_type: 'NONE', external_url: null, image_file_id: null, start_date: '2026-03-02', display_order: 2 })
    const ext = transformBanner({ title: 'S', type: 'promo', target: 'https://contoh.invalid/x' }, { start: null, end: null })
    expect(ext.out.ok && ext.out.value).toMatchObject({ link_type: 'EXTERNAL', external_url: 'https://contoh.invalid/x' })
    expect(rejectOf(transformBanner({ title: 'S', type: 'promo' }, { start: '2026-03-10', end: '2026-03-01' }).out)).toBe('INVALID_VALUE:end_date')
    expect(rejectOf(transformBanner({ title: 'S', type: 'xyz' }, { start: null, end: null }).out)).toBe('UNKNOWN_ENUM:type')
    // A1-FIX: the two legacy .cloud codes map to a code v2 can store (`ck_banners_banner_type`).
    for (const type of ['FEATURE', 'PROMOTIONAL']) {
      const legacy = transformBanner({ title: 'S', type }, { start: null, end: null })
      expect(legacy.out.ok && legacy.out.value.banner_type, type).toBe('PROMO')
    }
  })

  it('needs the content owner for notes, videos and audio sets (ORPHAN_PARENT) and never invents the missing columns', () => {
    const note = { title: 'Nota', note_type: 'formula', body: 'Isi', is_published: '1', views: '1' }
    expect(Object.keys(NOTE_TYPE_MAP)).toContain('mind_map')
    expect(rejectOf(transformNote(note, { ownerId: undefined }))).toBe('ORPHAN_PARENT:author_id')
    expect(rejectOf(transformNote(note, { ownerId: '5' }))).toBe('INVALID_VALUE:subject')
    expect(rejectOf(transformNote({ ...note, subject: 'matematik' }, { ownerId: '5' }))).toBe('INVALID_VALUE:grade')
    const ok = transformNote({ ...note, subject: 'Matematik', grade: 'Tingkatan 4' }, { ownerId: '5' })
    expect(ok.ok && ok.value).toMatchObject({ author_id: '5', subject: 'matematik', note_type: 'FORMULA', content: 'Isi' })

    const video = { title: 'Video', url: 'https://youtu.be/abcdefghijk' }
    expect(rejectOf(transformVideo(video, { ownerId: undefined }))).toBe('ORPHAN_PARENT:uploader_id')
    expect(rejectOf(transformVideo(video, { ownerId: '5' }))).toBe('INVALID_VALUE:category')
    // .cloud videos have no publication flag: nothing is rejected as a draft, whatever a stray column holds.
    expect(rejectOf(transformVideo({ ...video, is_published: '0' }, { ownerId: '5' }))).toBe('INVALID_VALUE:category')
    expect(rejectOf(transformVideo({ ...video, url: 'javascript:alert(1)' }, { ownerId: '5' }))).toBe('INVALID_VALUE:url')
    const v = transformVideo({ ...video, category: 'Tutorial' }, { ownerId: '5' })
    expect(v.ok && v.value).toMatchObject({ platform: 'Youtube', category: 'tutorial', uploader_id: '5', visibility: 'global' })
    expect(transformVideo({ ...video, category: 'tutorial', url: 'https://vimeo.com/123456' }, { ownerId: '5' }).ok).toBe(true)

    const audio = { title: 'Audio', status: 'draft', audio_path: 'a.mp3' }
    const noOwner = transformAudioSet(audio, { ownerId: undefined, levelId: '1', subjectId: '2' })
    expect(rejectOf(noOwner.out)).toBe('ORPHAN_PARENT:created_by_id')
    expect(noOwner.hadAudio).toBe(true)
    expect(rejectOf(transformAudioSet(audio, { ownerId: '5', levelId: undefined, subjectId: '2' }).out)).toBe('INVALID_VALUE:education_level_id')
    expect(transformAudioSet(audio, { ownerId: '5', levelId: '1', subjectId: '2' }).out.ok).toBe(true)
  })

  it('detects the video platform from the host', () => {
    expect(videoPlatform('https://www.youtube.com/watch?v=1')).toBe('Youtube')
    expect(videoPlatform('https://vimeo.com/1')).toBe('Vimeo')
    expect(videoPlatform('https://www.tiktok.com/@a/video/1')).toBe('TikTok')
    expect(videoPlatform('https://fb.watch/x')).toBe('Facebook')
    expect(videoPlatform('https://contoh.invalid/x')).toBe('Other')
    expect(videoPlatform('notaurl')).toBe('Other')
  })
})

describe('operations', () => {
  it('maps the ticket status onto the five BM codes and rejects the rest', () => {
    expect(new Set(Object.values(TICKET_STATUS_MAP))).toEqual(new Set(['dibuka', 'dalam_proses', 'menunggu_balas', 'selesai', 'ditutup']))
    const t = (status: string) => transformTicket({ subject: 'Tiket', status, body: 'Mesej' }, { userId: '3' })
    expect(t('Dalam Proses').ok && (t('Dalam Proses') as { value: { status: string } }).value.status).toBe('dalam_proses')
    expect(rejectOf(t('weird'))).toBe('UNKNOWN_ENUM:status')
  })

  it('rejects a ticket with no body, a subject over 255 characters (no truncation) or an unknown user', () => {
    expect(rejectOf(transformTicket({ subject: 'Tiket', status: 'dibuka' }, { userId: '3' }))).toBe('INVALID_VALUE:body')
    expect(rejectOf(transformTicket({ subject: 'a'.repeat(256), status: 'dibuka', body: 'x' }, { userId: '3' }))).toBe('INVALID_VALUE:subject')
    expect(transformTicket({ subject: 'a'.repeat(255), status: 'dibuka', body: 'x' }, { userId: '3' }).ok).toBe(true)
    expect(rejectOf(transformTicket({ subject: 'Tiket', status: 'dibuka', body: 'x' }, { userId: undefined }))).toBe('ORPHAN_PARENT:user_id')
  })

  it('timeline: fixed category, date kept as a date, title and story limits', () => {
    const base = { title: 'Sijil', body: 'Cerita', happened_on: '2026-02-01' }
    const ok = transformTimeline(base, { userId: '3' })
    expect(ok.ok && ok.value).toMatchObject({ category: 'lain', event_date: '2026-02-01', story: 'Cerita', title: 'Sijil' })
    expect(transformTimeline({ ...base, title: 'a'.repeat(150), body: 'b'.repeat(2000) }, { userId: '3' }).ok).toBe(true)
    expect(rejectOf(transformTimeline({ ...base, title: 'a'.repeat(151) }, { userId: '3' }))).toBe('INVALID_VALUE:title')
    expect(rejectOf(transformTimeline({ ...base, body: 'b'.repeat(2001) }, { userId: '3' }))).toBe('INVALID_VALUE:body')
    expect(rejectOf(transformTimeline({ ...base, happened_on: '2026-02-01T00:00:00Z' }, { userId: '3' }))).toBe('INVALID_VALUE:happened_on')
    expect(transformTimeline({ title: 'T', body: null, happened_on: null }, { userId: '3' }).ok).toBe(true)
  })

  it('feedback: four scores kept, newest per month, satisfaction 1 to 5 and required', () => {
    const base = { satisfaction: '4', usability: '3', relevance: '5', score: '4', comment: 'Komen', created_at: '2026-05-20T10:00:00Z' }
    const ctx = { userId: '3', role: 'pelajar', schoolId: '8', month: '2026-05-01', newest: true }
    const ok = transformFeedback(base, ctx)
    expect(ok.ok && ok.value).toMatchObject({ role: 'student', school_id: '8', month: '2026-05-01', nps: null, satisfaction: 4, usability: 3, relevance: 5, score: 4 })
    expect(rejectOf(transformFeedback(base, { ...ctx, newest: false }))).toBe('DUPLICATE_KEY:month')
    expect(rejectOf(transformFeedback({ ...base, satisfaction: '6' }, ctx))).toBe('INVALID_VALUE:satisfaction')
    expect(rejectOf(transformFeedback({ ...base, satisfaction: '0' }, ctx))).toBe('INVALID_VALUE:satisfaction')
    expect(rejectOf(transformFeedback({ ...base, satisfaction: null }, ctx))).toBe('INVALID_VALUE:satisfaction')
    expect(rejectOf(transformFeedback(base, { ...ctx, role: 'super_guru' }))).toBe('UNKNOWN_ENUM:role')
    expect(rejectOf(transformFeedback(base, { ...ctx, month: null }))).toBe('INVALID_VALUE:created_at')
    expect(rejectOf(transformFeedback(base, { ...ctx, userId: undefined }))).toBe('ORPHAN_PARENT:user_id')
    const sparse = transformFeedback({ satisfaction: '3' }, ctx)
    expect(sparse.ok && sparse.value).toMatchObject({ usability: null, relevance: null, score: null, nps: null, comment: null })
  })

  describe('feedback score: 1 to 5 is score, 0 and 6 to 10 is nps (D4, LEAD 29 Oct)', () => {
    const base = { satisfaction: '4', created_at: '2026-05-20T10:00:00Z' }
    const ctx = { userId: '3', role: 'pelajar', schoolId: null, month: '2026-05-01', newest: true }
    const values = (score: string | null) => {
      const o = transformFeedback({ ...base, score }, ctx)
      return o.ok ? { score: o.value.score, nps: o.value.nps } : rejectOf(o)
    }

    it('keeps 1 to 5 in score with nps null', () => {
      for (const v of ['1', '3', '5']) expect(values(v)).toEqual({ score: Number(v), nps: null })
    })

    it('moves 0 and 6 to 10 to nps with score null', () => {
      for (const v of ['0', '6', '9', '10']) expect(values(v)).toEqual({ score: null, nps: Number(v) })
    })

    it('a blank score is neither', () => {
      expect(values(null)).toEqual({ score: null, nps: null })
      expect(values('  ')).toEqual({ score: null, nps: null })
    })

    it('anything outside 0 to 10 is still INVALID_VALUE on score (no rescaling, no rounding)', () => {
      for (const v of ['11', '-1', '100', '4.5', '7.0', 'x']) expect(values(v)).toBe('INVALID_VALUE:score')
    })

    it('a NULL satisfaction is still rejected, naming satisfaction, whatever the score', () => {
      expect(rejectOf(transformFeedback({ score: '9', satisfaction: null }, ctx))).toBe('INVALID_VALUE:satisfaction')
      expect(rejectOf(transformFeedback({ score: '9' }, ctx))).toBe('INVALID_VALUE:satisfaction')
    })

    it('overallScore is the same rule on its own', () => {
      expect(overallScore('8')).toEqual({ ok: true, value: { score: null, nps: 8 } })
      expect(overallScore('2')).toEqual({ ok: true, value: { score: 2, nps: null } })
      expect(rejectOf(overallScore('12'))).toBe('INVALID_VALUE:score')
    })
  })
})

describe('FIT-FIX OQ5 reward bound', () => {
  it('is the wallet per-call ceiling, so a migrated reward can always be paid', async () => {
    const { CHALLENGE_REWARD_MAX } = await import('../../../src/migration/transform/gamification')
    const { MAX_AMOUNT_PER_CALL } = await import('../../../src/modules/wallet/wallet.constants')
    expect(CHALLENGE_REWARD_MAX).toBe(MAX_AMOUNT_PER_CALL)
  })
})
