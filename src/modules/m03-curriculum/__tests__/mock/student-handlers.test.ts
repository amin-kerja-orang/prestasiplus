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
}, 60_000)

describe('GET /api/topics (#25, S12)', () => {
  it('guest gets 401; any role may read', async () => {
    expect((await get('/api/topics', null)).status).toBe(401)
    for (const as of ['admin', 'student', 'teacher'] as const) {
      expect((await get('/api/topics', as)).status).toBe(200)
    }
  })

  it('lists all 125 topics in sequence order, unpaged, with the card shape', async () => {
    const res = await get<{ data: TopicCard[]; meta: Record<string, number> }>('/api/topics')
    expect(res.body.data).toHaveLength(125)
    expect(res.body.meta).toMatchObject({ totalItems: 125, page: 1, pageSize: 125, totalPages: 1 })
    const first = res.body.data[0]
    expect(first).toEqual({
      id: 1,
      gradeLevel: 'DARJAH_1',
      subject: 'MATEMATIK',
      subjectLabel: 'MATEMATIK',
      name: 'Nombor',
      description: 'Belajar nombor 1 hingga 100',
      subtopicCount: 3,
      subtopicsPreview: ['Tambah 1-10', 'Tolak 1-10', 'Kiraan 1-100'],
    })
  })

  it('filters by gradeLevel and subject, AND, case-insensitive (BR-13)', async () => {
    const grade = await get<{ data: TopicCard[] }>('/api/topics', 'student', {
      gradeLevel: 'DARJAH_1',
    })
    expect(grade.body.data).toHaveLength(17)
    const lower = await get<{ data: TopicCard[] }>('/api/topics', 'student', {
      gradeLevel: 'darjah_1',
    })
    expect(lower.body.data).toHaveLength(17)
    const both = await get<{ data: TopicCard[] }>('/api/topics', 'student', {
      gradeLevel: 'DARJAH_1',
      subject: 'SAINS',
    })
    expect(both.body.data).toHaveLength(4)
    const counts: [string, number][] = [
      ['MATEMATIK', 34],
      ['SAINS', 35],
      ['BAHASA_MELAYU', 15],
      ['PENDIDIKAN_MORAL', 12],
      ['SEJARAH', 11],
      ['PENDIDIKAN_ISLAM', 7],
      ['BAHASA_INGGERIS', 6],
      ['GEOGRAFI', 5],
    ]
    for (const [subject, n] of counts) {
      const r = await get<{ data: TopicCard[] }>('/api/topics', 'student', { subject })
      expect(r.body.data, subject).toHaveLength(n)
    }
    const geo = await get<{ data: TopicCard[] }>('/api/topics', 'student', { subject: 'geografi' })
    expect(geo.body.data).toHaveLength(5)
  })

  it('Tingkatan filters, empty grades and unknown codes (empty state)', async () => {
    const t1 = await get<{ data: TopicCard[] }>('/api/topics', 'student', {
      gradeLevel: 'TINGKATAN_1',
    })
    expect(t1.body.data).toHaveLength(34)
    for (const [gradeLevel, n] of [
      ['TINGKATAN_2', 0],
      ['TINGKATAN_3', 0],
      ['TINGKATAN_4', 19],
      ['TINGKATAN_5', 10],
      ['DARJAH_2', 11],
      ['DARJAH_3', 9],
      ['DARJAH_4', 9],
      ['DARJAH_5', 8],
      ['DARJAH_6', 8],
    ] as const) {
      const r = await get<{ data: TopicCard[] }>('/api/topics', 'student', { gradeLevel })
      expect(r.body.data, gradeLevel).toHaveLength(n)
    }
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
    expect(res.body.data.every((t) => t.subjectLabel === 'BAHASA MELAYU')).toBe(true)
    const all = (await get<{ data: TopicCard[] }>('/api/topics')).body.data
    const t7 = all.find((t) => t.id === 7)
    expect(t7?.subtopicCount).toBe(4)
    expect(t7?.subtopicsPreview).toEqual(['Membilang 1-20', 'Membilang 21-50', 'Membilang 51-100'])
    const t103 = all.find((t) => t.id === 103)
    expect(t103?.subtopicCount).toBe(6)
    expect(t103?.subtopicsPreview).toHaveLength(3)
    expect(all.every((t) => t.subtopicCount >= 1 && t.subtopicCount <= 6)).toBe(true)
    expect(all.every((t) => t.subtopicsPreview.length <= 3)).toBe(true)
    expect(all.reduce((n, t) => n + t.subtopicCount, 0)).toBe(335)
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
    const all = (await get<{ data: TopicCard[] }>('/api/topics')).body.data
    for (const [subject, code] of Object.entries(map)) {
      const id = all.find((t) => t.subject === subject)?.id as number
      const res = await get<{ data: TopicDetail }>(`/api/topics/${String(id)}`)
      expect(res.body.data.practiceCode, subject).toBe(code)
    }
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

  it('defaults to MATEMATIK + DARJAH_4 for every user (FR-84)', async () => {
    const res = await get<{ data: LearningMap }>('/api/learning-map')
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d.subject).toBe('MATEMATIK')
    expect(d.subjectLabel).toBe('Matematik')
    expect(d.grade).toBe('DARJAH_4')
    expect(d.gradeOptions).toEqual(['DARJAH_1', 'DARJAH_2', 'DARJAH_3', 'DARJAH_4'])
    expect(d.topics.map((t) => t.name)).toEqual(['Nombor Hingga 100 000', 'Perpuluhan', 'Geometri'])
    expect(d.topics.map((t) => t.icon)).toEqual(['🔢', '🔣', null])
    // No history: topics 1-2 unlocked, the rest locked (OBSERVED).
    expect(d.topics.map((t) => t.state)).toEqual(['unlocked', 'unlocked', 'locked'])
    expect(d.topics.map((t) => t.practiceUrl)).toEqual([
      '/practice?topic_id=38',
      '/practice?topic_id=39',
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

  it('accepts only DARJAH_1..4; anything else is served as DARJAH_4 (BR-15)', async () => {
    for (const grade of ['DARJAH_5', 'DARJAH_6', 'TINGKATAN_1', 'darjah_2', 'xyz', '']) {
      const d = (await get<{ data: LearningMap }>('/api/learning-map', 'student', { grade })).body
        .data
      expect(d.grade, grade).toBe('DARJAH_4')
    }
    for (const grade of ['DARJAH_1', 'DARJAH_2', 'DARJAH_3', 'DARJAH_4']) {
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
    expect(geo.topics).toEqual([]) // no GEOGRAFI topic in Darjah 4
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

  it('serves other subject and grade combinations (Darjah 1 Sains has 4 topics)', async () => {
    const d = (
      await get<{ data: LearningMap }>('/api/learning-map', 'student', {
        subject: 'SAINS',
        grade: 'DARJAH_1',
      })
    ).body.data
    expect(d.stats.total).toBe(4)
    expect(d.topics.map((t) => t.state)).toEqual(['unlocked', 'unlocked', 'locked', 'locked'])
    expect(d.topics[0]?.id).toBe(4)
    expect(d.topics[0]?.name).toBe('Haiwan')
  })

  it('derives pelajarmaju states and stats from the M05 answer-log anchors (SRS §6.9)', async () => {
    const d = (
      await get<{ data: LearningMap }>('/api/learning-map', 'maju', {
        subject: 'MATEMATIK',
        grade: 'DARJAH_1',
      })
    ).body.data
    expect(d.topics.map((t) => t.name)).toEqual([
      'Nombor',
      'Nombor Bulat Hingga 100',
      'Bentuk',
      'Operasi Tambah dan Tolak',
      'Bentuk dan Ruang',
    ])
    expect(d.topics.map((t) => t.state)).toEqual([
      'mastered',
      'started',
      'started',
      'unlocked',
      'locked',
    ])
    expect(d.topics.map((t) => t.progress)).toEqual([95, 15, 20, 0, 0])
    expect(d.topics[0]).toMatchObject({ sessions: 3, questionsAnswered: 23 })
    expect(d.topics[1]).toMatchObject({ sessions: 2, questionsAnswered: 7 })
    expect(d.topics[2]).toMatchObject({ sessions: 2, questionsAnswered: 7 })
    expect(d.topics.map((t) => t.practiceUrl)).toEqual([
      '/practice?topic_id=1',
      '/practice?topic_id=7',
      '/practice?topic_id=2',
      '/practice?topic_id=8',
      null,
    ])
    // done = mastered; progress = round(avg(95,15,20,0,0)) = round(26) = 26.
    expect(d.stats).toEqual({ done: 1, total: 5, progress: 26 })
  })

  it('a user with no history sees the default Darjah 1 state', async () => {
    const d = (
      await get<{ data: LearningMap }>('/api/learning-map', 'student', {
        subject: 'MATEMATIK',
        grade: 'DARJAH_1',
      })
    ).body.data
    expect(d.topics.map((t) => t.state)).toEqual([
      'unlocked',
      'unlocked',
      'locked',
      'locked',
      'locked',
    ])
    expect(d.stats).toEqual({ done: 0, total: 5, progress: 0 })
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
        userId === 2 && chapterId === 18
          ? Array.from({ length: 4 }, () => ({ isCorrect: true, sessionId: 'X' }))
          : [],
    })
    try {
      // This reader serves chapter 18 only (Sains Darjah 1 Bab 1, SRS §6.9), i.e. the first Sains D1 topic.
      const sains = (
        await get<{ data: TopicCard[] }>('/api/topics', 'student', {
          gradeLevel: 'DARJAH_1',
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
