import { beforeAll, describe, expect, it } from 'vitest'

import { createClock } from '@/lib/time'
import { defineMockCore } from '@/mock/define'
import { bootMock, type MockRuntime } from '@/mock/index'

import type { LearningMap, TopicCard, TopicDetail } from '../../api/student-curriculum'
import { islandStates, mapSubjectLabel, MAP_SUBJECTS } from '../../mock/handlers/student-curriculum'
import { curriculum } from '../../mock'
import { connectAnswerLog, EMPTY_ANSWER_LOG } from '../../mock/repository/progress'

const NOW = '2026-09-25T15:40:00+08:00'

let runtime: MockRuntime

type As = 'admin' | 'student' | 'maju' | 'teacher' | null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Answer<T = any> {
  status: number
  body: T
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function get<T = any>(
  url: string,
  as: As = 'student',
  query?: Record<string, string>,
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as) headers.authorization = `Bearer tok-${as}`
  const res = await runtime.transport.request({
    method: 'GET',
    url,
    headers,
    ...(query ? { query } : {}),
  })
  return { status: res.status, body: res.body as T }
}

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    core: defineMockCore({
      resolveSession: (token) => {
        if (token === 'tok-admin') return { token, userId: 1, role: 'admin' }
        if (token === 'tok-student') return { token, userId: 2, role: 'student' }
        if (token === 'tok-maju') return { token, userId: 4, role: 'student' }
        if (token === 'tok-teacher') return { token, userId: 5, role: 'teacher' }
        return null
      },
    }),
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
  })
}, 600_000)

describe('GET /api/topics (#25, S12)', () => {
  it('guest gets 401; any role may read', async () => {
    expect((await get('/api/topics', null)).status).toBe(401)
    for (const as of ['admin', 'student', 'teacher'] as const) {
      expect((await get('/api/topics', as)).status).toBe(200)
    }
  })

  it('lists the 29 Tingkatan 4 + 5 topics (T4 then T5, sequence order), unpaged, with the card shape (D54)', async () => {
    const res = await get<{ data: TopicCard[]; meta: Record<string, number> }>('/api/topics')
    expect(res.body.data).toHaveLength(29)
    expect(res.body.meta).toMatchObject({ totalItems: 29, page: 1, pageSize: 29, totalPages: 1 })
    expect(res.body.data.filter((t) => t.gradeLevel === 'TINGKATAN_4')).toHaveLength(19)
    expect(res.body.data.filter((t) => t.gradeLevel === 'TINGKATAN_5')).toHaveLength(10)
    expect(res.body.data.every((t) => /^TINGKATAN_[45]$/.test(t.gradeLevel))).toBe(true)
    // T4 first (19 rows), then T5.
    expect(res.body.data.slice(0, 19).every((t) => t.gradeLevel === 'TINGKATAN_4')).toBe(true)
    expect(res.body.data[0]).toEqual({
      id: 67,
      gradeLevel: 'TINGKATAN_4',
      subject: 'BAHASA_MELAYU',
      subjectLabel: 'BAHASA MELAYU',
      name: 'Kemahiran Bahasa Tingkatan 4',
      description: null,
      subtopicCount: 2,
      subtopicsPreview: ['Penulisan karangan lanjutan', 'Tatabahasa lanjutan'],
    })
  })

  it('filters by gradeLevel (T4/T5 only) and subject, AND, case-insensitive (BR-13, D54)', async () => {
    const t4 = await get<{ data: TopicCard[] }>('/api/topics', 'student', {
      gradeLevel: 'TINGKATAN_4',
    })
    expect(t4.body.data).toHaveLength(19)
    const lower = await get<{ data: TopicCard[] }>('/api/topics', 'student', {
      gradeLevel: 'tingkatan_4',
    })
    expect(lower.body.data).toHaveLength(19)
    const t5 = await get<{ data: TopicCard[] }>('/api/topics', 'student', {
      gradeLevel: 'TINGKATAN_5',
    })
    expect(t5.body.data).toHaveLength(10)
    const both = await get<{ data: TopicCard[] }>('/api/topics', 'student', {
      gradeLevel: 'TINGKATAN_4',
      subject: 'SAINS',
    })
    expect(both.body.data).toHaveLength(12)
    // Subject only = Tingkatan 4 + 5 (no Darjah rows).
    const counts: [string, number][] = [
      ['MATEMATIK', 3],
      ['SAINS', 21],
      ['BAHASA_MELAYU', 2],
      ['PENDIDIKAN_MORAL', 1],
      ['SEJARAH', 1],
      ['PENDIDIKAN_ISLAM', 0],
      ['BAHASA_INGGERIS', 0],
      ['GEOGRAFI', 1],
    ]
    for (const [subject, n] of counts) {
      const r = await get<{ data: TopicCard[] }>('/api/topics', 'student', { subject })
      expect(r.body.data, subject).toHaveLength(n)
    }
    const geo = await get<{ data: TopicCard[] }>('/api/topics', 'student', { subject: 'geografi' })
    expect(geo.body.data).toHaveLength(1)
  })

  it('serves no Darjah or other out-of-scope grade (empty list) and unknown subjects (D54)', async () => {
    for (const gradeLevel of [
      'DARJAH_1',
      'DARJAH_4',
      'DARJAH_6',
      'darjah_1',
      'TINGKATAN_1',
      'TINGKATAN_2',
      'TINGKATAN_3',
      'xyz',
    ]) {
      const r = await get<{ data: TopicCard[] }>('/api/topics', 'student', { gradeLevel })
      expect(r.body.data, gradeLevel).toEqual([])
    }
    // An empty grade is no filter: Tingkatan 4 + 5.
    const empty = await get<{ data: TopicCard[] }>('/api/topics', 'student', { gradeLevel: '' })
    expect(empty.body.data).toHaveLength(29)
    const zzz = await get<{ data: TopicCard[]; meta: { totalItems: number } }>(
      '/api/topics',
      'student',
      { subject: 'ZZZ' },
    )
    expect(zzz.status).toBe(200)
    expect(zzz.body.data).toEqual([])
    expect(zzz.body.meta.totalItems).toBe(0)
  })

  it('card: subject label has "_" → " "; preview is capped at 3 of up to 6 subtopics', async () => {
    const res = await get<{ data: TopicCard[] }>('/api/topics', 'student', {
      subject: 'BAHASA_MELAYU',
    })
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data.every((t) => t.subjectLabel === 'BAHASA MELAYU')).toBe(true)
    const all = (await get<{ data: TopicCard[] }>('/api/topics')).body.data
    const t103 = all.find((t) => t.id === 103)
    expect(t103?.subtopicCount).toBe(6)
    expect(t103?.subtopicsPreview).toEqual([
      'Kelestarian alam sekitar',
      'Sektor tenaga',
      'Sektor pengurusan sisa dan air sisa',
    ])
    expect(all.every((t) => t.subtopicCount >= 1 && t.subtopicCount <= 6)).toBe(true)
    expect(all.every((t) => t.subtopicsPreview.length <= 3)).toBe(true)
  })
})

describe('GET /api/topics/:id (#26, S13)', () => {
  it('guest 401; unknown and non-numeric ids 404', async () => {
    expect((await get('/api/topics/1', null)).status).toBe(401)
    expect((await get('/api/topics/126')).status).toBe(404)
    expect((await get('/api/topics/0')).status).toBe(404)
    const nf = await get('/api/topics/99999')
    expect(nf.status).toBe(404)
    expect(nf.body.error.code).toBe('NOT_FOUND')
    expect((await get('/api/topics/abc')).status).toBe(404)
  })

  it('returns the topic, subtopics with descriptions, practice code (BR-16) and zero progress without history', async () => {
    const res = await get<{ data: TopicDetail }>('/api/topics/4', 'student')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({
      id: 4,
      gradeLevel: 'DARJAH_1',
      subject: 'SAINS',
      subjectLabel: 'SAINS',
      practiceCode: 'SCI',
      name: 'Haiwan',
      description: 'Mengenal jenis-jenis haiwan',
      icon: '🐾',
      sequence: 3,
      subtopics: [
        {
          id: 6,
          name: 'Haiwan Peliharaan',
          description: 'Mengenal haiwan peliharaan seperti kucing, anjing',
          progress: 0,
        },
        {
          id: 7,
          name: 'Haiwan Liar',
          description: 'Mengenal haiwan liar seperti harimau, gajah',
          progress: 0,
        },
      ],
      progress: { questionsAnswered: 0, progress: 0 },
    })
  })

  it('practice code map covers all 8 subjects (BR-16)', async () => {
    const map: Record<string, string> = {
      MATEMATIK: 'MATH',
      BAHASA_MELAYU: 'BM',
      BAHASA_INGGERIS: 'BI',
      SAINS: 'SCI',
      PENDIDIKAN_ISLAM: 'PI',
      PENDIDIKAN_MORAL: 'PM',
      SEJARAH: 'SEJ',
      GEOGRAFI: 'GEO',
    }
    // S13 still resolves every stored topic (also the ones S12 no longer lists, e.g. Pendidikan Islam).
    const seen = new Map<string, string>()
    for (let id = 1; id <= 125 && seen.size < 8; id++) {
      const d = (await get<{ data: TopicDetail }>(`/api/topics/${String(id)}`)).body.data
      if (!seen.has(d.subject)) seen.set(d.subject, d.practiceCode)
    }
    expect(Object.fromEntries(seen)).toEqual(map)
  })

  it('null description, Tingkatan topic with 6 subtopics', async () => {
    const t103 = (await get<{ data: TopicDetail }>('/api/topics/103')).body.data
    expect(t103.subtopics).toHaveLength(6)
    expect(t103.subtopics[0]?.description).toBe('SK 4.6 Sains Tingkatan 4')
    expect(t103.subtopics[1]?.description).toBeNull()
    expect(t103.practiceCode).toBe('SCI')
    const t68 = (await get<{ data: TopicDetail }>('/api/topics/68')).body.data
    expect(t68.subtopics[0]?.description).toBe(
      'Kemahiran Bahasa Melayu SPM Tingkatan 5 berdasarkan DSKP KSSM',
    )
  })

  it('derives progress from the M05 answer log for the current user (pelajarmaju, SRS §6.9)', async () => {
    const t1 = (await get<{ data: TopicDetail }>('/api/topics/1', 'maju')).body.data
    expect(t1.progress).toEqual({ questionsAnswered: 23, progress: 95 })
    expect(t1.subtopics.map((s) => s.progress)).toEqual([95, 95, 95])
    expect((await get<{ data: TopicDetail }>('/api/topics/7', 'maju')).body.data.progress).toEqual({
      questionsAnswered: 7,
      progress: 15,
    })
    // Another user has no history.
    const other = (await get<{ data: TopicDetail }>('/api/topics/1', 'student')).body.data
    expect(other.progress).toEqual({ questionsAnswered: 0, progress: 0 })
  })
})

describe('GET /api/learning-map (#27, S14)', () => {
  it('guest gets 401', async () => {
    expect((await get('/api/learning-map', null)).status).toBe(401)
  })

  it('defaults to MATEMATIK + TINGKATAN_4 for every user (FR-84, D54)', async () => {
    const res = await get<{ data: LearningMap }>('/api/learning-map')
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d.subject).toBe('MATEMATIK')
    expect(d.subjectLabel).toBe('Matematik')
    expect(d.grade).toBe('TINGKATAN_4')
    expect(d.gradeOptions).toEqual(['TINGKATAN_4', 'TINGKATAN_5'])
    expect(d.topics.map((t) => t.name)).toEqual([
      'Fungsi dan Persamaan Kuadratik',
      'Sistem Persamaan',
      'Indeks, Surd dan Logaritma',
    ])
    // No history: topics 1-2 unlocked, the rest locked (OBSERVED).
    expect(d.topics.map((t) => t.state)).toEqual(['unlocked', 'unlocked', 'locked'])
    expect(d.topics.map((t) => t.practiceUrl)).toEqual([
      '/practice?topic_id=86',
      '/practice?topic_id=87',
      null,
    ])
    expect(d.stats).toEqual({ done: 0, total: 3, progress: 0 })
    expect(d.topics[0]).toMatchObject({ progress: 0, sessions: 0, questionsAnswered: 0 })
  })

  it('lists the 7 subject pills with observed colours; Geografi is not a pill (DV-M03-08)', async () => {
    const d = (await get<{ data: LearningMap }>('/api/learning-map')).body.data
    expect(d.subjects).toEqual([
      { code: 'MATEMATIK', label: 'Matematik', emoji: '🔢', color: '#3B82F6' },
      { code: 'BAHASA_MELAYU', label: 'Bahasa Melayu', emoji: '📝', color: '#10B981' },
      { code: 'BAHASA_INGGERIS', label: 'Bahasa Inggeris', emoji: '🇬🇧', color: '#8B5CF6' },
      { code: 'SAINS', label: 'Sains', emoji: '🔬', color: '#F59E0B' },
      { code: 'PENDIDIKAN_ISLAM', label: 'Pend. Islam', emoji: '☪️', color: '#14B8A6' },
      { code: 'PENDIDIKAN_MORAL', label: 'Pend. Moral', emoji: '🤝', color: '#F97316' },
      { code: 'SEJARAH', label: 'Sejarah', emoji: '🏛️', color: '#EF4444' },
    ])
    expect(d.subjects.some((s) => s.code === 'GEOGRAFI')).toBe(false)
  })

  it('accepts only TINGKATAN_4/5; anything else (Darjah included) is served as TINGKATAN_4 (BR-15, D54)', async () => {
    for (const grade of ['DARJAH_1', 'DARJAH_4', 'DARJAH_6', 'TINGKATAN_1', 'darjah_2', 'xyz', '']) {
      const d = (await get<{ data: LearningMap }>('/api/learning-map', 'student', { grade })).body
        .data
      expect(d.grade, grade).toBe('TINGKATAN_4')
    }
    for (const grade of ['TINGKATAN_4', 'TINGKATAN_5']) {
      const d = (await get<{ data: LearningMap }>('/api/learning-map', 'student', { grade })).body
        .data
      expect(d.grade).toBe(grade)
    }
  })

  it('subject labels: pills, GEOGRAFI, unknown code title-cased (FR-81)', async () => {
    const label = async (subject: string) =>
      (await get<{ data: LearningMap }>('/api/learning-map', 'student', { subject })).body.data
    expect((await label('PENDIDIKAN_ISLAM')).subjectLabel).toBe('Pend. Islam')
    expect((await label('BAHASA_INGGERIS')).subjectLabel).toBe('Bahasa Inggeris')
    const geo = await label('GEOGRAFI')
    expect(geo.subjectLabel).toBe('Geografi')
    expect(geo.subject).toBe('GEOGRAFI')
    // GEOGRAFI is not a pill, but its one Tingkatan 4 topic is served.
    expect(geo.topics.map((t) => t.name)).toEqual(['Geografi Tingkatan 4'])
    const zzz = await label('ZZZ')
    expect(zzz.subjectLabel).toBe('Zzz')
    expect(zzz.subject).toBe('ZZZ')
    expect(zzz.topics).toEqual([])
    expect(zzz.stats).toEqual({ done: 0, total: 0, progress: 0 })
    // A lower-case code is unknown (exact codes only) and is kept.
    expect((await label('matematik')).topics).toEqual([])
    // Empty subject = default.
    expect((await label('')).subject).toBe('MATEMATIK')
  })

  it('serves Tingkatan 4 and 5 subjects (T4 Sains 12 topics, T5 Sains 9, T5 Matematik none)', async () => {
    const t4 = (
      await get<{ data: LearningMap }>('/api/learning-map', 'student', {
        subject: 'SAINS',
        grade: 'TINGKATAN_4',
      })
    ).body.data
    expect(t4.stats.total).toBe(12)
    expect(t4.topics[0]?.name).toBe('Alat pemadam api')
    expect(t4.topics.map((t) => t.state).slice(0, 3)).toEqual(['unlocked', 'unlocked', 'locked'])
    const t5 = (
      await get<{ data: LearningMap }>('/api/learning-map', 'student', {
        subject: 'SAINS',
        grade: 'TINGKATAN_5',
      })
    ).body.data
    expect(t5.grade).toBe('TINGKATAN_5')
    expect(t5.stats.total).toBe(9)
    expect(t5.topics[0]?.name).toBe('Dunia mikroorganisma')
    const none = (
      await get<{ data: LearningMap }>('/api/learning-map', 'student', {
        subject: 'MATEMATIK',
        grade: 'TINGKATAN_5',
      })
    ).body.data
    expect(none.topics).toEqual([])
    expect(none.stats).toEqual({ done: 0, total: 0, progress: 0 })
  })

  it('derives states and stats from the M05 answer log (T4 Matematik chapters 91 / 92)', async () => {
    const rows = (n: number, correct: number, session: string) =>
      Array.from({ length: n }, (_, i) => ({ isCorrect: i < correct, sessionId: session }))
    const prev = connectAnswerLog({
      answersFor: (userId, chapterId) => {
        if (userId !== 2) return []
        if (chapterId === 91) return [...rows(20, 19, 'A'), ...rows(3, 0, 'B')] // 19 correct = 95 %
        if (chapterId === 92) return rows(7, 3, 'C') // 3 correct = 15 %
        return []
      },
    })
    try {
      const d = (
        await get<{ data: LearningMap }>('/api/learning-map', 'student', {
          subject: 'MATEMATIK',
          grade: 'TINGKATAN_4',
        })
      ).body.data
      expect(d.topics.map((t) => t.state)).toEqual(['mastered', 'started', 'unlocked'])
      expect(d.topics.map((t) => t.progress)).toEqual([95, 15, 0])
      expect(d.topics[0]).toMatchObject({ sessions: 2, questionsAnswered: 23 })
      expect(d.topics[1]).toMatchObject({ sessions: 1, questionsAnswered: 7 })
      expect(d.topics.map((t) => t.practiceUrl)).toEqual([
        '/practice?topic_id=86',
        '/practice?topic_id=87',
        '/practice?topic_id=88',
      ])
      // done = mastered; progress = round(avg(95,15,0)) = round(36.67) = 37.
      expect(d.stats).toEqual({ done: 1, total: 3, progress: 37 })
    } finally {
      connectAnswerLog(prev)
    }
  })

  it('a user with no history sees the default Tingkatan 4 state', async () => {
    const d = (
      await get<{ data: LearningMap }>('/api/learning-map', 'student', {
        subject: 'SAINS',
        grade: 'TINGKATAN_4',
      })
    ).body.data
    expect(d.topics.map((t) => t.state)).toEqual([
      'unlocked',
      'unlocked',
      ...Array.from({ length: 10 }, () => 'locked'),
    ])
    expect(d.stats).toEqual({ done: 0, total: 12, progress: 0 })
  })
})

describe('curriculum.chaptersByIds (M25 XR-M25-04, public read contract)', () => {
  it('returns {id, name, subjectId} in the order given, skipping unknown, out-of-tree and repeated ids', () => {
    expect(curriculum.chaptersByIds([413, 1, 35, 35, 99_999, 1300])).toEqual([
      { id: 413, name: 'Kemahiran Bahasa Tingkatan 5', subjectId: 1 },
      { id: 1, name: 'Nombor Bulat hingga 100', subjectId: 3 },
      { id: 35, name: 'Kemahiran Mendengar dan Bertutur', subjectId: 1 },
    ])
    expect(curriculum.chaptersByIds([])).toEqual([])
  })
})

describe('map rules (pure)', () => {
  const p = (progress: number, sessions: number, questionsAnswered: number) => ({
    legacyTopicId: 0,
    progress,
    sessions,
    questionsAnswered,
    correct: 0,
  })

  it('BR-14: mastered ≥ 80, started on any history, unlocked after started/mastered, else locked', () => {
    expect(islandStates([p(80, 1, 20), p(79, 1, 5), p(0, 0, 0), p(0, 0, 0)])).toEqual([
      'mastered',
      'started',
      'unlocked',
      'locked',
    ])
    // A started topic after a locked one is still started (history wins).
    expect(islandStates([p(0, 0, 0), p(0, 0, 0), p(0, 0, 0), p(10, 0, 3)])).toEqual([
      'unlocked',
      'unlocked',
      'locked',
      'started',
    ])
    expect(islandStates([])).toEqual([])
  })

  it('BR-15: labels', () => {
    expect(MAP_SUBJECTS).toHaveLength(7)
    expect(mapSubjectLabel('MATEMATIK')).toBe('Matematik')
    expect(mapSubjectLabel('PENDIDIKAN_MORAL')).toBe('Pend. Moral')
    expect(mapSubjectLabel('GEOGRAFI')).toBe('Geografi')
    expect(mapSubjectLabel('ZZZ')).toBe('Zzz')
    expect(mapSubjectLabel('ILMU_BARU')).toBe('Ilmu baru')
  })
})

describe('fault hooks on the student routes', () => {
  it('failNext / networkErrorNext apply to the student endpoints', async () => {
    runtime.faults.failNext('GET /api/topics', 500)
    const failed = await get('/api/topics')
    expect(failed.status).toBe(500)
    expect((await get('/api/topics')).status).toBe(200) // one-shot

    runtime.faults.networkErrorNext('GET /api/learning-map')
    await expect(get('/api/learning-map')).rejects.toBeTruthy()
    expect((await get('/api/learning-map')).status).toBe(200)
  })

  it('a connected answer reader is kept, not replaced by the lazy M05 wiring', async () => {
    const prev = connectAnswerLog({
      answersFor: (userId, chapterId) =>
        userId === 2 && chapterId === 322
          ? Array.from({ length: 4 }, () => ({ isCorrect: true, sessionId: 'X' }))
          : [],
    })
    try {
      // This reader serves chapter 322 only (Sains Tingkatan 4 Bab 1), i.e. the first Sains T4 topic.
      const sains = (
        await get<{ data: TopicCard[] }>('/api/topics', 'student', {
          gradeLevel: 'TINGKATAN_4',
          subject: 'SAINS',
        })
      ).body.data
      const d = (await get<{ data: TopicDetail }>(`/api/topics/${String(sains[0]?.id)}`, 'student'))
        .body.data
      expect(d.progress).toEqual({ questionsAnswered: 4, progress: 20 })
    } finally {
      connectAnswerLog(prev)
    }
    // The reader before this test was already wired to M05 by the earlier requests.
    expect(prev).not.toBe(EMPTY_ANSWER_LOG)
  })
})
