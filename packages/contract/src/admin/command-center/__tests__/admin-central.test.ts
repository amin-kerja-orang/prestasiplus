import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../openapi'
import {
  AdminAnalyticsSchema,
  AdminClassListQuerySchema,
  AdminClassListResponseSchema,
  AdminDashboardResponseSchema,
  AdminLaporanSchema,
} from '../schema'

// S6-T11: Admin Pusat central screens. Fictitious values only.
const status = { draft: 3, review: 2, approved: 40, archived: 1 }

const klass = {
  id: '501',
  name: 'Kelas 4 Contoh',
  level: 'Tingkatan 4',
  teacher: { id: '71', name: 'Guru Contoh' },
  school: { id: '9', name: 'SMK Contoh' },
  pupils: 28,
  joinCode: 'ABC123',
  isActive: true,
}

const analytics = {
  range: '30d',
  platform: { schools: 12, activeSubscriptions: 9, students: 900, activeStudents: 410, answered: 12345, accuracy: 4.6 },
  trend: [{ date: '2026-10-19', answered: 120 }],
  topSchools: [{ schoolId: '9', school: 'SMK Contoh', answered: 4000 }],
  bank: {
    total: 46,
    bySubject: [{ id: '3', name: 'Matematik', total: 30 }],
    byLevel: [{ id: '10', name: 'Tingkatan 4', total: 46 }],
    byStatus: status,
    dskpTaggedShare: 12.5,
    chapterCoverage: 0,
    servability: { latih_tubi_spm: 20, bab: 10 },
  },
}

const laporan = {
  range: 30,
  tiles: { schools: 12, teachers: 30, pupils: 900, pupilsAccessed: 500, teachersAccessed: 25, pupilsPractised: 410, activities: 700, averageScore: 71.4 },
  trend: [{ date: '19/10', count: 12 }],
  breakdown: [{ type: 'kuiz', label: 'Kuiz', count: 3 }],
  mostActive: [{ id: '55', name: 'Murid Contoh', school: { id: '9', name: 'SMK Contoh' }, activities: 9 }],
  schoolActivity: [{ schoolId: '9', name: 'SMK Contoh', activities: 40, activePupils: 18 }],
}

describe('AdminClass list (API-ADM-05)', () => {
  it('query defaults page 1 / 20 and coerces numbers', () => {
    expect(AdminClassListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 })
    expect(AdminClassListQuerySchema.parse({ page: '2', pageSize: '50', schoolId: '9', level: 'tingkatan-4', teacherId: '71', search: ' Amanah ' })).toEqual({
      page: 2,
      pageSize: 50,
      schoolId: '9',
      level: 'tingkatan-4',
      teacherId: '71',
      search: 'Amanah',
    })
  })

  it('query refuses a bad level, paging or a search over 100 characters', () => {
    for (const bad of [{ level: 'tingkatan-9' }, { page: '0' }, { pageSize: '101' }, { search: 'x'.repeat(101) }]) {
      expect(AdminClassListQuerySchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
    }
  })

  it('response: rows with a nullable teacher and school, plus meta', () => {
    const meta = { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, from: 1, to: 1 }
    expect(AdminClassListResponseSchema.safeParse({ data: [klass], meta }).success).toBe(true)
    expect(AdminClassListResponseSchema.safeParse({ data: [{ ...klass, teacher: null, school: null, joinCode: null }], meta }).success).toBe(true)
    expect(AdminClassListResponseSchema.safeParse({ data: [{ ...klass, pupils: -1 }], meta }).success).toBe(false)
    expect(AdminClassListResponseSchema.safeParse({ data: [{ ...klass, id: 501 }], meta }).success).toBe(false)
  })
})

describe('AdminDashboard (API-ADM-11)', () => {
  const data = {
    questions: { total: 46, byStatus: status, thisWeek: 4 },
    subjects: { total: 14, active: 12 },
    levels: 5,
    users: { total: 1000, students: 900, teachers: 30 },
    battles: { total: 20, active: 2, finished: 15 },
  }

  it('accepts the PRD shape and rejects a missing status or a negative count', () => {
    expect(AdminDashboardResponseSchema.safeParse({ data }).success).toBe(true)
    expect(AdminDashboardResponseSchema.safeParse({ data: { ...data, questions: { ...data.questions, byStatus: { draft: 1, review: 1, approved: 1 } } } }).success).toBe(false)
    expect(AdminDashboardResponseSchema.safeParse({ data: { ...data, battles: { ...data.battles, active: -1 } } }).success).toBe(false)
  })
})

describe('AdminAnalytics (API-ADM-12)', () => {
  it('accepts the shape; accuracy is null when nothing was answered and never above 100', () => {
    expect(AdminAnalyticsSchema.safeParse(analytics).success).toBe(true)
    expect(AdminAnalyticsSchema.safeParse({ ...analytics, platform: { ...analytics.platform, answered: 0, accuracy: null } }).success).toBe(true)
    expect(AdminAnalyticsSchema.safeParse({ ...analytics, platform: { ...analytics.platform, accuracy: 100.1 } }).success).toBe(false)
  })

  it('range is 7d, 30d or 90d and trend dates are YYYY-MM-DD', () => {
    expect(AdminAnalyticsSchema.safeParse({ ...analytics, range: '14d' }).success).toBe(false)
    expect(AdminAnalyticsSchema.safeParse({ ...analytics, trend: [{ date: '19/10', answered: 1 }] }).success).toBe(false)
  })
})

describe('AdminLaporan (API-ADM-13)', () => {
  it('accepts the shape and a null average score', () => {
    expect(AdminLaporanSchema.safeParse(laporan).success).toBe(true)
    expect(AdminLaporanSchema.safeParse({ ...laporan, tiles: { ...laporan.tiles, averageScore: null } }).success).toBe(true)
  })

  it('rejects an unknown range, activity type or a school-less top pupil shape error', () => {
    expect(AdminLaporanSchema.safeParse({ ...laporan, range: 14 }).success).toBe(false)
    expect(AdminLaporanSchema.safeParse({ ...laporan, breakdown: [{ type: 'bijak', label: 'x', count: 1 }] }).success).toBe(false)
    expect(AdminLaporanSchema.safeParse({ ...laporan, mostActive: [{ ...laporan.mostActive[0], school: null }] }).success).toBe(true)
    expect(AdminLaporanSchema.safeParse({ ...laporan, mostActive: [{ ...laporan.mostActive[0], activities: -1 }] }).success).toBe(false)
  })
})

describe('registration in buildOpenApiDocument()', () => {
  const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, { responses?: Record<string, unknown> }>>; components: { schemas: Record<string, unknown> } }

  it.each(['/admin/classes', '/admin/dashboard', '/admin/analytics', '/admin/reports/laporan'])('has GET %s with 200/401/403', (path) => {
    const op = doc.paths[path]?.get
    expect(op).toBeDefined()
    for (const code of ['200', '401', '403']) expect(op?.responses?.[code]).toBeDefined()
  })

  it('has the components', () => {
    for (const name of ['AdminClass', 'AdminClassListResponse', 'AdminDashboard', 'AdminAnalytics', 'AdminLaporan']) expect(doc.components.schemas[name]).toBeDefined()
  })
})
