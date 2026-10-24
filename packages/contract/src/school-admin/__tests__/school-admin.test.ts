import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import {
  AMARAN_CSV_COLUMNS,
  AMARAN_MESSAGES,
  AMARAN_MONTH_ABBREVIATIONS,
  AMARAN_STATUS_LABELS,
  AMARAN_TYPE_LABELS,
  AmaranEffectivenessResultSchema,
  AmaranSchoolRiskSchema,
  AmaranSummaryQuerySchema,
  AmaranSummarySchema,
  amaranCsvFilename,
} from '../amaran'
import { SCHOOL_ADMIN_FLASH, SCHOOL_ADMIN_MESSAGES, SchoolAdminInitialCredentialSchema } from '../common'
import { SCHOOL_ADMIN_COMPONENT_SCHEMAS } from '../paths'
import { SchoolAdminPupilCreateRequestSchema, SchoolAdminPupilCreatedResultSchema, SchoolAdminPupilFormOptionsSchema, SchoolAdminPupilListResponseSchema } from '../pupils'
import {
  SchoolAdminActivityReportSchema,
  SchoolAdminClassListResponseSchema,
  SchoolAdminDashboardSchema,
  SchoolAdminDskpHeatmapSchema,
  SchoolAdminMonthlyReportSchema,
  SchoolAdminUsageSchema,
} from '../reports'
import {
  SchoolAdminTeacherCreateRequestSchema,
  SchoolAdminTeacherCreatedResultSchema,
  SchoolAdminTeacherListResponseSchema,
  SchoolAdminToggleActiveResultSchema,
} from '../teachers'
import {
  SCHOOL_ADMIN_USER_CSV_COLUMNS,
  SchoolAdminResetPasswordRequestSchema,
  SchoolAdminResetResultSchema,
  SchoolAdminUserDetailSchema,
  SchoolAdminUserListMetaSchema,
  SchoolAdminUserUpdateRequestSchema,
  SchoolAdminUserWriteResultSchema,
} from '../users'

const AT = '2026-10-16T09:30:00+08:00'
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => schema.safeParse(value).success

const school = { id: '8880', name: 'SMK DEMO', code: 'DEMO0001', district: 'PPD DEMO', state: 'Negeri Demo' }
const ref = { id: '8880', name: 'SMK DEMO' }
const meta = { page: 1, pageSize: 25, totalItems: 1, totalPages: 1, from: 1, to: 1, counts: { total: 3, active: 2, inactive: 1 } }

const detail = {
  id: '31',
  name: 'Aisyah Demo',
  email: 'aisyah.demo@example.test',
  phone: null,
  isActive: true,
  createdAt: AT,
  updatedAt: AT,
  role: 'student',
  school,
}

const dashboard = {
  school: { id: '8880', name: 'SMK DEMO', state: 'Negeri Demo', ppd: 'PPD DEMO', code: 'DEMO0001' },
  roleLabel: 'Admin Sekolah',
  perutusan: [{ id: '5', title: 'Perutusan Demo', createdAt: AT, author: { initials: 'AD', roleLabel: 'Admin Pusat' } }],
  cards: { pupils: 59, teachers: 6, activeClasses: 4, subscription: { status: 'active', label: 'Aktif' } },
  performance: {
    gps: { value: 5.2, grade: 'C+', band: 'Sederhana', entries: 3 },
    risk: { safe: 40, watch: 10, high: 9, total: 59 },
    practice: { accuracy: null, sessions: 0, questions: 0 },
    levels: [{ code: 't4', name: 'Tingkatan 4', accuracy: 61.5 }],
    distribution: [{ grade: 'A+', count: 2, pct: 3.4 }],
    total: 2,
  },
}

const usage = {
  school: ref,
  period: '7days',
  label: '7 Hari',
  tiles: { pupils: 59, teachers: 6, activePupils: 10, participationPct: 17, sessions: 22, answers: 310, accuracy: 64.2 },
  modes: [{ label: 'Latihan', sessions: 20, accuracy: 63.1 }, { label: 'Bab', sessions: 2, accuracy: null }],
}

const pupilRow = { userId: '31', name: 'Aisyah Demo', className: '4 Amanah', sessions: 3, accuracy: 71.4, seconds: 900, coins: 12, lastLoginAt: AT }
const teacherRow = { userId: '12', name: 'Cikgu Demo', email: 'cikgu.demo@example.test', loggedIn: true, mcq: 4, structured: 1, coins: 9, hasHeadcount: false, lastLoginAt: null }
const activity = {
  range: 30,
  schoolId: '8880',
  generatedAt: AT,
  overview: { pupils: 59, pupilsLogged: 20, teachers: 6, teachersLogged: 4, practised: 12, activity: 140 },
  trend: [{ label: '1 Okt', value: 4 }],
  breakdown: { quiz: 100, structured: 20, battle: 0, game: 0 },
  topPupils: [{ userId: '31', name: 'Aisyah Demo', activities: 14 }],
  teachersNeverLogged: [{ userId: '13', name: 'Cikgu Dua Demo', email: 'dua.demo@example.test' }],
  teachers: [teacherRow],
  pupils: { semua: [pupilRow], aktif: [pupilRow], loginSahaja: [], belumLogin: [] },
  tiles: { teachers: { total: 6, logged: 4, questions: 30, coins: 50 }, pupils: { total: 59, practised: 12, sessions: 33, accuracy: 66.1 } },
}

const heatmap = {
  school: ref,
  subjects: [{ id: '3', name: 'Matematik' }],
  subject: { id: '3', name: 'Matematik' },
  level: { code: 't4', name: 'Tingkatan 4' },
  caption: 'KSSM Matematik Tingkatan 4',
  bidang: [
    {
      id: '9',
      code: null,
      name: 'Fungsi dan Persamaan Kuadratik',
      sp: [
        { id: '90', code: '1.1.1', title: 'Menerangkan fungsi', answered: 10, correct: 8, pct: 80, status: 'mahir' },
        { id: '91', code: '1.1.2', title: 'Mengenal pasti', answered: 0, correct: 0, pct: null, status: 'belum' },
      ],
    },
  ],
}

const monthRow = { month: '2026-09', label: 'September 2026', answers: 200, correct: 130, activePupils: 12, perPupil: 16.7, accuracy: 65 }
const monthly = {
  school: ref,
  month: '2026-10',
  label: 'Oktober 2026',
  prev: '2026-09',
  next: null,
  cards: { participationPct: 20, active: 12, registered: 59, answers: 200, perPupil: 17, accuracy: 65, sessions: 30 },
  months: [monthRow, { ...monthRow, month: '2026-10', label: 'Oktober 2026' }],
  total: { answers: 400, correct: 260, accuracy: 65 },
  subjects: {
    strongest: { name: 'Matematik', accuracy: 70.1, answers: 80, pupils: 10 },
    weakest: { name: 'Sains', accuracy: 50, answers: 60, pupils: 9 },
    rows: [
      { name: 'Matematik', accuracy: 70.1, answers: 80, pupils: 10 },
      { name: 'Sains', accuracy: 50, answers: 60, pupils: 9 },
    ],
  },
  generatedAt: AT,
}
const monthlyEmpty = {
  ...monthly,
  cards: { ...monthly.cards, answers: 0, active: 0, perPupil: 0, accuracy: null, sessions: 0, participationPct: 0 },
  months: [],
  total: null,
  subjects: { strongest: null, weakest: null, rows: [] },
}

const classRow = {
  key: 'classroom:7',
  kind: 'classroom',
  id: '7',
  name: '4 Amanah',
  subject: { id: '3', name: 'Matematik' },
  levelLabel: 'Tingkatan 4',
  teacherName: 'Cikgu Demo',
  members: 30,
  joinCode: 'ABC123',
  isActive: true,
  link: '/prestasi/kelas/7',
}
const classList = {
  data: [classRow],
  meta: { ...meta, displayed: 1 },
  tiles: { activeClasses: 4 },
  levels: [{ code: 'tingkatan-4', label: 'Tingkatan 4' }],
}

const pupilListRow = {
  id: '31',
  name: 'Aisyah Demo',
  initials: 'AD',
  email: 'aisyah.demo@example.test',
  phone: null,
  gradeLabel: 'Tingkatan 4',
  classNames: ['4 Amanah'],
  isActive: true,
  createdAt: AT,
  canEdit: true,
}
const teacherListRow = {
  id: '12',
  name: 'Cikgu Demo',
  initials: 'CD',
  email: 'cikgu.demo@example.test',
  phone: '0123456789',
  classCount: 2,
  lastLoginAt: AT,
  isActive: false,
  createdAt: AT,
  canEdit: false,
}

const tally = { green: 40, yellow: 10, red: 9, total: 59, pct: { green: 68, yellow: 17, red: 15 } }
const weak = { subjectId: '3', subjectName: 'Matematik', weak: 12, total: 59, pct: 20 }
const risk = {
  rank: 1,
  userId: '31',
  studentId: '31',
  name: 'Aisyah Demo',
  levelLabel: 'Tingkatan 4',
  tingkatan: 4,
  className: '4 Amanah',
  classLabel: 'Tingkatan 4 4 Amanah',
  score: 80,
  status: 'high',
  accuracy: null,
  engagement: null,
  mastery: null,
  accuracyText: 'Tiada data latihan',
  engagementText: 'Tiada aktiviti',
  masteryText: 'Tiada data penguasaan',
}
const schoolRisk = {
  school,
  levelFilter: 'T4',
  levelSuffix: ' — Tingkatan 4',
  tally,
  weakness: [weak],
  pupils: [risk, { ...risk, rank: 2, userId: '32', studentId: '32', score: 41.5, status: 'watch', accuracy: 55.5, engagement: '2026-10-10', mastery: 4.2, accuracyText: 'Purata ketepatan: 55.5%', engagementText: 'Terakhir aktif: 2026-10-10', masteryText: 'Purata tahap: L4', className: null, classLabel: '-' }],
}
const kombo = { active: 5, pupils: 59, avg: 2.4, max: 9, today: 7 }
const summarySchool = { scope: 'school', title: 'SMK DEMO', subtitle: 'PPD DEMO, Negeri Demo', pupilsLine: '59 pelajar', generatedAt: 1_760_000_000_000, tally, kombo, weakness: [weak] }
const summaryDistrict = {
  scope: 'district',
  title: 'PPD DEMO',
  subtitle: 'Negeri Demo — Ringkasan Eksekutif',
  pupilsLine: '59 pelajar',
  generatedAt: 1_760_000_000_000,
  tally,
  kombo,
  schools: [{ schoolId: '8880', school: 'SMK DEMO', pupils: 59, avgScore: 33.3, green: 40, yellow: 10, red: 9 }],
}
const summaryState = { ...summaryDistrict, scope: 'state', title: 'Negeri Demo', subtitle: 'Ringkasan Eksekutif Seluruh Negeri', pupilsLine: null }
const effectiveness = {
  school: ref,
  report: {
    cards: { total: 3, berkesan: 1, evaluated: 2, rate: 50, needsAction: 1, sederhana: 1, tidakBerkesan: 0, notEvaluated: 1 },
    doughnut: [1, 1, 0, 1],
    trend: { labels: ['Mei 2026', 'Jun 2026', 'Jul 2026', 'Ogo 2026', 'Sep 2026', 'Okt 2026'], data: [0, 0, 0, 1, 1, 1] },
    byType: [{ type: 'kaunseling', label: 'Sesi Kaunseling', count: 2 }],
    byTeacher: [{ teacherId: '12', name: 'Cikgu Demo', total: 3, berkesan: 1, notEvaluated: 1, rate: 50 }, { teacherId: '13', name: 'Cikgu Dua Demo', total: 1, berkesan: 0, notEvaluated: 1, rate: null }],
    followUps: [{ id: '2', studentId: '31', studentName: 'Aisyah Demo', type: 'bimbingan', label: 'Bimbingan', interventionDate: '2026-10-01', effectiveness: 'belum_dinilai' }],
    bySchool: [{ schoolId: '8880', school: 'SMK DEMO', total: 3, berkesan: 1, sederhana: 1, tidakBerkesan: 0, notEvaluated: 1, rate: 50 }],
  },
}
const effectivenessEmpty = {
  school: ref,
  report: {
    cards: { total: 0, berkesan: 0, evaluated: 0, rate: 0, needsAction: 0, sederhana: 0, tidakBerkesan: 0, notEvaluated: 0 },
    doughnut: [0, 0, 0, 0],
    trend: { labels: effectiveness.report.trend.labels, data: [0, 0, 0, 0, 0, 0] },
    byType: [],
    byTeacher: [],
    followUps: [],
    bySchool: [],
  },
}

describe('school-admin contract: reports', () => {
  it('parses the dashboard, including a school without risk data or practice', () => {
    expect(ok(SchoolAdminDashboardSchema, dashboard)).toBe(true)
    expect(ok(SchoolAdminDashboardSchema, { ...dashboard, performance: { ...dashboard.performance, risk: null, gps: { value: null, grade: null, band: null, entries: 0 } } })).toBe(true)
    expect(ok(SchoolAdminDashboardSchema, { ...dashboard, cards: { ...dashboard.cards, subscription: { status: 'paused', label: 'x' } } })).toBe(false)
    expect(ok(SchoolAdminDashboardSchema, { ...dashboard, perutusan: Array(4).fill(dashboard.perutusan[0]) })).toBe(false)
    expect(ok(SchoolAdminDashboardSchema, { ...dashboard, school: { ...dashboard.school, id: 8880 } })).toBe(false)
  })

  it('parses the usage report and rejects an unknown period / label', () => {
    expect(ok(SchoolAdminUsageSchema, usage)).toBe(true)
    expect(ok(SchoolAdminUsageSchema, { ...usage, period: 'week' })).toBe(false)
    expect(ok(SchoolAdminUsageSchema, { ...usage, label: '14 Hari' })).toBe(false)
  })

  it('parses the activity report (no platform-only fields) and rejects an off-list range', () => {
    expect(ok(SchoolAdminActivityReportSchema, activity)).toBe(true)
    expect(ok(SchoolAdminActivityReportSchema, { ...activity, range: 14 })).toBe(false)
    expect(ok(SchoolAdminActivityReportSchema, { ...activity, generatedAt: '2026-10-16T01:30:00Z' })).toBe(false)
    expect(Object.keys(SchoolAdminActivityReportSchema.shape.overview.shape)).not.toContain('score')
    expect(JSON.stringify(Object.keys(SchoolAdminActivityReportSchema.shape))).not.toContain('schools')
  })

  it('parses the heatmap, including the no-subject shape', () => {
    expect(ok(SchoolAdminDskpHeatmapSchema, heatmap)).toBe(true)
    expect(ok(SchoolAdminDskpHeatmapSchema, { ...heatmap, subjects: [], subject: null, caption: null, bidang: [] })).toBe(true)
    expect(ok(SchoolAdminDskpHeatmapSchema, { ...heatmap, level: { code: 't6', name: 'Tingkatan 6' } })).toBe(false)
    const bad = structuredClone(heatmap)
    bad.bidang[0]!.sp[0]!.status = 'cemerlang'
    expect(ok(SchoolAdminDskpHeatmapSchema, bad)).toBe(false)
  })

  it('parses the monthly report and the empty-month shape; rejects a bad month key', () => {
    expect(ok(SchoolAdminMonthlyReportSchema, monthly)).toBe(true)
    expect(ok(SchoolAdminMonthlyReportSchema, monthlyEmpty)).toBe(true)
    expect(ok(SchoolAdminMonthlyReportSchema, { ...monthly, month: '2026-13' })).toBe(false)
    expect(ok(SchoolAdminMonthlyReportSchema, { ...monthly, prev: null })).toBe(false)
  })

  it('parses the class list with its top-level extras', () => {
    expect(ok(SchoolAdminClassListResponseSchema, classList)).toBe(true)
    expect(ok(SchoolAdminClassListResponseSchema, { ...classList, tiles: undefined })).toBe(false)
    expect(ok(SchoolAdminClassListResponseSchema, { ...classList, meta: meta })).toBe(false) // displayed missing
    expect(ok(SchoolAdminClassListResponseSchema, { ...classList, data: [{ ...classRow, kind: 'school_class' }] })).toBe(false)
  })
})

describe('school-admin contract: teachers and pupils', () => {
  it('parses user list responses and requires meta.counts', () => {
    expect(ok(SchoolAdminPupilListResponseSchema, { data: [pupilListRow], meta })).toBe(true)
    expect(ok(SchoolAdminTeacherListResponseSchema, { data: [teacherListRow], meta })).toBe(true)
    expect(ok(SchoolAdminPupilListResponseSchema, { data: [], meta: { ...meta, totalItems: 0, from: null, to: null, counts: { total: 0, active: 0, inactive: 0 } } })).toBe(true)
    const noCounts: Record<string, unknown> = { ...meta }
    delete noCounts.counts
    expect(ok(SchoolAdminUserListMetaSchema, noCounts)).toBe(false)
    expect(ok(SchoolAdminPupilListResponseSchema, { data: [{ ...pupilListRow, initials: 'ABC' }], meta })).toBe(false)
  })

  it('parses the user detail and carries no IC number', () => {
    expect(ok(SchoolAdminUserDetailSchema, detail)).toBe(true)
    expect(ok(SchoolAdminUserDetailSchema, { ...detail, role: 'school_admin' })).toBe(false)
    expect(Object.keys(SchoolAdminUserDetailSchema.shape)).not.toContain('icNumber')
  })

  it('create teacher: no password field (D59b); unmanaged keys, a password included, are stripped', () => {
    const valid = { name: 'Cikgu Baharu', email: 'baharu@example.test' }
    expect(ok(SchoolAdminTeacherCreateRequestSchema, valid)).toBe(true)
    expect(ok(SchoolAdminTeacherCreateRequestSchema, { ...valid, phone: '0123456789' })).toBe(true)
    expect(ok(SchoolAdminTeacherCreateRequestSchema, { ...valid, phone: '012345678901234' })).toBe(false)
    expect(ok(SchoolAdminTeacherCreateRequestSchema, { ...valid, name: '   ' })).toBe(false)
    expect(ok(SchoolAdminTeacherCreateRequestSchema, { ...valid, email: 'bukan-emel' })).toBe(false)
    expect(Object.keys(SchoolAdminTeacherCreateRequestSchema.shape)).toEqual(['name', 'email', 'phone'])
    const parsed = SchoolAdminTeacherCreateRequestSchema.parse({
      ...valid,
      password: 'rahsia12',
      passwordConfirmation: 'rahsia12',
      role: 'admin',
      schoolId: '1',
      isActive: false,
    })
    expect(parsed).toEqual(valid)
  })

  it('create teacher result carries the one-time credential and a false must-change flag (D59b, R39)', () => {
    const result = {
      data: { ...detail, role: 'teacher' },
      credential: { name: 'Cikgu Baharu', school: 'SMK DEMO', email: 'baharu@example.test', password: 'aaaa-bbbb-cccc-1' },
      mustChangePassword: false, // R39: no forced change at go-live
      status: SCHOOL_ADMIN_FLASH.created,
    }
    expect(ok(SchoolAdminTeacherCreatedResultSchema, result)).toBe(true)
    expect(ok(SchoolAdminTeacherCreatedResultSchema, { ...result, credential: undefined })).toBe(false)
    expect(ok(SchoolAdminTeacherCreatedResultSchema, { ...result, mustChangePassword: true })).toBe(true) // R39: widened to boolean, so a legacy true still parses
    expect(ok(SchoolAdminTeacherCreatedResultSchema, { ...result, mustChangePassword: undefined })).toBe(false)
  })

  it('initial credential: server-generated password of at least 12 characters', () => {
    const cred = { name: 'Aisyah Demo', school: 'SMK DEMO', email: 'aisyah.demo@example.test', password: 'aaaa-bbbb-cccc-1' }
    expect(ok(SchoolAdminInitialCredentialSchema, cred)).toBe(true)
    expect(ok(SchoolAdminInitialCredentialSchema, { ...cred, password: 'short-11-chr' })).toBe(true)
    expect(ok(SchoolAdminInitialCredentialSchema, { ...cred, password: 'DemoPass-01' })).toBe(false)
  })

  it('create pupil: no password field and no default password (D59b), class id, name minimum 3', () => {
    const valid = { name: 'Murid Baharu', email: 'murid@example.test' }
    expect(ok(SchoolAdminPupilCreateRequestSchema, valid)).toBe(true)
    expect(ok(SchoolAdminPupilCreateRequestSchema, { ...valid, classId: '' })).toBe(true)
    expect(ok(SchoolAdminPupilCreateRequestSchema, { ...valid, classId: '7' })).toBe(true)
    expect(ok(SchoolAdminPupilCreateRequestSchema, { ...valid, name: 'Al' })).toBe(false)
    expect(ok(SchoolAdminPupilCreateRequestSchema, { ...valid, classId: 7 })).toBe(false)
    expect(Object.keys(SchoolAdminPupilCreateRequestSchema.shape)).toEqual(['name', 'email', 'classId'])
    const parsed = SchoolAdminPupilCreateRequestSchema.parse({ ...valid, password: 'abcdefgh', role: 'teacher', grade: 9, icNumber: '000000000000' })
    expect(parsed).toEqual(valid)
  })

  it('create pupil result carries the one-time credential', () => {
    const result = {
      data: detail,
      credential: { name: 'Aisyah Demo', school: 'SMK DEMO', email: 'aisyah.demo@example.test', password: 'aaaa-bbbb-cccc-1' },
      mustChangePassword: false, // R39
      status: SCHOOL_ADMIN_FLASH.pupilCreated('Aisyah Demo'),
    }
    expect(ok(SchoolAdminPupilCreatedResultSchema, result)).toBe(true)
    expect(result.status).toBe('Pelajar "Aisyah Demo" berjaya dicipta.')
    expect(ok(SchoolAdminPupilCreatedResultSchema, { ...result, credential: undefined })).toBe(false)
  })

  it('create pupil result requires the must-change-password flag, which is false now (D55c, R39)', () => {
    const result = {
      data: detail,
      credential: { name: 'Aisyah Demo', school: 'SMK DEMO', email: 'aisyah.demo@example.test', password: 'aaaa-bbbb-cccc-1' },
      mustChangePassword: false, // R39
      status: SCHOOL_ADMIN_FLASH.pupilCreated('Aisyah Demo'),
    }
    expect(ok(SchoolAdminPupilCreatedResultSchema, result)).toBe(true)
    expect(ok(SchoolAdminPupilCreatedResultSchema, { ...result, mustChangePassword: undefined })).toBe(false)
    expect(ok(SchoolAdminPupilCreatedResultSchema, { ...result, mustChangePassword: true })).toBe(true) // R39: widened to boolean, so a legacy true still parses
    expect(ok(SchoolAdminPupilCreatedResultSchema, { ...result, mustChangePassword: 'true' })).toBe(false)
  })

  it('form options: school and classes only, no password hints (D59b)', () => {
    const opts = { school, classes: [{ id: '7', name: '4 Amanah' }] }
    expect(ok(SchoolAdminPupilFormOptionsSchema, opts)).toBe(true)
    expect(Object.keys(SchoolAdminPupilFormOptionsSchema.shape)).toEqual(['school', 'classes'])
    expect(SchoolAdminPupilFormOptionsSchema.parse({ ...opts, passwordMinLength: 8 })).toEqual(opts)
  })

  it('update: phone null clears, password pair optional, unmanaged keys stripped', () => {
    const base = { name: 'Aisyah Demo', email: 'aisyah.demo@example.test' }
    expect(ok(SchoolAdminUserUpdateRequestSchema, base)).toBe(true)
    expect(ok(SchoolAdminUserUpdateRequestSchema, { ...base, phone: null })).toBe(true)
    expect(ok(SchoolAdminUserUpdateRequestSchema, { ...base, newPassword: 'abcdefgh', newPasswordConfirmation: 'abcdefgh' })).toBe(true)
    expect(ok(SchoolAdminUserUpdateRequestSchema, { ...base, newPassword: 'abcdefg' })).toBe(false)
    expect(ok(SchoolAdminUserUpdateRequestSchema, { ...base, newPassword: 'x'.repeat(256), newPasswordConfirmation: 'x'.repeat(256) })).toBe(false)
    expect(ok(SchoolAdminUserUpdateRequestSchema, { name: 'Tanpa Emel' })).toBe(false)
    expect(SchoolAdminUserUpdateRequestSchema.parse({ ...base, role: 'admin', schoolId: '9' })).toEqual(base)
  })

  it('reset password request and results', () => {
    expect(ok(SchoolAdminResetPasswordRequestSchema, { newPassword: 'abcdefgh', newPasswordConfirmation: 'abcdefgh' })).toBe(true)
    expect(ok(SchoolAdminResetPasswordRequestSchema, { newPassword: 'abcdefg', newPasswordConfirmation: 'abcdefg' })).toBe(false)
    expect(ok(SchoolAdminResetPasswordRequestSchema, { newPassword: 'x'.repeat(256), newPasswordConfirmation: 'x'.repeat(256) })).toBe(false)
    expect(ok(SchoolAdminResetPasswordRequestSchema, { newPassword: 'abcdefgh' })).toBe(false)
    expect(ok(SchoolAdminResetResultSchema, { data: { reset: true }, status: SCHOOL_ADMIN_FLASH.updated })).toBe(true)
    expect(ok(SchoolAdminResetResultSchema, { data: { reset: false }, status: SCHOOL_ADMIN_FLASH.updated })).toBe(false)
    // the response never echoes a password
    expect(Object.keys(SchoolAdminResetResultSchema.shape.data.shape)).toEqual(['reset'])
  })

  it('write results and toggle result', () => {
    expect(ok(SchoolAdminUserWriteResultSchema, { data: detail, status: SCHOOL_ADMIN_FLASH.created })).toBe(true)
    expect(ok(SchoolAdminUserWriteResultSchema, { data: detail })).toBe(false)
    expect(ok(SchoolAdminToggleActiveResultSchema, { data: { isActive: false }, status: SCHOOL_ADMIN_FLASH.statusToggled })).toBe(true)
    expect(ok(SchoolAdminToggleActiveResultSchema, { data: {}, status: SCHOOL_ADMIN_FLASH.statusToggled })).toBe(false)
  })

  it('keeps the exact BM copy of the mock', () => {
    expect(SCHOOL_ADMIN_FLASH.updated).toBe('Pengguna berjaya dikemaskini.')
    expect(SCHOOL_ADMIN_FLASH.created).toBe('Pengguna berjaya didaftarkan.')
    expect(SCHOOL_ADMIN_FLASH.statusToggled).toBe('Status pengguna berjaya dikemaskini.')
    expect(SCHOOL_ADMIN_MESSAGES.roleNotManaged).toBe('Anda tidak boleh mengurus akaun ini.')
    expect(SCHOOL_ADMIN_MESSAGES.accountInactive).toBe('Akaun ini tidak aktif.')
    expect(SCHOOL_ADMIN_MESSAGES.userNotFound).toBe('Pengguna tidak ditemui.')
    expect(SCHOOL_ADMIN_MESSAGES.selfToggle).toBe('Anda tidak boleh menyahaktifkan akaun sendiri.')
    expect(SCHOOL_ADMIN_USER_CSV_COLUMNS.join(',')).toBe('id,name,email,role,sekolah,kelas,is_active,created_at')
  })

  it('error bodies for a 422 and a CSRF refusal parse as ErrorBody', () => {
    expect(ok(ErrorBodySchema, { error: { code: 'VALIDATION_ERROR', message: 'The email has already been taken.', fields: { email: 'The email has already been taken.' } } })).toBe(true)
    expect(ok(ErrorBodySchema, { error: { code: 'CSRF_INVALID', message: 'Sesi tidak sah. Sila muat semula halaman dan cuba lagi.' } })).toBe(true)
  })
})

describe('school-admin contract: Amaran', () => {
  it('parses the school risk page, with and without a level filter', () => {
    expect(ok(AmaranSchoolRiskSchema, schoolRisk)).toBe(true)
    expect(ok(AmaranSchoolRiskSchema, { ...schoolRisk, levelFilter: null, levelSuffix: '', pupils: [] })).toBe(true)
    expect(ok(AmaranSchoolRiskSchema, { ...schoolRisk, levelFilter: 'T6' })).toBe(false)
    expect(ok(AmaranSchoolRiskSchema, { ...schoolRisk, tally: { ...tally, pct: { green: 101, yellow: 0, red: 0 } } })).toBe(false)
    expect(ok(AmaranSchoolRiskSchema, { ...schoolRisk, pupils: [{ ...risk, status: 'critical' }] })).toBe(false)
    expect(ok(AmaranSchoolRiskSchema, { ...schoolRisk, pupils: [{ ...risk, rank: 0 }] })).toBe(false)
  })

  it('pupil rows carry no personal contact data', () => {
    const keys = Object.keys(AmaranSchoolRiskSchema.shape.pupils.element.shape)
    for (const forbidden of ['email', 'phone', 'icNumber', 'ic']) expect(keys).not.toContain(forbidden)
  })

  it('parses the summary of each scope; generatedAt is an epoch number', () => {
    expect(ok(AmaranSummarySchema, summarySchool)).toBe(true)
    expect(ok(AmaranSummarySchema, summaryDistrict)).toBe(true)
    expect(ok(AmaranSummarySchema, summaryState)).toBe(true)
    expect(ok(AmaranSummarySchema, { ...summarySchool, generatedAt: AT })).toBe(false)
    expect(ok(AmaranSummarySchema, { ...summarySchool, scope: 'country' })).toBe(false)
  })

  it('summary query accepts any text (the 422 rules live on the route)', () => {
    expect(ok(AmaranSummaryQuerySchema, {})).toBe(true)
    expect(ok(AmaranSummaryQuerySchema, { scope: 'galaxy' })).toBe(true)
    expect(AMARAN_MESSAGES.schoolIdRequired).toBe('The school id is required.')
    expect(AMARAN_MESSAGES.districtStateRequired).toBe('The district and state are required.')
    expect(AMARAN_MESSAGES.stateRequired).toBe('The state is required.')
    expect(AMARAN_MESSAGES.scopeInvalid).toBe('The scope must be school, district or state.')
  })

  it('parses the effectiveness result, populated and empty', () => {
    expect(ok(AmaranEffectivenessResultSchema, effectiveness)).toBe(true)
    expect(ok(AmaranEffectivenessResultSchema, effectivenessEmpty)).toBe(true)
    const wrong = structuredClone(effectiveness)
    wrong.report.doughnut = [1, 1, 1] as never
    expect(ok(AmaranEffectivenessResultSchema, wrong)).toBe(false)
    const badType = structuredClone(effectiveness)
    badType.report.byType[0]!.type = 'ceramah' as never
    expect(ok(AmaranEffectivenessResultSchema, badType)).toBe(false)
  })

  it('keeps the mock labels, header row and file name', () => {
    expect(AMARAN_STATUS_LABELS).toEqual({ on_track: 'On Track', watch: 'Perlu Perhatian', high: 'Berisiko Tinggi' })
    expect(AMARAN_TYPE_LABELS.kaunseling).toBe('Sesi Kaunseling')
    expect(AMARAN_TYPE_LABELS.mentor_rakan).toBe('Mentor Rakan Sebaya')
    expect(AMARAN_MONTH_ABBREVIATIONS.join(' ')).toBe('Jan Feb Mac Apr Mei Jun Jul Ogo Sep Okt Nov Dis')
    expect(AMARAN_CSV_COLUMNS.join(',')).toBe('Bil,Pelajar,Tingkatan / Kelas,Skor Risiko,Status,Ketepatan,Penglibatan,Penguasaan')
    expect(amaranCsvFilename('8880', '20260925')).toBe('amaran-sekolah-8880-20260925.csv')
  })
})

describe('school-admin contract: OpenAPI document', () => {
  type Operation = {
    tags?: string[]
    description?: string
    parameters?: { name: string; in: string }[]
    requestBody?: { content: Record<string, unknown> }
    responses: Record<string, { content?: Record<string, unknown>; headers?: Record<string, unknown> }>
  }
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, Operation>>
    components: { schemas: Record<string, Record<string, unknown>> }
  }

  type CreatedResultDoc = {
    required: string[]
    properties: {
      mustChangePassword: { description: string }
    }
  }
  type CredentialDoc = { properties: { password: { description: string; minLength: number } } }

  const ROUTES: readonly [string, string][] = [
    ['get', '/admin-sekolah/dashboard'], ['get', '/admin-sekolah/usage'], ['get', '/admin-sekolah/laporan-aktiviti'],
    ['get', '/admin-sekolah/laporan-bulanan'], ['get', '/admin-sekolah/dskp-heatmap'], ['get', '/admin-sekolah/kelas'],
    ['get', '/admin-sekolah/guru'], ['get', '/admin-sekolah/guru/{id}'], ['get', '/admin-sekolah/guru/export.csv'],
    ['post', '/admin-sekolah/guru'], ['put', '/admin-sekolah/guru/{id}'],
    ['post', '/admin-sekolah/guru/{id}/toggle-active'], ['post', '/admin-sekolah/guru/{id}/reset-password'],
    ['get', '/admin-sekolah/pelajar'], ['get', '/admin-sekolah/pelajar/form-options'], ['get', '/admin-sekolah/pelajar/{id}'],
    ['get', '/admin-sekolah/pelajar/export.csv'], ['post', '/admin-sekolah/pelajar'], ['put', '/admin-sekolah/pelajar/{id}'],
    ['post', '/admin-sekolah/pelajar/{id}/reset-password'],
    ['get', '/amaran/schools/{id}'], ['get', '/amaran/summary'], ['get', '/amaran/effectiveness'], ['get', '/amaran/export/school/{id}'],
  ]
  const MUTATING = ROUTES.filter(([m]) => m !== 'get')

  it('contains every route (20 M27 + 4 Amaran), counted by this domain tags', () => {
    for (const [method, path] of ROUTES) expect(doc.paths[path]?.[method], `${method} ${path}`).toBeDefined()
    const own = Object.values(doc.paths).flatMap((item) =>
      Object.values(item).filter((op) => op.tags?.some((t) => t === 'school-admin' || t === 'amaran')),
    )
    expect(own).toHaveLength(24)
    expect(own.filter((op) => op.tags?.includes('school-admin'))).toHaveLength(20)
    expect(own.filter((op) => op.tags?.includes('amaran'))).toHaveLength(4)
  })

  it('does not register the two impersonation routes (UD-2)', () => {
    expect(doc.paths['/admin-sekolah/users/{id}/impersonate']).toBeUndefined()
    expect(doc.paths['/admin-sekolah/impersonate/leave']).toBeUndefined()
    expect(Object.keys(doc.paths).filter((p) => /impersonat|menyamar/i.test(p))).toEqual([])
  })

  it('contains every school-admin / amaran component, ids are prefixed and unique', () => {
    const names = Object.keys(SCHOOL_ADMIN_COMPONENT_SCHEMAS)
    expect(names.length).toBeGreaterThan(40)
    for (const name of names) {
      expect(doc.components.schemas[name], name).toBeDefined()
      expect(/^(SchoolAdmin|Amaran)[A-Z]/.test(name), name).toBe(true)
    }
    expect(new Set(names).size).toBe(names.length)
    for (const bare of ['Teacher', 'Student', 'Class', 'Dashboard', 'Pupil', 'Summary']) {
      expect(doc.components.schemas[bare], bare).toBeUndefined()
    }
  })

  it('every mutating route requires X-CSRF-Token and documents 401/403; reads do not need it', () => {
    for (const [method, path] of MUTATING.filter(([, p]) => p.startsWith('/admin-sekolah'))) {
      const op = doc.paths[path]![method]!
      expect(op.parameters?.some((p) => p.name === 'X-CSRF-Token' && p.in === 'header'), `${method} ${path}`).toBe(true)
      expect(op.responses['401'], path).toBeDefined()
      expect(op.responses['403'], path).toBeDefined()
    }
    for (const [method, path] of ROUTES.filter(([m]) => m === 'get')) {
      const op = doc.paths[path]![method]!
      expect(op.parameters?.some((p) => p.name === 'X-CSRF-Token') ?? false, path).toBe(false)
      expect(op.responses['401'], path).toBeDefined()
      expect(op.responses['403'], path).toBeDefined()
    }
  })

  it('documents 404 / 422 where the mock returns them', () => {
    for (const path of ['/admin-sekolah/pelajar/{id}', '/admin-sekolah/guru/{id}']) expect(doc.paths[path]!.get!.responses['404']).toBeDefined()
    for (const [m, p] of [['put', '/admin-sekolah/pelajar/{id}'], ['put', '/admin-sekolah/guru/{id}'], ['post', '/admin-sekolah/pelajar/{id}/reset-password'], ['post', '/admin-sekolah/guru/{id}/reset-password'], ['post', '/admin-sekolah/pelajar'], ['post', '/admin-sekolah/guru']] as const) {
      expect(doc.paths[p]![m]!.responses['422'], p).toBeDefined()
    }
    expect(doc.paths['/admin-sekolah/guru/{id}/toggle-active']!.post!.responses['404']).toBeDefined()
    expect(doc.paths['/admin-sekolah/pelajar']!.post!.responses['201']).toBeDefined()
    expect(doc.paths['/amaran/summary']!.get!.responses['422']).toBeDefined()
    expect(doc.paths['/amaran/summary']!.get!.responses['404']).toBeDefined()
    expect(doc.paths['/amaran/schools/{id}']!.get!.responses['404']).toBeDefined()
    expect(doc.paths['/amaran/export/school/{id}']!.get!.responses['404']).toBeDefined()
  })

  it('CSV routes answer text/csv with a Content-Disposition header', () => {
    for (const path of ['/admin-sekolah/pelajar/export.csv', '/admin-sekolah/guru/export.csv', '/amaran/export/school/{id}']) {
      const res = doc.paths[path]!.get!.responses['200']!
      expect(Object.keys(res.content ?? {}), path).toEqual(['text/csv'])
      expect(res.headers?.['Content-Disposition'], path).toBeDefined()
    }
    expect(doc.paths['/amaran/export/school/{id}']!.get!.responses['200']!.headers?.['Cache-Control']).toBeDefined()
  })

  it('both user CSV exports and the pupil credential 201 send Cache-Control: no-store (D57b)', () => {
    for (const path of ['/admin-sekolah/pelajar/export.csv', '/admin-sekolah/guru/export.csv']) {
      expect(doc.paths[path]!.get!.responses['200']!.headers?.['Cache-Control'], path).toBeDefined()
    }
    const created = doc.paths['/admin-sekolah/pelajar']!.post!.responses['201']!
    expect(created.headers?.['Cache-Control']).toBeDefined()
  })

  it('credential 201, both user CSVs and both reset-password 200s declare Cache-Control no-store and Pragma no-cache (D57b)', () => {
    const targets: readonly [string, string, string][] = [
      ['post', '/admin-sekolah/pelajar', '201'],
      ['post', '/admin-sekolah/guru', '201'],
      ['get', '/admin-sekolah/pelajar/export.csv', '200'],
      ['get', '/admin-sekolah/guru/export.csv', '200'],
      ['post', '/admin-sekolah/pelajar/{id}/reset-password', '200'],
      ['post', '/admin-sekolah/guru/{id}/reset-password', '200'],
      ['get', '/amaran/export/school/{id}', '200'],
    ]
    for (const [method, path, status] of targets) {
      const headers = doc.paths[path]![method]!.responses[status]!.headers as Record<string, { description: string }> | undefined
      expect(headers?.['Cache-Control']?.description, `${method} ${path}`).toMatch(/^no-store/)
      expect(headers?.Pragma?.description, `${method} ${path}`).toMatch(/^no-cache/)
    }
  })

  it('every non-GET route of this domain declares 429 with a Retry-After header', () => {
    for (const [method, path] of MUTATING.filter(([, p]) => p.startsWith('/admin-sekolah'))) {
      expect(doc.paths[path]![method]!.responses['429']?.headers?.['Retry-After'], `${method} ${path}`).toBeDefined()
    }
  })

  it('writes, reset-password routes and CSV exports document 429 RATE_LIMITED with Retry-After (D57a)', () => {
    const limited: readonly [string, string][] = [
      ...MUTATING.filter(([, p]) => p.startsWith('/admin-sekolah')),
      ['get', '/admin-sekolah/pelajar/export.csv'],
      ['get', '/admin-sekolah/guru/export.csv'],
      ['get', '/amaran/export/school/{id}'],
    ]
    expect(limited).toHaveLength(7 + 3)
    for (const [method, path] of limited) {
      const res = doc.paths[path]![method]!.responses['429']
      expect(res, `${method} ${path}`).toBeDefined()
      expect(res!.headers?.['Retry-After'], `${method} ${path}`).toBeDefined()
      expect(JSON.stringify(res), `${method} ${path}`).toMatch(/ErrorBody/)
    }
  })

  it('documents the lost-response recovery, the optional Idempotency-Key and the enumeration trade-off on create pupil', () => {
    const op = doc.paths['/admin-sekolah/pelajar']!.post! as Operation
    expect(op.description).toMatch(/never re-served/i)
    expect(op.description).toMatch(/reset-password/)
    expect(op.description).toMatch(/Idempotency-Key/)
    expect(op.description).toMatch(/enumeration/i)
    expect(op.description).toMatch(/mass assignment/i)
    expect(op.description).toMatch(/no shared default password/i)
    const key = op.parameters?.find((p) => p.name === 'Idempotency-Key') as { required?: boolean } | undefined
    expect(key).toBeDefined()
    expect(key?.required ?? false).toBe(false)
    expect(op.responses['409']).toBeDefined()
    const reset = doc.paths['/admin-sekolah/pelajar/{id}/reset-password']!.post! as Operation
    expect(reset.description).toMatch(/recovery path/i)
  })

  it('excludes Admin Pusat from /admin-sekolah/*, documents the self-toggle refusal and the 404 scope rule', () => {
    const dash = doc.paths['/admin-sekolah/dashboard']!.get!
    expect(JSON.stringify(dash.responses['403'])).toMatch(/Admin \(Pusat\) role is EXCLUDED/)
    const toggle = doc.paths['/admin-sekolah/guru/{id}/toggle-active']!.post! as Operation
    expect(toggle.description).toMatch(/cannot deactivate their own account/)
    expect(toggle.description).toContain(SCHOOL_ADMIN_MESSAGES.selfToggle)
    const risk = doc.paths['/amaran/schools/{id}']!.get! as Operation
    expect(JSON.stringify(risk.responses['403'])).not.toMatch(/outside the caller scope/)
    expect(JSON.stringify(risk.responses['404'])).toMatch(/outside the caller scope/)
    const csvRoute = doc.paths['/amaran/export/school/{id}']!.get! as Operation
    expect(csvRoute.description).toMatch(/role check \(403\) comes BEFORE the 404/)
    expect(JSON.stringify(csvRoute.responses['404'])).toMatch(/outside the caller scope/)
  })

  it('PDPA notes sit on the exports and the Amaran pupil lists', () => {
    for (const path of ['/admin-sekolah/pelajar/export.csv', '/admin-sekolah/guru/export.csv', '/amaran/export/school/{id}', '/amaran/schools/{id}']) {
      expect(doc.paths[path]!.get!.description, path).toMatch(/PDPA/)
    }
    expect(JSON.stringify(doc.components.schemas.AmaranPupilRisk)).toBeDefined()
  })

  it('create requests carry no password field; update and reset passwords are write-only (D59b)', () => {
    const req = doc.components.schemas
    const props = (name: string) => (req[name]!.properties ?? {}) as Record<string, { writeOnly?: boolean }>
    expect(Object.keys(props('SchoolAdminTeacherCreateRequest'))).toEqual(['name', 'email', 'phone'])
    expect(Object.keys(props('SchoolAdminPupilCreateRequest'))).toEqual(['name', 'email', 'classId'])
    expect(props('SchoolAdminUserUpdateRequest').newPassword!.writeOnly).toBe(true)
    expect(props('SchoolAdminResetPasswordRequest').newPassword!.writeOnly).toBe(true)
  })

  it('every admin-chosen password field (update, reset) is 8 to 255 characters in the OpenAPI schema', () => {
    const req = doc.components.schemas
    const fields: readonly [string, string][] = [
      ['SchoolAdminUserUpdateRequest', 'newPassword'],
      ['SchoolAdminUserUpdateRequest', 'newPasswordConfirmation'],
      ['SchoolAdminResetPasswordRequest', 'newPassword'],
      ['SchoolAdminResetPasswordRequest', 'newPasswordConfirmation'],
    ]
    for (const [name, field] of fields) {
      const prop = (req[name]!.properties as Record<string, { minLength?: number; maxLength?: number }>)[field]!
      expect(prop.maxLength, `${name}.${field}`).toBe(255)
      if (!field.endsWith('Confirmation')) expect(prop.minLength, `${name}.${field}`).toBe(8)
    }
  })

  it('no admin-sekolah route offers a shared default password (D59b)', () => {
    for (const path of ['/admin-sekolah/pelajar', '/admin-sekolah/guru']) {
      const op = doc.paths[path]!.post!
      expect(op.description, path).toMatch(/D59b/)
      expect(op.description, path).toMatch(/CSPRNG/)
      expect(op.description, path).toMatch(/at least 12 characters/)
      expect(op.description, path).not.toMatch(/empty password means/i)
    }
    expect(JSON.stringify(doc.components.schemas.SchoolAdminPupilFormOptions)).not.toMatch(/password/i)
  })

  it('no response schema other than the one-time credential carries a password', () => {
    const responseSchemas = Object.entries(doc.components.schemas).filter(([name]) => !/Request$|Query$/.test(name))
    for (const [name, schema] of responseSchemas) {
      if (!/^(SchoolAdmin|Amaran)/.test(name)) continue
      const text = JSON.stringify(schema)
      if (['SchoolAdminPupilCreatedResult', 'SchoolAdminTeacherCreatedResult', 'SchoolAdminInitialCredential'].includes(name)) continue
      expect(/password/i.test(text), name).toBe(false)
    }
  })

  it('documents the one-time password and the must-change flag in the OpenAPI schema (D55c)', () => {
    const schema = doc.components.schemas.SchoolAdminPupilCreatedResult as unknown as CreatedResultDoc
    expect(schema.required).toContain('mustChangePassword')
    expect(schema.properties.mustChangePassword.description).toMatch(/first login/i)
    expect(schema.properties.mustChangePassword.description).toMatch(/R39/) // R39: the description now states no forced change (BE-03 reference dropped)
    const cred = doc.components.schemas.SchoolAdminInitialCredential as unknown as CredentialDoc
    expect(cred.properties.password.minLength).toBe(12)
    const pw = cred.properties.password.description
    expect(pw).toMatch(/CSPRNG/)
    expect(pw).toMatch(/once/i)
    expect(pw).toMatch(/only to the creating school admin/i)
    expect(pw).toMatch(/never logged/i)
    expect(pw).toMatch(/never stored in plain text/i)
    expect(pw).toMatch(/not retrievable again/i)
  })

  it('no school id can be sent: no M27 request schema or query has schoolId', () => {
    for (const [name, schema] of Object.entries(doc.components.schemas)) {
      if (!/^SchoolAdmin.*(Request|Query)$/.test(name)) continue
      expect(Object.keys((schema.properties ?? {}) as object), name).not.toContain('schoolId')
    }
  })
})
