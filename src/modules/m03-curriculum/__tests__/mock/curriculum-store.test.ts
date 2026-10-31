import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { createClock } from '@/lib/time'
import { checkNamedQueries } from '@/mock/dataset'
import { defineMockCore } from '@/mock/define'
import { bootMock, type MockRuntime } from '@/mock/index'
import { RepositoryError } from '@/mock/repository'

import plugin, {
  curriculum,
  curriculumLevels,
  curriculumSubjectLevels,
  curriculumSubjects,
  curriculumSubtopics,
  curriculumTopics,
  legacySubtopics,
  legacyTopics,
} from '../../mock'
import {
  chapterQueries,
  chaptersTable,
  connectAnswerLog,
  EMPTY_ANSWER_LOG,
  legacySubtopicQueries,
  legacyTopicQueries,
  levelQueries,
  subjectLevelQueries,
  subjectQueries,
  subtopicQueries,
  topicQueries,
  type AnswerLogRow,
} from '../../mock/repository'
import { curriculumFixture } from '../../mock/seeds/curriculum'

const NOW = '2026-09-25T15:40:00+08:00'
const NOW_MS = Date.parse(NOW)

let runtime: MockRuntime

function boot() {
  return bootMock({
    mode: 'test',
    // A core with one student session for the lookup endpoints; the registry is the real one
    // (M01–M10: M03 plus the other slice stubs).
    core: defineMockCore({
      resolveSession: (token) =>
        token === 'tok-student' ? { token, userId: 2, role: 'student' } : null,
    }),
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
  })
}

function catchRepoError(fn: () => unknown): RepositoryError {
  try {
    fn()
  } catch (err) {
    expect(err).toBeInstanceOf(RepositoryError)
    return err as RepositoryError
  }
  throw new Error('expected a RepositoryError')
}

// The real registry boot compiles every module store (M04's question dataset takes ~2 s).
beforeAll(async () => {
  runtime = await boot()
}, 600_000)

/**
 * Re-seeding boots every registry store (M04's question dataset included), so only tests that
 * change data ask for it (`mutates()`); read-only tests share the seed.
 */
let dirty = false
function mutates(): void {
  dirty = true
}

afterEach(async () => {
  connectAnswerLog(EMPTY_ANSWER_LOG)
  if (dirty) await runtime.reset()
  dirty = false
}, 600_000)

describe('M03 plugin in bootMock', () => {
  it('loads with the other registry stubs and seeds the eight stores', () => {
    // Independent of how many modules the registry lists: M03 is there, once, after M01/M02 and
    // before M04 (its dependants), and the registry is in module order.
    const ids = runtime.modules.map((m) => m.id)
    expect(ids.filter((id) => id === 'M03')).toHaveLength(1)
    expect(ids.slice(0, 4)).toEqual(['M01', 'M02', 'M03', 'M04'])
    expect([...ids].sort()).toEqual(ids)
    expect(runtime.seedSteps).toContain('seed:M03')
    expect(plugin.version).toBe('3')
    expect(Object.values(plugin.tables).map((t) => t.name)).toEqual([
      'curriculum.levels',
      'curriculum.subjects',
      'curriculum.subjectLevels',
      'curriculum.chapters',
      'curriculum.topics',
      'curriculum.subtopics',
      'curriculum.legacyTopics',
      'curriculum.legacySubtopics',
    ])
    expect(Object.keys(plugin.repositories)).toEqual([
      'curriculum',
      'curriculumLevels',
      'curriculumSubjects',
      'curriculumSubjectLevels',
      'curriculumTopics',
      'curriculumSubtopics',
      'legacyTopics',
      'legacySubtopics',
    ])
  })
})

describe('totals and named queries (SRS v1.8 §6.10)', () => {
  it('every documented named-query value holds on the seed', () => {
    for (const queries of [
      levelQueries,
      subjectQueries,
      subjectLevelQueries,
      chapterQueries,
      topicQueries,
      subtopicQueries,
      legacyTopicQueries,
      legacySubtopicQueries,
    ]) {
      expect(checkNamedQueries(queries)).toEqual([])
    }
  })

  it('golden totals through the public repositories', () => {
    expect(curriculumLevels.count('LVL-ALL')).toBe(11)
    expect(curriculumSubjects.count('SUBJ-ALL')).toBe(31)
    expect(curriculumSubjects.count('SUBJ-CORE')).toBe(7)
    expect(curriculumSubjectLevels.count('LINK-ALL')).toBe(194)
    expect(curriculum.count('CH-ALL')).toBe(1251)
    expect(curriculumTopics.count('TP-ALL')).toBe(2423)
    expect(curriculumSubtopics.count('ST-ALL')).toBe(234)
    expect(legacyTopics.count('LT-ALL')).toBe(125)
    expect(legacySubtopics.count('LS-ALL')).toBe(335)
    // 140 pairs with chapters, 54 empty (of the 194 trees).
    const pairs = curriculum.subjectLevelPairs()
    expect(pairs).toHaveLength(194)
    expect(pairs.filter(([s, l]) => curriculum.count('CH-PAIR', s, l) > 0)).toHaveLength(140)
    // M06 "Subjek SPM": distinct subjects linked to Tingkatan 4 or 5 = 25.
    expect(curriculumSubjectLevels.groupCount('LINK-LEVELS', 'subjectId', [10, 11]).size).toBe(25)
  })

  it('per-level topic and subtopic counts', () => {
    const topicsPerLevel = [55, 57, 47, 48, 51, 51, 356, 418, 334, 530, 476]
    const subtopicsPerLevel = [35, 37, 40, 36, 43, 43, 0, 0, 0, 0, 0]
    topicsPerLevel.forEach((expected, i) => {
      const chapterIds = curriculum.query('CH-LEVEL', {}, i + 1).rows.map((c) => c.id)
      expect(curriculumTopics.count('TP-CHAPTERS', chapterIds)).toBe(expected)
      const topicIds = curriculumTopics.query('TP-CHAPTERS', {}, chapterIds).rows.map((t) => t.id)
      expect(curriculumSubtopics.count('ST-TOPICS', topicIds)).toBe(subtopicsPerLevel[i])
    })
  })

  it('S1 tree of Matematik T4: "10" chapters, "24 / 0" (E2E-M03-02)', () => {
    expect(curriculum.tree(3, 10).stats).toEqual({ chapters: 10, topics: 24, subtopics: 0 })
    expect(curriculum.tree(2, 9).stats).toEqual({ chapters: 0, topics: 0, subtopics: 0 })
  })
})

describe('kept live ids (SRS v1.9 §6.9, 38 named records)', () => {
  const chapters: [number, number, number, string][] = [
    // [id, subjectId, levelId, "Bab n: name"]
    [35, 1, 1, 'Bab 1: Kemahiran Mendengar dan Bertutur'],
    [36, 1, 1, 'Bab 2: Kemahiran Membaca'],
    [91, 3, 10, 'Bab 1: Fungsi dan Persamaan Kuadratik'],
    [92, 3, 10, 'Bab 2: Asas Nombor'],
    [1, 3, 1, 'Bab 1: Nombor Bulat hingga 100'],
    [3, 3, 2, 'Bab 1: Nombor Bulat hingga 1000'],
    [18, 4, 1, 'Bab 1: Sains Hayat'],
    [57, 2, 1, 'Bab 1: Listening and Speaking'],
    [120, 6, 1, 'Bab 1: Akidah D1'],
    [142, 7, 1, 'Bab 1: Nilai Diri D1'],
    [164, 5, 1, 'Bab 1: Asas Sejarah D1'],
    [179, 12, 1, 'Bab 1: Asas Geografi D1'],
    [263, 18, 1, 'Bab 1: Kemahiran Mendengar dan Bertutur (الاستماع والتحدث)'],
    [325, 26, 1, 'Bab 1: Mengenal Huruf Jawi'],
    [258, 23, 11, 'Bab 1: Pengurusan dan Kepimpinan'],
    [259, 23, 11, 'Bab 2: Kewangan Perniagaan'],
    [260, 23, 11, 'Bab 3: Pemasaran (Lanjutan)'],
    [261, 23, 11, 'Bab 4: Perniagaan Antarabangsa'],
    [262, 23, 11, 'Bab 5: Etika dan Tanggungjawab Sosial'],
    [1280, 23, 11, 'Bab 6: Persediaan Memulakan Perniagaan'],
    [1281, 23, 11, 'Bab 7: Merancang Pengendalian Perniagaan'],
    [413, 1, 11, 'Bab 99: Kemahiran Bahasa Tingkatan 5'],
    [362, 4, 11, 'Bab 1: Dunia mikroorganisma'],
    [363, 4, 11, 'Bab 2: Diet seimbang dan nilai kalori'],
    [347, 4, 11, 'Bab 3: Kelestarian Alam Sekitar'],
    [364, 4, 11, 'Bab 4: Aplikasi kadar tindak balas'],
    [365, 4, 11, 'Bab 5: Alkohol'],
    [366, 4, 11, 'Bab 6: Sel elektrolisis'],
    [367, 4, 11, 'Bab 7: Alat optik'],
    [368, 4, 11, 'Bab 8: Tekanan dalam bendalir'],
    [369, 4, 11, 'Bab 9: Satelit'],
  ]

  it('31 chapters keep their live ids and exact titles', () => {
    expect(chapters).toHaveLength(31)
    for (const [id, subjectId, levelId, title] of chapters) {
      const c = curriculum.chapter(id)
      expect(c, `chapter ${String(id)}`).toBeDefined()
      expect(`Bab ${String(c?.chapterNumber)}: ${String(c?.name)}`).toBe(title)
      expect([c?.subjectId, c?.educationLevelId]).toEqual([subjectId, levelId])
    }
    expect(curriculum.chapter(91)?.nameEn).toBe('Functions and Quadratic Equations')
  })

  it('topics 59, 60, 126, 127 and subtopics 132, 133, 134', () => {
    expect(curriculum.topic(59)).toMatchObject({ chapterId: 35, name: 'Mendengar dan Memahami' })
    expect(curriculum.topic(60)).toMatchObject({ chapterId: 36, name: 'Membaca Perkataan' })
    expect(curriculum.topic(126)).toMatchObject({
      chapterId: 91,
      name: 'Fungsi',
      nameEn: 'Functions',
    })
    expect(curriculum.topic(127)).toMatchObject({ chapterId: 91, name: 'Persamaan kuadratik' })
    const kept: [number, number, string][] = [
      [132, 59, 'Mendengar sebutan dan intonasi'],
      [133, 59, 'Bertutur untuk menyatakan permintaan'],
      [134, 60, 'Mengenal huruf dan suku kata'],
    ]
    for (const [id, topicId, name] of kept) {
      expect(curriculum.subtopic(id), `subtopic ${String(id)}`).toMatchObject({ topicId, name })
    }
    // Live row order: 132, 133 under topic 59; 134 first under topic 60.
    expect(curriculum.subtopics(59).map((s) => s.id)).toEqual([132, 133])
    expect(curriculum.subtopics(60)[0]?.id).toBe(134)
    // 31 chapters + 4 topics + 3 subtopics = 38 named records (SRS v1.9 §6.9).
    expect(chapters.length + 4 + kept.length).toBe(38)
  })

  it('S1 "Topik / Subtopik" through TP-CHAPTERS / ST-TOPICS (SRS v1.9 §6.11)', () => {
    const t4 = curriculum.query('CH-PAIR', {}, 3, 10).rows.map((c) => c.id)
    expect(curriculumTopics.count('TP-CHAPTERS', t4)).toBe(24)
    const t4Topics = curriculumTopics.query('TP-CHAPTERS', {}, t4).rows.map((t) => t.id)
    expect(curriculumSubtopics.count('ST-TOPICS', t4Topics)).toBe(0)
    const bmD1 = curriculum.query('CH-PAIR', {}, 1, 1).rows.map((c) => c.id)
    const bmD1Topics = curriculumTopics.query('TP-CHAPTERS', {}, bmD1).rows.map((t) => t.id)
    expect(curriculumSubtopics.count('ST-TOPICS', bmD1Topics)).toBe(7)
  })

  it('chapter ids are ≤ 1281 and not contiguous; topic and subtopic ids are contiguous', () => {
    const ids = curriculum.query('CH-ALL', {}).rows.map((c) => c.id)
    expect(Math.max(...ids)).toBe(1281)
    expect(ids.filter((id) => id >= 1250 && id <= 1279)).toEqual([])
    expect(curriculumTopics.query('TP-ALL', {}).rows.map((t) => t.id)).toEqual(
      Array.from({ length: 2423 }, (_, i) => i + 1),
    )
    expect(curriculumSubtopics.query('ST-ALL', {}).rows.map((s) => s.id)).toEqual(
      Array.from({ length: 234 }, (_, i) => i + 1),
    )
  })
})

describe('DV-M03-09 and BR-08 ordering', () => {
  it('no chapter number ≥ 100 and no repeated topic number inside a chapter', () => {
    const all = curriculum.query('CH-ALL', {}).rows
    expect(all.filter((c) => c.chapterNumber === null || c.chapterNumber >= 100)).toEqual([])
    for (const c of all) {
      const numbers = curriculum.topics(c.id).map((t) => t.topicNumber)
      expect(new Set(numbers).size, `chapter ${String(c.id)}`).toBe(numbers.length)
    }
  })

  it('Matematik D1 reads Bab 1…8; Matematik T4 Bab 1 topics 1, 2, 3 (E2E-M03-05)', () => {
    expect(curriculum.chapters(3, 1).map((c) => c.chapterNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(curriculum.topics(91).map((t) => [t.topicNumber, t.name])).toEqual([
      ['1', 'Fungsi'],
      ['2', 'Fungsi dan Persamaan Kuadratik'],
      ['3', 'Persamaan kuadratik'],
    ])
  })

  it('SK T3 has consecutive chapter numbers after the fix', () => {
    const numbers = curriculum.chapters(17, 9).map((c) => c.chapterNumber)
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, i) => i + 1))
  })
})

describe('legacy catalogue (DATA-M03-06)', () => {
  it('BR-13 filters are case-insensitive; unknown codes match nothing', () => {
    expect(curriculum.legacyTopics({ gradeLevel: 'darjah_1' })).toHaveLength(17)
    expect(
      curriculum.legacyTopics({ gradeLevel: 'DARJAH_1', subject: 'SAINS' }).map((t) => t.name),
    ).toEqual(['Haiwan', 'Hidupan', 'Tumbuhan', 'Fizikal dan Bahan'])
    expect(curriculum.legacyTopics({ gradeLevel: 'TINGKATAN_2' })).toEqual([])
    expect(curriculum.legacyTopics({ subject: 'ZZZ' })).toEqual([])
  })

  it('names, subtopics, descriptions and observed icons', () => {
    expect(
      curriculum
        .legacyTopics({ gradeLevel: 'DARJAH_1', subject: 'MATEMATIK' })
        .map((t) => [t.id, t.name, t.icon]),
    ).toEqual([
      [1, 'Nombor', '🔢'],
      [7, 'Nombor Bulat Hingga 100', '🔢'],
      [expect.any(Number), 'Bentuk', null],
      [expect.any(Number), 'Operasi Tambah dan Tolak', null],
      [expect.any(Number), 'Bentuk dan Ruang', null],
    ])
    expect(curriculum.legacySubtopics(7).map((s) => s.name)).toEqual([
      'Membilang 1-20',
      'Membilang 21-50',
      'Membilang 51-100',
      'Menulis Nombor dalam Perkataan',
    ])
    expect(curriculum.legacySubtopics(4).map((s) => s.description)).toEqual([
      'Mengenal haiwan peliharaan seperti kucing, anjing',
      'Mengenal haiwan liar seperti harimau, gajah',
    ])
    expect(curriculum.legacyTopic(69)?.description).toBeNull()
    expect(curriculumFixture().legacyTopics.filter((t) => t.icon !== null)).toHaveLength(36)
  })
})

describe('topic progress (BR-19, derived on read)', () => {
  it('is the empty state until the M05 answer log is connected', () => {
    expect(curriculum.topicProgress(4, 1)).toEqual({
      legacyTopicId: 1,
      sessions: 0,
      questionsAnswered: 0,
      correct: 0,
      progress: 0,
    })
  })

  it('maps topic k to chapter k and applies the formula (SRS §6.9 pelajarmaju figures)', () => {
    const [bab1, bab2, bab3] = curriculum.chapters(3, 1)
    const ids = curriculum
      .legacyTopics({ gradeLevel: 'DARJAH_1', subject: 'MATEMATIK' })
      .map((t) => t.id)
    expect(ids.slice(0, 3).map((id) => curriculum.topicChapterId(id))).toEqual([
      bab1?.id,
      bab2?.id,
      bab3?.id,
    ])
    expect(bab1?.id).toBe(1)

    const rows = (n: number, correct: number, sessions: string[]): AnswerLogRow[] =>
      Array.from({ length: n }, (_, i) => ({
        isCorrect: i < correct,
        sessionId: sessions[i % sessions.length] ?? null,
      }))
    const log = new Map<number, AnswerLogRow[]>([
      [bab1?.id ?? 0, rows(23, 19, ['M1', 'M2', 'M3'])],
      [bab2?.id ?? 0, rows(7, 3, ['M3', 'M4'])],
      [bab3?.id ?? 0, rows(7, 4, ['M3', 'M4'])],
    ])
    connectAnswerLog({
      answersFor: (userId, chapterId) => (userId === 4 ? (log.get(chapterId) ?? []) : []),
    })

    expect(curriculum.topicProgress(4, 1)).toEqual({
      legacyTopicId: 1,
      sessions: 3,
      questionsAnswered: 23,
      correct: 19,
      progress: 95,
    })
    expect(curriculum.topicProgress(4, 7).progress).toBe(15)
    expect(curriculum.topicProgress(4, ids[2] ?? 0).progress).toBe(20)
    expect(curriculum.topicProgress(4, ids[3] ?? 0).progress).toBe(0)
    expect(curriculum.topicProgress(2, 1).questionsAnswered).toBe(0)
  })
})

describe('writes, runtime ids and ownership (D12)', () => {
  it('runtime ids start at the floor: chapter 1342, topic 2424, subtopic 235', () => {
    mutates()
    const chapter = curriculum.createChapter(
      { subjectId: 3, educationLevelId: 10, name: 'Bab 11 Demo', chapterNumber: 11 },
      NOW_MS,
    )
    expect(chapter.id).toBe(1342)
    const topic = curriculum.createTopic({ chapterId: chapter.id, name: 'Topik Demo' }, NOW_MS)
    expect(topic.id).toBe(2424)
    const sub = curriculum.createSubtopic({ topicId: topic.id, name: 'Sub Demo' }, NOW_MS)
    expect(sub.id).toBe(235)
    // Runtime timestamps are Malaysia time (+08:00), like the rest of the mock (F24-2).
    for (const row of [chapter, topic, sub]) {
      expect(row.createdAt).toBe('2026-09-25T15:40:00+08:00')
      expect(row.updatedAt).toBe('2026-09-25T15:40:00+08:00')
    }
    // Every runtime floor lies above every kept or seeded id (chapters ≤ 1341 incl. out-of-tree, topics ≤ 2423, subtopics ≤ 234).
    expect(chapter.id).toBeGreaterThan(1341)
    expect(sub.id).toBeGreaterThan(134)
    expect(curriculum.chapters(3, 10).at(-1)?.id).toBe(1342)
    expect(curriculum.count('CH-ALL')).toBe(1252)
    // The write went through the db: it is part of the persisted diff.
    expect(runtime.db.diff()).toHaveProperty(['curriculum.chapters', 'upserts', 0, 'id'], 1342)
  })

  it('deleting a chapter cascades to its topics and subtopics (BR-10)', () => {
    mutates()
    expect(curriculum.deleteChapter(35)).toEqual({ chapters: 1, topics: 1, subtopics: 2 })
    expect(curriculum.topic(59)).toBeUndefined()
    expect(curriculum.subtopic(132)).toBeUndefined()
    expect(curriculum.count('CH-ALL')).toBe(1250)
    expect(curriculumTopics.count('TP-ALL')).toBe(2422)
    expect(curriculumSubtopics.count('ST-ALL')).toBe(232)
    expect(curriculum.deleteChapter(99_999)).toBeNull()
  })

  it('inactive records leave the lookups but stay in the admin lists (BR-11)', async () => {
    mutates()
    curriculum.setSubjectActive(12, false, NOW_MS)
    curriculum.setLevelActive(11, false, NOW_MS)
    expect(curriculumSubjects.count('SUBJ-ALL')).toBe(31)
    expect(curriculumSubjects.count('SUBJ-ACTIVE')).toBe(30)
    const res = await runtime.transport.request({
      method: 'GET',
      url: '/api/subjects',
      headers: { authorization: 'Bearer tok-student', accept: 'application/json' },
    })
    const ids = (res.body as { data: { id: number }[] }).data.map((s) => s.id)
    expect(ids).toHaveLength(30)
    expect(ids).not.toContain(12)
    const levels = await runtime.transport.request({
      method: 'GET',
      url: '/api/education-levels',
      headers: { authorization: 'Bearer tok-student', accept: 'application/json' },
    })
    // Secondary-only (D72): the Darjah levels are never offered.
    expect((levels.body as { data: { code: string }[] }).data.map((l) => l.code)).toEqual([
      'T1',
      'T2',
      'T3',
      'T4',
    ])
  })

  it('a direct write to a curriculum store is refused (OWNERSHIP)', () => {
    const row = curriculum.chapter(1)
    expect(catchRepoError(() => chaptersTable.update(1, { name: 'x' })).code).toBe('OWNERSHIP')
    expect(catchRepoError(() => chaptersTable.remove(1)).code).toBe('OWNERSHIP')
    expect(curriculum.chapter(1)).toEqual(row)
  })

  it('only the M03 seed may load the fixture, and only in the seed phase', () => {
    const fixture = curriculumFixture()
    expect(
      catchRepoError(() => curriculum.seedFixture({ module: 'M04', db: runtime.db }, fixture)).code,
    ).toBe('OWNERSHIP')
    expect(
      catchRepoError(() => curriculum.seedFixture({ module: 'M03', db: runtime.db }, fixture)).code,
    ).toBe('PHASE')
  })
})

describe('lookup endpoints (#28, #29)', () => {
  it('ignore an unknown or non-numeric educationLevelId and list every active subject (F24-1)', async () => {
    for (const value of ['999', 'abc']) {
      const res = await runtime.transport.request({
        method: 'GET',
        url: '/api/subjects',
        query: { educationLevelId: value },
        headers: { authorization: 'Bearer tok-student', accept: 'application/json' },
      })
      expect(res.status).toBe(200)
      expect((res.body as { data: unknown[] }).data, value).toHaveLength(31)
    }
  })

  it('require a session and answer the unpaged envelope', async () => {
    const guest = await runtime.transport.request({
      method: 'GET',
      url: '/api/subjects',
      headers: {},
    })
    expect(guest.status).toBe(401)
    const res = await runtime.transport.request({
      method: 'GET',
      url: '/api/subjects',
      query: { educationLevelId: '10' },
      headers: { authorization: 'Bearer tok-student', accept: 'application/json' },
    })
    expect(res.status).toBe(200)
    const body = res.body as {
      data: { id: number; code: string; isCore: boolean }[]
      meta: unknown
    }
    expect(body.data).toHaveLength(25)
    expect(body.meta).toMatchObject({ page: 1, totalPages: 1, totalItems: 25, pageSize: 25 })
    expect(body.data[0]).toEqual({
      id: 1,
      code: 'BM',
      name: 'Bahasa Melayu',
      nameEn: 'Malay Language',
      icon: 'book-open',
      color: '#3B82F6',
      isCore: true,
      educationLevelIds: [7, 8, 9, 10, 11],
    })
  })
})

describe('test-only records (override curriculumInactiveDemo)', () => {
  it('Sejarah Darjah 1 gets the inactive chapter and topic: 3 chapters, "3 / 0" (E2E-M03-06)', async () => {
    mutates()
    await runtime.reset({ curriculumInactiveDemo: true })
    expect(curriculum.tree(5, 1).stats).toEqual({ chapters: 3, topics: 3, subtopics: 0 })
    const demo = curriculum.chapters(5, 1).at(-1)
    expect(demo).toMatchObject({
      id: 1342,
      inTree: true,
      chapterNumber: 3,
      name: 'Bab Tidak Aktif Demo',
      isActive: false,
    })
    expect(curriculum.topics(1342)).toMatchObject([
      { id: 2424, topicNumber: '1', name: 'Topik Tidak Aktif Demo', isActive: false },
    ])
  })
})

describe('out-of-tree chapters (SRS v1.10 §6.9, XL3-24)', () => {
  it('60 records outside the tree: CH-ALL 1,251 vs CH-ALL-INCL-ORPHAN 1,311', () => {
    expect(curriculum.count('CH-ALL')).toBe(1251)
    expect(curriculum.count('CH-ALL-INCL-ORPHAN')).toBe(1311)
    expect(curriculum.count('CH-SUBJECT-INCL-ORPHAN', 14)).toBe(56)
    expect(curriculum.count('CH-SUBJECT-INCL-ORPHAN', 27)).toBe(9)
    expect(curriculum.count('CH-SUBJECT-INCL-ORPHAN', 28)).toBe(1)
    expect(curriculum.count('CH-SUBJECT-INCL-ORPHAN', 3)).toBe(94)
    expect(curriculum.count('CH-SUBJECT', 14)).toBe(0)
    expect(curriculum.count('CH-SUBJECT', 27)).toBe(6)
    const orphans = curriculum.query('CH-ALL-INCL-ORPHAN', {}).rows.filter((c) => !c.inTree)
    expect(orphans.map((c) => c.id)).toEqual(Array.from({ length: 60 }, (_, i) => 1282 + i))
    expect(orphans.map((c) => c.subjectId)).toEqual([
      ...Array<number>(56).fill(14),
      ...Array<number>(3).fill(27),
      28,
    ])
    for (const c of orphans) {
      expect(c).toMatchObject({
        educationLevelId: null,
        name: null,
        nameEn: null,
        chapterNumber: null,
        description: null,
        isActive: true,
      })
    }
  })

  it('tree reads never see them: Pendidikan Muzik + Darjah 1 stays empty (E2E-M03-51)', () => {
    expect(curriculum.tree(14, 1)).toEqual({
      stats: { chapters: 0, topics: 0, subtopics: 0 },
      chapters: [],
    })
    expect(curriculum.chapter(1282)).toBeUndefined()
    expect(curriculum.chapter(1341)).toBeUndefined()
    expect(
      curriculum.updateChapter(
        1282,
        {
          subjectId: 14,
          educationLevelId: 1,
          name: 'x',
          isActive: true,
        },
        NOW_MS,
      ),
    ).toBeUndefined()
    expect(curriculum.deleteChapter(1282)).toBeNull()
    expect(
      catchRepoError(() => curriculum.createTopic({ chapterId: 1282, name: 'x' }, NOW_MS)).code,
    ).toBe('CONTRACT')
    // BR-19 ordering reads the tree only: Matematik D1 topic 1 still maps to chapter 1.
    expect(curriculum.topicChapterId(1)).toBe(1)
    expect(curriculum.count('CH-ALL-INCL-ORPHAN')).toBe(1311)
  })

  it('the runtime chapter floor is 1342 and new chapters are in the tree', () => {
    mutates()
    const c = curriculum.createChapter(
      { subjectId: 14, educationLevelId: 1, name: 'Bab Muzik Demo', chapterNumber: 1 },
      NOW_MS,
    )
    expect(c).toMatchObject({ id: 1342, inTree: true })
    expect(curriculum.tree(14, 1).stats.chapters).toBe(1)
    expect(curriculum.count('CH-ALL')).toBe(1252)
    expect(curriculum.count('CH-ALL-INCL-ORPHAN')).toBe(1312)
  })

  it('deleting a subject also removes its out-of-tree chapters (BR-10)', () => {
    mutates()
    expect(curriculum.deleteSubject(27)).toBe(true)
    expect(curriculum.count('CH-SUBJECT-INCL-ORPHAN', 27)).toBe(0)
    expect(curriculum.count('CH-ALL')).toBe(1245)
    expect(curriculum.count('CH-ALL-INCL-ORPHAN')).toBe(1302)
    expect(curriculum.deleteSubject(14)).toBe(true)
    expect(curriculum.count('CH-ALL-INCL-ORPHAN')).toBe(1246)
    expect(curriculum.count('CH-ALL')).toBe(1245)
  })
})
