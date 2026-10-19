import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../openapi'
import { PRACTICE_READS_COMPONENT_SCHEMAS } from '../paths'
import {
  PRACTICE_READS_HISTORY_BADGES,
  PRACTICE_READS_MASTERY_LABELS,
  PRACTICE_READS_MASTERY_THRESHOLDS,
  PRACTICE_READS_MESSAGES,
  PracticeReadChapterSubjectDetailSchema,
  PracticeReadChapterSubjectListResponseSchema,
  PracticeReadCorrectionsSchema,
  PracticeReadDashboardSchema,
  PracticeReadHistoryResponseSchema,
  PracticeReadMasterySchema,
  PracticeReadProgressSchema,
  PracticeReadRevisionOverviewSchema,
  PracticeReadRevisionSubjectSchema,
  PracticeReadSpmTargetsSaveRequestSchema,
  PracticeReadSpmTargetsSaveResponseSchema,
  PracticeReadSpmTargetsSchema,
  PracticeReadStructuredAttemptRequestSchema,
  PracticeReadStructuredAttemptResultSchema,
  PracticeReadStructuredDetailSchema,
  PracticeReadStructuredListResponseSchema,
  PracticeReadSubjectConfigSchema,
  PracticeReadSubjectListResponseSchema,
} from '../schema'
import { PRACTICE_MODES } from '../../schema'

const NOW = '2026-10-16T09:30:00+08:00'
const SESSION_ID = '0b5d2f6e-3c1a-4f7e-9a52-6d1c8e4b7a10'
const meta = (n: number) => ({ page: 1, pageSize: Math.max(1, n), totalItems: n, totalPages: 1, from: n ? 1 : null, to: n ? n : null })

const subject = {
  id: '3',
  code: 'MATH',
  name: 'Matematik',
  nameEn: 'Mathematics',
  icon: 'calculator',
  color: '#2563eb',
  isCore: true,
  approvedCount: 120,
  bankCount: 140,
}
const trial = { active: true, used: 4, limit: 50, remaining: 46 }
const diff = { '1': 1, '2': 2, '3': 3, '4': 2, '5': 1 }

const dashboard = {
  user: { id: '77', name: 'Murid Contoh', role: 'student' },
  greetingPeriod: 'Pagi',
  trial,
  streak: { count: 2, practisedToday: true },
  wallet: { coins: 120, points: 340, level: 3, levelProgressPct: 45.5 },
  week: { sessions: 4, accuracyPct: 72 },
  banners: [{ type: 'info', title: 'Selamat datang', body: null }],
  quests: [
    { key: '9', emoji: '🎯', title: 'Jawab 10 soalan', difficulty: 'easy', description: 'Jawab 10 soalan hari ini', target: 10, reward: 5, progress: 4, completed: false },
  ],
  questsCompleted: 0,
  badges: [{ id: '12', name: 'Pemula', icon: 'star', rarityLabel: null, awardedAt: NOW }],
  revisionTotal: 24,
  articles: [{ slug: 'tips-belajar', title: 'Tips', category: 'Tips Belajar', publishedAt: NOW }],
  subjects: [subject],
  stats: { totalQuestions: 140, activeSubjects: 1, activeLevels: 4, approvedQuestions: 120 },
  levelPills: [{ code: 'D1', name: 'Darjah 1', stage: 'primary', count: 30 }],
  recentQuestions: [{ id: '501', subjectName: 'Matematik', difficulty: 2, text: 'Berapakah 2 + 3?', createdAt: NOW, levelCode: 'D1' }],
  difficultyChart: [1, 2, 3, 4, 5].map((level) => ({ level, count: level })),
  subjectStats: [{ id: '3', name: 'Matematik', icon: null, color: '#2563eb', bankCount: 140, avgDifficulty: 2.41, usedCount: 0 }],
}

const historyItem = {
  id: SESSION_ID,
  mode: 'chapter',
  badge: { label: 'Bab', icon: 'fa-layer-group', color: '#0D9488' },
  completedAt: NOW,
  questionCount: 10,
  correctCount: 7,
  wrongCount: 3,
  accuracyPct: 70,
  timeSpent: 240,
  coinsEarned: 8,
}

const structuredAttempt = {
  id: '9001',
  userId: '77',
  structuredQuestionId: '4001',
  scope: null,
  track: null,
  answers: [{ subQuestionId: '1', text: 'Jawapan panjang lebih daripada dua puluh aksara.' }],
  marks: [{ subQuestionId: '1', awarded: 2, max: 2 }],
  totalAwarded: 2,
  totalMax: 2,
  submittedAt: NOW,
  modelAnswers: [{ subQuestionId: '1', text: 'Jawapan model.' }],
}

describe('dashboard', () => {
  it('accepts the mock shape (ids as strings)', () => {
    expect(PracticeReadDashboardSchema.safeParse(dashboard).success).toBe(true)
  })
  it('rejects a numeric id (UD-1), a non +08:00 timestamp and an unknown greeting', () => {
    expect(PracticeReadDashboardSchema.safeParse({ ...dashboard, user: { ...dashboard.user, id: 77 } }).success).toBe(false)
    expect(
      PracticeReadDashboardSchema.safeParse({
        ...dashboard,
        badges: [{ ...dashboard.badges[0], awardedAt: '2026-10-16T01:30:00Z' }],
      }).success,
    ).toBe(false)
    expect(PracticeReadDashboardSchema.safeParse({ ...dashboard, greetingPeriod: 'Subuh' }).success).toBe(false)
  })
  it('rejects an unknown key (strict)', () => {
    expect(PracticeReadDashboardSchema.safeParse({ ...dashboard, secret: 1 }).success).toBe(false)
  })
})

describe('subjects and chapters', () => {
  it('accepts the unpaged subject list meta', () => {
    expect(PracticeReadSubjectListResponseSchema.safeParse({ data: [subject], meta: meta(1) }).success).toBe(true)
    expect(PracticeReadSubjectListResponseSchema.safeParse({ data: [], meta: meta(0) }).success).toBe(true)
  })
  it('accepts a subject config and rejects a missing difficulty bucket', () => {
    const config = {
      subject,
      total: 9,
      levels: [{ id: '1', code: 'D1', name: 'Darjah 1', count: 9 }],
      difficultyStats: diff,
      difficultyByLevel: { '1': diff },
      subjectiveCounts: {},
      trial,
    }
    expect(PracticeReadSubjectConfigSchema.safeParse(config).success).toBe(true)
    const four: Record<string, number> = { ...diff }
    delete four['5']
    expect(PracticeReadSubjectConfigSchema.safeParse({ ...config, difficultyStats: four }).success).toBe(false)
  })
  it('accepts chapter lists and detail, with a null level when none is offered', () => {
    expect(
      PracticeReadChapterSubjectListResponseSchema.safeParse({
        data: [{ code: 'MATH', name: 'Matematik', icon: null, color: '#2563eb', chapterCount: 5, questionCount: 90 }],
        meta: meta(1),
      }).success,
    ).toBe(true)
    const chapter = { id: '31', number: 1, name: 'Nombor', total: 20, answered: 20, correct: 15, scorePct: 75, remaining: 0, state: 'open', complete: true }
    const detail = { subject: { code: 'MATH', name: 'Matematik', color: '#2563eb' }, levels: [{ id: '1', name: 'Darjah 1', count: 20 }], levelId: '1', chapters: [chapter] }
    expect(PracticeReadChapterSubjectDetailSchema.safeParse(detail).success).toBe(true)
    expect(PracticeReadChapterSubjectDetailSchema.safeParse({ ...detail, levels: [], levelId: null, chapters: [] }).success).toBe(true)
    expect(PracticeReadChapterSubjectDetailSchema.safeParse({ ...detail, chapters: [{ ...chapter, state: 'done' }] }).success).toBe(false)
  })
})

describe('revision', () => {
  it('accepts the overview and a zero count detail', () => {
    expect(
      PracticeReadRevisionOverviewSchema.safeParse({
        total: 3,
        subjects: [{ code: 'MATH', name: 'Matematik', nameEn: 'Mathematics', icon: null, color: '#2563eb', count: 3 }],
      }).success,
    ).toBe(true)
    expect(
      PracticeReadRevisionSubjectSchema.safeParse({ subject: { id: '3', code: 'MATH', name: 'Matematik', color: '#2563eb' }, count: 0 }).success,
    ).toBe(true)
  })
  it('rejects a subject card with count 0 and a negative total', () => {
    expect(
      PracticeReadRevisionOverviewSchema.safeParse({
        total: 0,
        subjects: [{ code: 'MATH', name: 'Matematik', nameEn: 'Mathematics', icon: null, color: '#2563eb', count: 0 }],
      }).success,
    ).toBe(false)
    expect(PracticeReadRevisionOverviewSchema.safeParse({ total: -1, subjects: [] }).success).toBe(false)
  })
})

describe('progress, history, corrections, mastery', () => {
  const emptyProgress = { period: null, answered: 0, accuracyPct: null, sessions: 0, minutes: 0, chart: { labels: [], accuracy: [], counts: [] }, weakSubjects: [], subjects: [] }
  it('accepts the empty progress of an unknown period', () => {
    expect(PracticeReadProgressSchema.safeParse(emptyProgress).success).toBe(true)
    expect(PracticeReadProgressSchema.safeParse({ ...emptyProgress, period: '14' }).success).toBe(false)
  })
  it('accepts a filled progress', () => {
    expect(
      PracticeReadProgressSchema.safeParse({
        period: '30',
        answered: 10,
        accuracyPct: 60.5,
        sessions: 2,
        minutes: 7,
        chart: { labels: ['15/10'], accuracy: [60.5], counts: [10] },
        weakSubjects: [{ code: 'MATH', name: 'Matematik', color: '#2563eb', answered: 10, accuracyPct: 40 }],
        subjects: [{ code: 'MATH', name: 'Matematik', color: '#2563eb', answered: 10, correct: 4, wrong: 6, accuracyPct: 40, trend: [40] }],
      }).success,
    ).toBe(true)
  })
  it('accepts a history page with totals in meta and rejects missing totals or a bad mode', () => {
    const totals = { sessions: 1, answered: 10, avgAccuracyPct: 70, coins: 8 }
    const ok = { data: [historyItem], meta: { page: 1, pageSize: 15, totalItems: 1, totalPages: 1, from: 1, to: 1, totals } }
    expect(PracticeReadHistoryResponseSchema.safeParse(ok).success).toBe(true)
    expect(PracticeReadHistoryResponseSchema.safeParse({ ...ok, meta: { ...ok.meta, totals: undefined } }).success).toBe(false)
    expect(PracticeReadHistoryResponseSchema.safeParse({ ...ok, data: [{ ...historyItem, mode: 'exam' }] }).success).toBe(false)
    expect(PracticeReadHistoryResponseSchema.safeParse({ ...ok, data: [{ ...historyItem, id: '12' }] }).success).toBe(false)
  })
  it('has a badge for every session mode', () => {
    expect(Object.keys(PRACTICE_READS_HISTORY_BADGES).sort()).toEqual([...PRACTICE_MODES].sort())
  })
  it('accepts corrections with and without a summary', () => {
    const base = { month: '2026-10', prevMonth: '2026-09', nextMonth: null, summary: null, subjects: [] }
    expect(PracticeReadCorrectionsSchema.safeParse(base).success).toBe(true)
    expect(
      PracticeReadCorrectionsSchema.safeParse({
        ...base,
        summary: { before: 50, after: 75, delta: 25, questions: 8 },
        subjects: [{ name: 'Matematik', color: '#2563eb', questions: 8, before: 50, after: 75, delta: 25 }],
      }).success,
    ).toBe(true)
    expect(PracticeReadCorrectionsSchema.safeParse({ ...base, month: '2026-13' }).success).toBe(false)
  })
  it('accepts mastery cards including level 10 and rejects level 11', () => {
    const card = (level: number) => ({
      code: 'MATH', name: 'Matematik', icon: null, color: '#2563eb', level, label: PRACTICE_READS_MASTERY_LABELS[Math.min(level, 10)] as string,
      correct: 1500, answered: 1600, accuracyPct: 93.8, nextLevel: level === 10 ? null : level + 1, nextThreshold: level === 10 ? null : 1,
      barPct: 100, xpMultiplier: level >= 2 ? 1.45 : null, lastAnsweredAt: NOW,
    })
    const scale = PRACTICE_READS_MASTERY_LABELS.map((label, level) => ({ level, label }))
    expect(PracticeReadMasterySchema.safeParse({ scale, subjects: [card(10)] }).success).toBe(true)
    expect(PracticeReadMasterySchema.safeParse({ scale, subjects: [card(11)] }).success).toBe(false)
    expect(PRACTICE_READS_MASTERY_THRESHOLDS).toHaveLength(PRACTICE_READS_MASTERY_LABELS.length)
  })
})

describe('structured questions', () => {
  const card = {
    id: '4001', subjectId: '1', subjectName: 'Bahasa Melayu', kbatLevel: 4, estimatedMinutes: 10, isTrial: false,
    preview: 'Baca petikan...', topic: null, author: 'Guru Pakar', school: null, subQuestionCount: 3, levelName: 'Tingkatan 5', parts: 2, marks: 10,
  }
  it('accepts a list page with scope, track and subjectOptions', () => {
    expect(
      PracticeReadStructuredListResponseSchema.safeParse({
        data: [card],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, from: 1, to: 1, scope: 'spm', track: 'bahasa', subjectOptions: [{ id: '1', name: 'Bahasa Melayu' }] },
      }).success,
    ).toBe(true)
  })
  it('rejects a list meta with an unknown scope', () => {
    expect(
      PracticeReadStructuredListResponseSchema.safeParse({
        data: [], meta: { ...meta(0), scope: 'upsr', track: null, subjectOptions: [] },
      }).success,
    ).toBe(false)
  })
  it('detail never carries a model answer', () => {
    const detail = {
      id: '4001', subjectId: '1', subjectName: 'Bahasa Melayu', levelName: 'Tingkatan 5', stimulus: 'Petikan', stimulusImage: null,
      subQuestions: [{ id: '1', label: '(a)', text: 'Soalan', marks: 2 }], backUrl: '/latihan-berstruktur',
    }
    expect(PracticeReadStructuredDetailSchema.safeParse(detail).success).toBe(true)
    expect(
      PracticeReadStructuredDetailSchema.safeParse({ ...detail, subQuestions: [{ ...detail.subQuestions[0], modelAnswer: 'x' }] }).success,
    ).toBe(false)
  })
  it('attempt request: valid bodies parse, bad ones are rejected', () => {
    const answers = [{ subQuestionId: '1', text: 'Jawapan' }]
    expect(PracticeReadStructuredAttemptRequestSchema.safeParse({ answers }).success).toBe(true)
    expect(PracticeReadStructuredAttemptRequestSchema.safeParse({ answers, scope: 'spm', track: 'bahasa' }).success).toBe(true)
    expect(PracticeReadStructuredAttemptRequestSchema.safeParse({ answers, scope: null, track: null }).success).toBe(true)
    expect(PracticeReadStructuredAttemptRequestSchema.safeParse({}).success).toBe(false)
    expect(PracticeReadStructuredAttemptRequestSchema.safeParse({ answers, scope: 'upsr' }).success).toBe(false)
    expect(PracticeReadStructuredAttemptRequestSchema.safeParse({ answers: [{ subQuestionId: 1, text: 'x' }] }).success).toBe(false)
    expect(PracticeReadStructuredAttemptRequestSchema.safeParse({ answers: [{ subQuestionId: '1', text: 'x'.repeat(5001) }] }).success).toBe(false)
    expect(PRACTICE_READS_MESSAGES.answerTooLong(5000)).toBe('Jawapan tidak boleh melebihi 5000 aksara.')
  })
  it('attempt result carries marks and model answers', () => {
    expect(PracticeReadStructuredAttemptResultSchema.safeParse(structuredAttempt).success).toBe(true)
    const without: Record<string, unknown> = { ...structuredAttempt }
    delete without.modelAnswers
    expect(PracticeReadStructuredAttemptResultSchema.safeParse(without).success).toBe(false)
  })
})

describe('SPM targets', () => {
  const row = { id: '18', name: 'Matematik', target: 'A', answered: 0, accuracyPct: null, band: null, predictedGrade: null }
  it('accepts the list with and without progress', () => {
    expect(PracticeReadSpmTargetsSchema.safeParse({ subjects: [row] }).success).toBe(true)
    expect(
      PracticeReadSpmTargetsSchema.safeParse({ subjects: [{ ...row, target: null, answered: 10, accuracyPct: 35.5, band: 'red', predictedGrade: 'G' }] }).success,
    ).toBe(true)
    expect(PracticeReadSpmTargetsSchema.safeParse({ subjects: [{ ...row, target: 'F' }] }).success).toBe(false)
    expect(PracticeReadSpmTargetsSchema.safeParse({ subjects: [{ ...row, band: 'blue' }] }).success).toBe(false)
  })
  it('save request: grades and "" parse; bad grades or a missing targets are rejected', () => {
    expect(PracticeReadSpmTargetsSaveRequestSchema.safeParse({ targets: { '18': 'A+', '2': '' } }).success).toBe(true)
    expect(PracticeReadSpmTargetsSaveRequestSchema.safeParse({ targets: {} }).success).toBe(true)
    expect(PracticeReadSpmTargetsSaveRequestSchema.safeParse({ targets: { '18': 'Z' } }).success).toBe(false)
    expect(PracticeReadSpmTargetsSaveRequestSchema.safeParse({ targets: { '18': null } }).success).toBe(false)
    expect(PracticeReadSpmTargetsSaveRequestSchema.safeParse({}).success).toBe(false)
  })
  it('save response is exactly { data: { saved: 20 }, status }', () => {
    const ok = { data: { saved: 20 }, status: 'Target berjaya disimpan.' }
    expect(PracticeReadSpmTargetsSaveResponseSchema.safeParse(ok).success).toBe(true)
    expect(PracticeReadSpmTargetsSaveResponseSchema.safeParse({ ...ok, status: 'ok' }).success).toBe(false)
    expect(PracticeReadSpmTargetsSaveResponseSchema.safeParse({ data: { saved: 19 }, status: ok.status }).success).toBe(false)
  })
})

describe('OpenAPI document', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { tags?: string[]; responses: Record<string, { headers?: Record<string, unknown> }> }>>
    components: { schemas: Record<string, unknown> }
  }
  const mine = (path: string, method: string) => doc.paths[path]?.[method]

  const ROUTES: [string, string][] = [
    ['get', '/dashboard'],
    ['get', '/practice/subjects'],
    ['get', '/practice/subjects/{code}'],
    ['get', '/practice/chapter-subjects'],
    ['get', '/practice/chapter-subjects/{code}'],
    ['get', '/practice/revision'],
    ['get', '/practice/revision/{code}'],
    ['get', '/practice/progress'],
    ['get', '/practice/history'],
    ['get', '/practice/corrections'],
    ['get', '/practice/mastery'],
    ['get', '/practice/structured'],
    ['get', '/practice/structured/{id}'],
    ['post', '/practice/structured/{id}/attempts'],
    ['get', '/spm-targets'],
    ['put', '/spm-targets'],
  ]

  it.each(ROUTES)('registers %s %s under the practice-reads tag with a 401', (method, path) => {
    const op = mine(path, method)
    expect(op).toBeDefined()
    expect(op?.tags).toEqual(['practice-reads'])
    expect(op?.responses['401']).toBeDefined()
  })

  it('does not register the BE-18 routes', () => {
    expect(doc.paths['/missions/today']).toBeUndefined()
    expect(doc.paths['/remedial-tests/mine']).toBeUndefined()
  })

  it('registers every PracticeRead component, none colliding with BE-12 names', () => {
    for (const name of Object.keys(PRACTICE_READS_COMPONENT_SCHEMAS)) {
      expect(name.startsWith('PracticeRead')).toBe(true)
      expect(doc.components.schemas[name], name).toBeDefined()
    }
  })

  it('writes document 403 CSRF_INVALID, 422 and a 429 with Retry-After; reads have no 429', () => {
    for (const [method, path] of [['post', '/practice/structured/{id}/attempts'], ['put', '/spm-targets']] as const) {
      const r = mine(path, method)?.responses
      expect(r?.['403'], path).toBeDefined()
      expect(r?.['422'], path).toBeDefined()
      expect(r?.['429']?.headers?.['Retry-After'], path).toBeDefined()
    }
    expect(mine('/practice/history', 'get')?.responses['429']).toBeUndefined()
    expect(mine('/dashboard', 'get')?.responses['403']).toBeUndefined()
  })

  it('keeps the BE-12 history route and the S9 history route apart', () => {
    expect(mine('/practice/sessions', 'get')?.tags).toEqual(['practice'])
    expect(mine('/practice/history', 'get')?.tags).toEqual(['practice-reads'])
  })
})
