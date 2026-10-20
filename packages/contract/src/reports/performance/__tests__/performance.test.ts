import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../openapi'
import {
  PERFORMANCE_HEADCOUNT_MESSAGES,
  PERFORMANCE_TIMELINE_MESSAGES,
  PerformanceClassAnalyticsSchema,
  PerformanceClassDashboardSchema,
  PerformanceHeadcountAutoSetupRequestSchema,
  PerformanceHeadcountCreateRequestSchema,
  PerformanceHeadcountDetailSchema,
  PerformanceHeadcountDropRequestSchema,
  PerformanceLeaderboardSchema,
  PerformanceLevelDetailSchema,
  PerformancePublicProfileSchema,
  PerformanceRankingSchema,
  PerformanceSchoolItemAnalysisSchema,
  PerformanceSchoolSchema,
  PerformanceTimelineCreateRequestSchema,
  PerformanceTimelinePostSchema,
} from '../schema'
import { PERFORMANCE_COMPONENT_SCHEMAS } from '../paths'

const post = {
  id: '11',
  userId: '5',
  title: 'Sijil Contoh',
  category: 'sijil',
  eventDate: '2026-03-01',
  story: null,
  photos: [{ url: 'https://files.example.test/a.jpg', caption: null }],
  createdAt: '2026-10-16T09:30:00+08:00',
}

/** Field to message map of a failed parse (first issue per top-level field). */
const fieldMessages = (r: {
  success: boolean
  error?: { issues: { path: PropertyKey[]; message: string }[] }
}) => {
  const out: Record<string, string> = {}
  for (const i of r.error?.issues ?? []) out[String(i.path[0])] ??= i.message
  return out
}

describe('performance contract (BE-19)', () => {
  it('wires the exact BM message for every headcount create field', () => {
    const M = PERFORMANCE_HEADCOUNT_MESSAGES
    expect(fieldMessages(PerformanceHeadcountCreateRequestSchema.safeParse({}))).toEqual({
      classroomId: M.classRequired,
      subjectId: M.subjectInvalid,
      educationLevelId: M.levelInvalid,
      academicYear: M.yearInvalid,
      activeOtrs: M.otrInvalid,
      mode: M.modeInvalid,
    })
    const bad = {
      classroomId: '',
      subjectId: '1',
      educationLevelId: '10',
      academicYear: 2019,
      activeOtrs: 6,
      mode: 'x',
    }
    expect(fieldMessages(PerformanceHeadcountCreateRequestSchema.safeParse(bad))).toEqual({
      classroomId: M.classInvalid,
      academicYear: M.yearInvalid,
      activeOtrs: M.otrInvalid,
      mode: M.modeInvalid,
    })
    // The mock coerces digit strings (form posts).
    const form = {
      classroomId: '4',
      subjectId: '2',
      educationLevelId: '10',
      academicYear: '2026',
      activeOtrs: '3',
      mode: 'manual',
    }
    expect(PerformanceHeadcountCreateRequestSchema.safeParse(form).success).toBe(true)
  })

  it('wires the BM messages of auto-setup and drop-students', () => {
    const M = PERFORMANCE_HEADCOUNT_MESSAGES
    expect(
      fieldMessages(PerformanceHeadcountAutoSetupRequestSchema.safeParse({ levels: [] })),
    ).toEqual({ levels: M.levelsRequired })
    expect(fieldMessages(PerformanceHeadcountAutoSetupRequestSchema.safeParse({}))).toEqual({
      levels: M.levelsRequired,
    })
    expect(
      fieldMessages(PerformanceHeadcountAutoSetupRequestSchema.safeParse({ levels: [true] })),
    ).toEqual({ levels: M.levelInvalid })
    expect(
      PerformanceHeadcountAutoSetupRequestSchema.safeParse({ levels: [10, 'T5'] }).success,
    ).toBe(true)
    expect(
      fieldMessages(PerformanceHeadcountAutoSetupRequestSchema.safeParse({ levels: ['X9'] })),
    ).toEqual({ levels: M.levelInvalid })
    expect(
      fieldMessages(
        PerformanceHeadcountDropRequestSchema.safeParse({ action: 'x', studentIds: [] }),
      ),
    ).toEqual({
      action: M.actionInvalid,
      studentIds: M.studentsRequired,
    })
    expect(
      fieldMessages(
        PerformanceHeadcountDropRequestSchema.safeParse({ action: 'drop', studentIds: [5] }),
      ),
    ).toEqual({ studentIds: M.studentsInvalid })
  })

  it('wires the BM messages of the timeline create fields', () => {
    const M = PERFORMANCE_TIMELINE_MESSAGES
    expect(fieldMessages(PerformanceTimelineCreateRequestSchema.safeParse({}))).toEqual({
      title: M.titleRequired,
      category: M.categoryInvalid,
      photos: M.photosRequired,
    })
    const bad = {
      title: 'x'.repeat(151),
      category: 'cerita',
      eventDate: 'bukan',
      story: 's'.repeat(2001),
      photos: ['f'],
    }
    expect(fieldMessages(PerformanceTimelineCreateRequestSchema.safeParse(bad))).toEqual({
      title: M.titleTooLong,
      eventDate: M.dateInvalid,
      story: M.storyTooLong,
    })
    expect(
      fieldMessages(
        PerformanceTimelineCreateRequestSchema.safeParse({
          title: '  ',
          category: 'lain',
          photos: Array(6).fill('f'),
        }),
      ),
    ).toEqual({
      title: M.titleRequired,
      photos: M.photosRequired,
    })
    expect(
      PerformanceTimelineCreateRequestSchema.safeParse({
        title: 'T',
        category: 'lain',
        eventDate: '',
        photos: ['f'],
      }).success,
    ).toBe(true)
  })

  it('parses a timeline post and rejects a non-MYT timestamp', () => {
    expect(PerformanceTimelinePostSchema.safeParse(post).success).toBe(true)
    expect(
      PerformanceTimelinePostSchema.safeParse({ ...post, createdAt: '2026-10-16T01:30:00Z' })
        .success,
    ).toBe(false)
    expect(PerformanceTimelinePostSchema.safeParse({ ...post, id: 11 }).success).toBe(false)
    expect(PerformanceTimelinePostSchema.safeParse({ ...post, category: 'lain2' }).success).toBe(
      false,
    )
  })

  it('validates the timeline create request limits', () => {
    const ok = { title: 'Tajuk', category: 'cerita', photos: ['f1'] }
    expect(PerformanceTimelineCreateRequestSchema.safeParse(ok).success).toBe(true)
    expect(PerformanceTimelineCreateRequestSchema.safeParse({ ...ok, photos: [] }).success).toBe(
      false,
    )
    expect(
      PerformanceTimelineCreateRequestSchema.safeParse({ ...ok, photos: Array(6).fill('f') })
        .success,
    ).toBe(false)
    expect(
      PerformanceTimelineCreateRequestSchema.safeParse({ ...ok, title: 'x'.repeat(151) }).success,
    ).toBe(false)
    expect(
      PerformanceTimelineCreateRequestSchema.safeParse({ ...ok, eventDate: '01-03-2026' }).success,
    ).toBe(false)
  })

  it('validates headcount requests', () => {
    const ok = {
      classroomId: '4',
      subjectId: '2',
      educationLevelId: '10',
      academicYear: 2026,
      activeOtrs: 3,
      mode: 'auto',
    }
    expect(PerformanceHeadcountCreateRequestSchema.safeParse(ok).success).toBe(true)
    expect(
      PerformanceHeadcountCreateRequestSchema.safeParse({ ...ok, activeOtrs: 6 }).success,
    ).toBe(false)
    expect(
      PerformanceHeadcountCreateRequestSchema.safeParse({ ...ok, academicYear: 2019 }).success,
    ).toBe(false)
    expect(
      PerformanceHeadcountCreateRequestSchema.safeParse({ ...ok, mode: 'hybrid' }).success,
    ).toBe(false)
    expect(
      PerformanceHeadcountAutoSetupRequestSchema.safeParse({ levels: ['T4', '11'] }).success,
    ).toBe(true)
    expect(PerformanceHeadcountAutoSetupRequestSchema.safeParse({ levels: [] }).success).toBe(false)
    expect(
      PerformanceHeadcountDropRequestSchema.safeParse({ action: 'drop', studentIds: ['1'] })
        .success,
    ).toBe(true)
    expect(
      PerformanceHeadcountDropRequestSchema.safeParse({ action: 'x', studentIds: ['1'] }).success,
    ).toBe(false)
    expect(
      PerformanceHeadcountDropRequestSchema.safeParse({ action: 'drop', studentIds: [] }).success,
    ).toBe(false)
    expect(PERFORMANCE_HEADCOUNT_MESSAGES.duplicate.auto).toBe(
      'Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud.',
    )
  })

  it('parses a headcount detail table', () => {
    const detail = {
      config: {
        id: '1',
        subject: 'Matematik',
        className: '4 Contoh',
        levelName: 'Tingkatan 4',
        year: 2026,
        teacherName: 'Guru Contoh',
        status: 'active',
        activeOtrs: 2,
      },
      chips: { onTrack: 1, below: 0, empty: 0, total: 1 },
      rows: [
        {
          userId: '9',
          name: 'Murid Contoh',
          tov: 55,
          tovGrade: 'C+',
          etr: null,
          etrGrade: null,
          dropped: false,
          cells: [
            { target: 60, targetGrade: 'B', ar: 62, arGrade: 'B', tone: 'above' },
            { target: 65, targetGrade: 'B+', ar: null, arGrade: null, tone: 'na' },
          ],
        },
      ],
      averages: { tov: 55, otrs: [60, null], ars: [62, null], etr: null },
    }
    expect(PerformanceHeadcountDetailSchema.safeParse(detail).success).toBe(true)
    expect(
      PerformanceHeadcountDetailSchema.safeParse({
        ...detail,
        config: { ...detail.config, status: 'closed' },
      }).success,
    ).toBe(false)
  })

  it('parses ranking, leaderboard and public profile', () => {
    expect(
      PerformanceRankingSchema.safeParse({
        scope: null,
        title: 'Kedudukan Nasional',
        showFooter: true,
        states: ['Negeri Contoh'],
        rows: [
          {
            rank: 1,
            userId: null,
            name: 'Murid Contoh',
            schoolName: 'SMK Contoh',
            tahap: 3,
            correct: 10,
            accuracy: 88.5,
          },
        ],
        total: 1,
      }).success,
    ).toBe(true)
    expect(
      PerformanceLeaderboardSchema.safeParse({
        period: 'week',
        me: { rank: null, coins: 0, sessions: 0, accuracy: 0 },
        rows: [
          {
            rank: 1,
            userId: '2',
            name: 'Murid Contoh',
            avatarUrl: null,
            coins: 5,
            sessions: 1,
            accuracy: 100,
          },
        ],
        participants: 1,
      }).success,
    ).toBe(true)
    expect(
      PerformanceLeaderboardSchema.safeParse({
        period: 'year',
        me: { rank: null, coins: 0, sessions: 0, accuracy: 0 },
        rows: [],
        participants: 0,
      }).success,
    ).toBe(false)
    const profile = {
      id: '2',
      name: 'Murid Contoh',
      firstName: 'Murid',
      schoolName: null,
      levelName: 'Tingkatan 4',
      joinedAt: '2026-01-01T08:00:00+08:00',
      daysWith: 100,
      tier: {
        key: 'bronze',
        name: 'Gangsa',
        emoji: 'B',
        level: 1,
        ordinal: 1,
        progressPct: 50,
        toNext: 10,
        nextName: 'Perak',
        nextKey: 'silver',
      },
      syiling: 10,
      streak: { current: 1, best: 2 },
      accuracy: 70,
      activity: { sessions: 1, practiceDays: 1, correct: 7, bestStreak: 2 },
      posts: [post],
    }
    expect(PerformancePublicProfileSchema.safeParse(profile).success).toBe(true)
    // The mock does not bound percentages: unusual data must still parse.
    expect(PerformancePublicProfileSchema.safeParse({ ...profile, accuracy: 120 }).success).toBe(
      true,
    )
    expect(PerformancePublicProfileSchema.safeParse({ ...profile, accuracy: '70' }).success).toBe(
      false,
    )
  })

  it('parses class dashboard, class analytics, level detail and school item analysis', () => {
    expect(
      PerformanceClassDashboardSchema.safeParse({
        class: {
          id: '4',
          name: '4 Contoh',
          school: 'SMK Contoh',
          subject: null,
          year: 2026,
          joinCode: 'ABC123',
        },
        stats: {
          students: 1,
          accuracy: 70,
          sessions: 2,
          answered: 10,
          avgMinutes: 3.5,
          active7d: 1,
        },
        headcount: null,
        attention: [{ userId: '9', name: 'Murid Contoh', sessions: 0, accuracy: null }],
        trend: [{ date: '2026-10-15', sessions: 2, avgAccuracy: 70, activeStudents: 1 }],
        ranking: [
          {
            rank: 1,
            userId: '9',
            name: 'Murid Contoh',
            sessions: 2,
            answered: 10,
            accuracy: null,
            headcount: 'na',
            lastActiveAt: null,
          },
        ],
      }).success,
    ).toBe(true)
    expect(
      PerformanceClassAnalyticsSchema.safeParse({
        options: {
          classes: [],
          subjects: [],
          selected: { classroomId: null, subjectId: null, riskLevel: '' },
        },
        summary: null,
        rows: [],
      }).success,
    ).toBe(true)
    expect(PerformanceLevelDetailSchema.safeParse({ code: 't6' }).success).toBe(false)
    const school = {
      school: {
        id: '3',
        name: 'SMK Contoh',
        code: null,
        type: 'SMK',
        district: null,
        state: 'Negeri Contoh',
      },
      variant: 'byId',
      tingkatan: null,
      students: 0,
      answers: null,
      correct: null,
      accuracy: null,
      difficulty: { mudah: 0, sederhana: 0, sukar: 0 },
      gps: { value: null, band: null, entries: 0, years: [] },
      subjects: [],
      questions: [],
    }
    expect(PerformanceSchoolItemAnalysisSchema.safeParse(school).success).toBe(true)
    expect(
      PerformanceSchoolItemAnalysisSchema.safeParse({ ...school, variant: 'other' }).success,
    ).toBe(false)
  })

  it('parses a school performance payload and rejects a bad grade', () => {
    const body = {
      scope: 'school',
      header: { classCount: 1, studentCount: 2 },
      stats: {
        students: 2,
        teachers: 1,
        classes: 1,
        subjects: 1,
        sessions: 3,
        answered: 30,
        accuracy: 66.7,
      },
      gps: { value: null, band: null, entries: 0 },
      distribution: [{ grade: 'A+', count: 0, pct: 0 }],
      trend: {
        years: [
          {
            year: 2026,
            gps: null,
            band: null,
            candidates: null,
            source: null,
            change: null,
            current: true,
          },
        ],
        chart: { labels: [2026], overall: [null], subjects: [] },
      },
      subjects: [],
      levels: [{ code: 't4', accuracy: 60, classes: 1, students: 2, sessions: 3 }],
      teachers: [],
    }
    expect(PerformanceSchoolSchema.safeParse(body).success).toBe(true)
    expect(
      PerformanceSchoolSchema.safeParse({
        ...body,
        distribution: [{ grade: 'F', count: 0, pct: 0 }],
      }).success,
    ).toBe(false)
  })

  it('registers every BE-19 path and component in the OpenAPI document', () => {
    const doc = buildOpenApiDocument() as {
      paths: Record<string, Record<string, unknown>>
      components: { schemas: Record<string, unknown> }
    }
    const expected: [string, string][] = [
      ['get', '/analytics/me'],
      ['get', '/analytics/classes'],
      ['get', '/performance/students/{userId}'],
      ['get', '/performance/classes'],
      ['get', '/performance/classes/{id}'],
      ['get', '/performance/levels'],
      ['get', '/performance/levels/{code}'],
      ['get', '/performance/school'],
      ['get', '/item-analysis/classes'],
      ['get', '/item-analysis/classes/{id}'],
      ['get', '/item-analysis/school'],
      ['get', '/item-analysis/school/{schoolId}'],
      ['get', '/rankings'],
      ['get', '/leaderboard'],
      ['get', '/public/students/{id}'],
      ['get', '/timeline'],
      ['post', '/timeline'],
      ['get', '/weekly-report'],
      ['get', '/headcounts'],
      ['get', '/headcounts/dashboard'],
      ['get', '/headcounts/form-options'],
      ['get', '/headcounts/{id}'],
      ['get', '/headcounts/{id}/summary'],
      ['get', '/headcounts/{id}/export'],
      ['get', '/headcounts/students/{userId}'],
      ['post', '/headcounts'],
      ['post', '/headcounts/auto-setup'],
      ['post', '/headcounts/{id}/drop-students'],
      ['post', '/headcounts/{id}/reset'],
      ['delete', '/headcounts/{id}'],
    ]
    expect(expected).toHaveLength(30)
    for (const [method, path] of expected)
      expect(doc.paths[path]?.[method], `${method} ${path}`).toBeDefined()
    for (const name of Object.keys(PERFORMANCE_COMPONENT_SCHEMAS))
      expect(doc.components.schemas[name], name).toBeDefined()
  })
})
