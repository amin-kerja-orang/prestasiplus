// BE-22 Command Center wire contract: M17 admin and school views, plus the M10 teacher view.
import { z } from '../../zod'
import { CLASS_EDUCATION_LEVELS } from '../../classes/schema'
import { IdSchema } from '../../common/ids'
import { PageQuerySchema, listEnvelopeOf } from '../../common/envelope'

export * from './admin'
export * from './guru'

// ---------------------------------------------------------------------------------------------
// S6-T11 Admin Pusat central screens: Kelas Sekolah (API-ADM-05), Dashboard (API-ADM-11),
// Analitik (API-ADM-12) and Laporan (API-ADM-13, laporan part). Every success body is `{ data }`
// (the class list is `{ data, meta }`). Accuracy figures are percentages with ONE decimal
// (pooled correct / answered x 100), or null when nothing was answered.
// ---------------------------------------------------------------------------------------------

const central = {
  count: z.number().int().min(0),
  pct: z.number().min(0).max(100),
}

/** Both `{ id, name }` references of the class row. */
const AdminClassRefSchema = z.object({ id: IdSchema, name: z.string() })

export const AdminClassListQuerySchema = PageQuerySchema.extend({
  schoolId: IdSchema.optional().meta({ description: 'Only the classes of this school.' }),
  level: z.enum(CLASS_EDUCATION_LEVELS).optional().meta({ description: 'Level slug, for example `tingkatan-4`.' }),
  teacherId: IdSchema.optional().meta({ description: 'Only the classes of this class teacher.' }),
  search: z.string().trim().max(100).optional().meta({ description: 'Case-insensitive part of the class name (at most 100 characters).' }),
}).meta({ id: 'AdminClassListQuery' })
export type AdminClassListQuery = z.infer<typeof AdminClassListQuerySchema>

/**
 * One classroom-kind class of any school (secondary levels only). `level` is the label ("Tingkatan 4"). `pupils` is the number of
 * active enrolled pupils (the XS-1 query of S6-T03 is not merged yet, it is the class member count). `joinCode` and `isActive` carry the
 * `code` and `status` columns of FR-ADM-U08.1.
 */
export const AdminClassSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    level: z.string(),
    teacher: AdminClassRefSchema.nullable(),
    school: AdminClassRefSchema.nullable(),
    pupils: central.count,
    joinCode: z.string().nullable(),
    isActive: z.boolean(),
  })
  .meta({ id: 'AdminClass' })
export type AdminClass = z.infer<typeof AdminClassSchema>

export const AdminClassListResponseSchema = listEnvelopeOf(AdminClassSchema).meta({ id: 'AdminClassListResponse' })
export type AdminClassListResponse = z.infer<typeof AdminClassListResponseSchema>

const AdminQuestionStatusCountsSchema = z.object({ draft: central.count, review: central.count, approved: central.count, archived: central.count })

export const AdminDashboardSchema = z
  .object({
    questions: z.object({
      total: central.count,
      byStatus: AdminQuestionStatusCountsSchema,
      thisWeek: central.count.meta({ description: 'Questions created since Monday 00:00 (Asia/Kuala_Lumpur) of the current week.' }),
    }),
    subjects: z.object({ total: central.count, active: central.count }),
    levels: central.count.meta({ description: 'Tingkatan 1 to 5 (active, non-primary levels); Darjah is never counted.' }),
    users: z.object({ total: central.count, students: central.count, teachers: central.count }),
    battles: z.object({ total: central.count, active: central.count, finished: central.count }),
  })
  .meta({ id: 'AdminDashboard' })
export type AdminDashboard = z.infer<typeof AdminDashboardSchema>
export const AdminDashboardResponseSchema = z.object({ data: AdminDashboardSchema }).meta({ id: 'AdminDashboardResponse' })

export const ADMIN_ANALYTICS_RANGES = ['7d', '30d', '90d'] as const
export const AdminAnalyticsQuerySchema = z
  .object({
    range: z.string().optional().meta({ description: '7d, 30d or 90d. Anything else (or absent) is treated as 30d.' }),
  })
  .meta({ id: 'AdminAnalyticsQuery' })

const AdminBankRowSchema = z.object({ id: IdSchema, name: z.string(), total: central.count })

export const AdminAnalyticsSchema = z
  .object({
    range: z.enum(ADMIN_ANALYTICS_RANGES),
    platform: z.object({
      schools: central.count,
      activeSubscriptions: central.count,
      students: central.count,
      activeStudents: central.count.meta({ description: 'Pupils with at least one answer in the range.' }),
      answered: central.count.meta({ description: 'Answers of the range (all modes, test rows excluded).' }),
      accuracy: central.pct.nullable().meta({ description: 'Pooled correct / answered x 100, one decimal; null when nothing was answered.' }),
    }),
    trend: z
      .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), answered: central.count }))
      .meta({ description: 'One entry per day of the range ending today (YYYY-MM-DD, Asia/Kuala_Lumpur).' }),
    topSchools: z
      .array(z.object({ schoolId: IdSchema, school: z.string(), answered: central.count }))
      .meta({ description: 'Up to 10 schools by answers in the range.' }),
    bank: z.object({
      total: central.count,
      bySubject: z.array(AdminBankRowSchema),
      byLevel: z.array(AdminBankRowSchema),
      byStatus: AdminQuestionStatusCountsSchema,
      dskpTaggedShare: central.pct.meta({ description: 'Share (one decimal) of questions linked to a DSKP unit.' }),
      chapterCoverage: central.pct.meta({ description: 'Share (one decimal) of questions linked to a chapter (Bab).' }),
      servability: z
        .record(z.string(), central.count)
        .meta({ description: 'Servable questions per activity key (latih_tubi_spm, bab, simulasi_kuiz). Activities whose read is not exported by the questions module are absent.' }),
    }),
  })
  .meta({ id: 'AdminAnalytics' })
export type AdminAnalytics = z.infer<typeof AdminAnalyticsSchema>
export const AdminAnalyticsResponseSchema = z.object({ data: AdminAnalyticsSchema }).meta({ id: 'AdminAnalyticsResponse' })

export const ADMIN_LAPORAN_TYPES = ['kuiz', 'struktur', 'latihTubi', 'trackingA', 'battle', 'permainan'] as const
export const AdminLaporanQuerySchema = z
  .object({
    range: z.string().optional().meta({ description: 'Days of the tiles: 7, 30 or 90. Anything else is treated as 30. The trend is always 14 days.' }),
  })
  .meta({ id: 'AdminLaporanQuery' })

export const AdminLaporanSchema = z
  .object({
    range: z.union([z.literal(7), z.literal(30), z.literal(90)]),
    tiles: z.object({
      schools: central.count,
      teachers: central.count,
      pupils: central.count,
      pupilsAccessed: central.count.meta({ description: 'Pupils with a recorded login (Murid Pernah Akses, of `pupils`).' }),
      teachersAccessed: central.count.meta({ description: 'Teachers with a recorded login (Cikgu Pernah Akses, of `teachers`).' }),
      pupilsPractised: central.count.meta({ description: 'Pupils with at least one completed practice session (Murid Buat Latihan).' }),
      activities: central.count.meta({ description: 'Completed non-test practice sessions in the range (Jumlah Aktiviti), as the Guru Laporan counts them.' }),
      averageScore: central.pct.nullable().meta({ description: 'Pooled correct / questions x 100 over those sessions, one decimal (Skor Purata).' }),
    }),
    trend: z
      .array(z.object({ date: z.string(), count: central.count }))
      .meta({ description: 'Always 14 entries ending today; date is dd/mm.' }),
    breakdown: z
      .array(z.object({ type: z.enum(ADMIN_LAPORAN_TYPES), label: z.string(), count: central.count }))
      .meta({ description: 'Activities of the range per type (Pecahan Aktiviti); every type is listed, in a fixed order.' }),
    mostActive: z
      .array(z.object({ id: IdSchema, name: z.string(), school: AdminClassRefSchema.nullable(), activities: central.count }))
      .meta({ description: 'Up to 10 pupils by activities in the range (Admin Pusat only: names).' }),
    schoolActivity: z
      .array(z.object({ schoolId: IdSchema, name: z.string(), activities: central.count, activePupils: central.count }))
      .meta({ description: 'Up to 20 schools by activities in the range (Aktiviti Mengikut Sekolah).' }),
  })
  .meta({ id: 'AdminLaporan' })
export type AdminLaporan = z.infer<typeof AdminLaporanSchema>
export const AdminLaporanResponseSchema = z.object({ data: AdminLaporanSchema }).meta({ id: 'AdminLaporanResponse' })
