/**
 * M27 Part B client and types (SRS M27 Part B, §19 #2 to #22; build-plan M27-T1a). Screens S1 to S12.
 * UI tasks read this file and do not change it (build-plan §S.3 rule 5).
 *
 * Guard **SA** on every endpoint except #21: `school_admin` with a school, the school is forced from the
 * session and no request value changes it (FR-M27-42). Failures reject with `ApiError`: 401 guest, 403
 * other role or no school (and, on #7/#8/#9/#11/#13/#15, an inactive in-school account), 404 an id that
 * is not a user of the school and of the page's role, 422 validation (`fields`).
 *
 * All ids are integers. Counts are plain numbers (the page formats with `ms-MY`). Dates are ISO 8601
 * (+08:00); the page formats `dd/mm/yyyy`. `status` on writes carries the UNVERIFIED COPY flash of M02.
 *
 * `#4` (S3 `StatsReport`) is typed here as {@link SchoolActivityReport}, the M17 shape (M17 SRS §7 #18) in
 * the school scope; its handler is M27-T1c. `#19`, `#20`, `#21` handlers are
 * M27-T1b and M27-T1d; their client functions are here so every screen builds against one file.
 */

import { api, type ListResult } from '@/api'
import type { UserMe } from '@/modules/m01-authentication'

const BASE = '/api/admin-sekolah'

// --- shared ------------------------------------------------------------------------------------

export type UsagePeriod = 'today' | '7days' | '30days'
export type HeatmapLevelCode = 't4' | 't5'
export type DskpStatus = 'mahir' | 'sederhana' | 'lemah' | 'belum'

export interface SchoolRef {
  id: number
  name: string
}

export interface SchoolInfo extends SchoolRef {
  code: string | null
  district: string | null
  state: string
}

// --- #2 S1 usage -------------------------------------------------------------------------------

export interface SchoolUsageMode {
  label: string
  sessions: number
  /** One decimal; null without a session with questions. */
  accuracy: number | null
}

export interface SchoolUsage {
  school: SchoolRef
  period: UsagePeriod
  label: 'Hari Ini' | '7 Hari' | '30 Hari'
  tiles: {
    pupils: number
    teachers: number
    activePupils: number
    /** Integer percent. */
    participationPct: number
    sessions: number
    answers: number
    /** One decimal; null = "—". */
    accuracy: number | null
  }
  /** Sessions descending, ties by label; rows with sessions only. */
  modes: SchoolUsageMode[]
}

/** #2 `GET /api/admin-sekolah/usage?period=` (S1). An unknown period gives `30days`. */
export const fetchSchoolUsage = (o: { period?: string | null; signal?: AbortSignal } = {}) =>
  api.get<SchoolUsage>(`${BASE}/usage`, {
    query: { period: o.period },
    ...(o.signal ? { signal: o.signal } : {}),
  })

// --- #3 S2 DSKP heatmap ------------------------------------------------------------------------

export interface HeatmapSp {
  id: number
  code: string
  title: string
  answered: number
  correct: number
  /** Rounded half up; null = "Belum cuba". */
  pct: number | null
  status: DskpStatus
}

export interface HeatmapBidang {
  id: number
  code: string | null
  name: string
  sp: HeatmapSp[]
}

export interface SchoolDskpHeatmap {
  school: SchoolRef
  /** Subjects with at least one SP at the level, by name. */
  subjects: { id: number; name: string }[]
  subject: { id: number; name: string } | null
  level: { code: HeatmapLevelCode; name: 'Tingkatan 4' | 'Tingkatan 5' }
  /** "KSSM {Subjek} Tingkatan {n}"; null without a subject. */
  caption: string | null
  bidang: HeatmapBidang[]
}

/** #3 `GET /api/admin-sekolah/dskp-heatmap?subjectId=&tingkatan=` (S2). Unknown values fall back to the defaults. */
export const fetchSchoolDskpHeatmap = (
  o: {
    subjectId?: number | null
    tingkatan?: string | null
    signal?: AbortSignal
  } = {},
) =>
  api.get<SchoolDskpHeatmap>(`${BASE}/dskp-heatmap`, {
    query: { subjectId: o.subjectId, tingkatan: o.tingkatan },
    ...(o.signal ? { signal: o.signal } : {}),
  })

// --- #4 S3 activity report (handler: M27-T1c; shape after M17 SRS §7 #18) --------------------------

export interface ActivityPupilRow {
  userId: number
  name: string
  className: string | null
  sessions: number
  /** correct / answered x 100, one decimal, never above 100. */
  accuracy: number
  seconds: number
  coins: number
  lastLoginAt: string | null
}

export interface ActivityTeacherRow {
  userId: number
  name: string
  email: string
  loggedIn: boolean
  mcq: number
  structured: number
  coins: number
  hasHeadcount: boolean
  lastLoginAt: string | null
}

/**
 * The M17 `StatsReport` (SRS M17 §7 #18) in the school scope (BR-M27-26): no `schools`, no `overview.score` /
 * `structuredScore` ("Skor Purata" and "Struktur" are never rendered), no `schoolName` on the rows and
 * `tiles` without the `schools` group.
 */
export interface SchoolActivityReport {
  range: 7 | 30 | 90
  /** The session school. */
  schoolId: number
  /** Request clock, ISO +08:00. */
  generatedAt: string
  overview: {
    pupils: number
    pupilsLogged: number
    teachers: number
    teachersLogged: number
    practised: number
    activity: number
  }
  trend: { label: string; value: number }[]
  breakdown: { quiz: number; structured: number; battle: number; game: number }
  topPupils: { userId: number; name: string; activities: number }[]
  teachersNeverLogged: { userId: number; name: string; email: string }[]
  teachers: ActivityTeacherRow[]
  /** Pills "Semua", "Aktif", "Login Sahaja", "Belum Login"; up to 200 rows each. */
  pupils: {
    semua: ActivityPupilRow[]
    aktif: ActivityPupilRow[]
    loginSahaja: ActivityPupilRow[]
    belumLogin: ActivityPupilRow[]
  }
  tiles: {
    teachers: {
      total: number
      logged: number
      /** School-scoped "Jumlah Soalan" (lead decision). */
      questions: number
      coins: number
    }
    pupils: { total: number; practised: number; sessions: number; accuracy: number }
  }
}

/** #4 `GET /api/admin-sekolah/laporan-aktiviti?range=` (S3). */
export const fetchSchoolActivityReport = (
  o: { range?: number | null; signal?: AbortSignal } = {},
) =>
  api.get<SchoolActivityReport>(`${BASE}/laporan-aktiviti`, {
    query: { range: o.range },
    ...(o.signal ? { signal: o.signal } : {}),
  })

// --- #5 S5 monthly report ----------------------------------------------------------------------

export interface MonthlySubjectRow {
  name: string
  /** One decimal. */
  accuracy: number
  answers: number
  pupils: number
}

export interface MonthlyMonthRow {
  /** `YYYY-MM`. */
  month: string
  /** "Sep 2026" style BM label. */
  label: string
  answers: number
  correct: number
  activePupils: number
  /** One decimal. */
  perPupil: number
  /** One decimal. */
  accuracy: number
}

export interface MonthlyReport {
  school: SchoolRef
  /** `YYYY-MM`. */
  month: string
  /** "September 2026". */
  label: string
  prev: string
  /** Null while the shown month is the current month. */
  next: string | null
  cards: {
    participationPct: number
    active: number
    registered: number
    answers: number
    /** Integer: round(answers ÷ active), 0 without an active pupil. */
    perPupil: number
    /** One decimal; null = "—". */
    accuracy: number | null
    sessions: number
  }
  /** Empty for a month without answers; ascending by month. */
  months: MonthlyMonthRow[]
  total: { answers: number; correct: number; accuracy: number | null } | null
  subjects: {
    strongest: MonthlySubjectRow | null
    weakest: MonthlySubjectRow | null
    rows: MonthlySubjectRow[]
  }
  /** ISO 8601 (+08:00), the request minute. */
  generatedAt: string
}

/** #5 `GET /api/admin-sekolah/laporan-bulanan?bulan=YYYY-MM` (S5). Invalid or future gives the current month. */
export const fetchMonthlyReport = (o: { bulan?: string | null; signal?: AbortSignal } = {}) =>
  api.get<MonthlyReport>(`${BASE}/laporan-bulanan`, {
    query: { bulan: o.bulan },
    ...(o.signal ? { signal: o.signal } : {}),
  })

// --- #6, #10, #17, #18 S6 and S7 lists ---------------------------------------------------------

export interface SchoolPupilRow {
  id: number
  name: string
  initials: string
  email: string
  phone: string | null
  /** "Tingkatan 1…5", "Darjah 1…6" or null ("-"). */
  gradeLabel: string | null
  /** Active classes of both kinds (inactive classes left out). */
  classNames: string[]
  isActive: boolean
  createdAt: string
  /** True only for an active pupil (name link and "Edit"). */
  canEdit: boolean
}

export interface SchoolTeacherRow {
  id: number
  name: string
  initials: string
  email: string
  phone: string | null
  /** Active classes owned by the teacher ("{n} kelas", "-" when 0). */
  classCount: number
  lastLoginAt: string | null
  isActive: boolean
  createdAt: string
  canEdit: boolean
}

/** `meta` of #6 and #10: cards ignore the filters. */
export interface SchoolUserListMeta {
  counts: { total: number; active: number; inactive: number }
}

export interface SchoolUserListQuery {
  /** `1` or `0`; anything else = all. */
  isActive?: boolean | string | null
  search?: string | null
  page?: number | null
  signal?: AbortSignal
}

const userListQuery = (o: SchoolUserListQuery) => ({
  is_active: o.isActive === true ? '1' : o.isActive === false ? '0' : o.isActive,
  search: o.search,
  page: o.page,
})

/** #6 `GET /api/admin-sekolah/pelajar` (S6): active first, then id descending, 25 per page. */
export const fetchSchoolPupils = (o: SchoolUserListQuery = {}) =>
  api.list<SchoolPupilRow, SchoolUserListMeta>(`${BASE}/pelajar`, {
    query: userListQuery(o),
    ...(o.signal ? { signal: o.signal } : {}),
  })

/** #10 `GET /api/admin-sekolah/guru` (S7). */
export const fetchSchoolTeachers = (o: SchoolUserListQuery = {}) =>
  api.list<SchoolTeacherRow, SchoolUserListMeta>(`${BASE}/guru`, {
    query: userListQuery(o),
    ...(o.signal ? { signal: o.signal } : {}),
  })

/** #17 `GET /api/admin-sekolah/pelajar/export.csv` ("Eksport CSV", S6): `users-pelajar-{yyyy-mm-dd}.csv`. */
export const downloadPupilsCsv = (
  o: Pick<SchoolUserListQuery, 'isActive' | 'search' | 'signal'> = {},
) =>
  api.blob(`${BASE}/pelajar/export.csv`, {
    query: { is_active: userListQuery(o).is_active, search: o.search },
    ...(o.signal ? { signal: o.signal } : {}),
  })

/** #18 `GET /api/admin-sekolah/guru/export.csv` ("Eksport CSV", S7): `users-guru-{yyyy-mm-dd}.csv`. */
export const downloadTeachersCsv = (
  o: Pick<SchoolUserListQuery, 'isActive' | 'search' | 'signal'> = {},
) =>
  api.blob(`${BASE}/guru/export.csv`, {
    query: { is_active: userListQuery(o).is_active, search: o.search },
    ...(o.signal ? { signal: o.signal } : {}),
  })

// --- #7, #11 detail; #8, #9, #12 to #15 writes --------------------------------------------------

export interface SchoolUserDetail {
  id: number
  name: string
  email: string
  phone: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  role: 'student' | 'teacher'
  school: SchoolInfo
}

/** Writes answer `{data, status}` (`status` = the UNVERIFIED COPY flash). */
export interface WriteResult<T> {
  data: T
  status: string
}

export interface SchoolUserInput {
  name: string
  email: string
  phone?: string | null
  /** Optional pair (#8 / #13): both apply in the same request as the profile fields, or none does. */
  newPassword?: string
  newPasswordConfirmation?: string
}

export interface ResetPasswordInput {
  newPassword: string
  newPasswordConfirmation: string
}

export interface CreateTeacherInput extends SchoolUserInput {
  password: string
  passwordConfirmation: string
}

export interface CreatePupilInput {
  name: string
  email: string
  /** Empty or absent = the M02 default password. Typed: 8 to 255 characters. */
  password?: string | null
  /** An active `classroom` of the school. */
  classId?: number | null
}

/** #19 response: `credential` is the only place a password is rendered (BR-M27-41). */
export interface CreatePupilResult extends WriteResult<SchoolUserDetail> {
  credential: { name: string; school: string; email: string; password: string }
}

/** #7 `GET /api/admin-sekolah/pelajar/:id` (S9). 403 for an inactive pupil. */
export const fetchSchoolPupil = (id: number, o: { signal?: AbortSignal } = {}) =>
  api.get<SchoolUserDetail>(`${BASE}/pelajar/${String(id)}`, o.signal ? { signal: o.signal } : {})

/** #8 `PUT /api/admin-sekolah/pelajar/:id`. Keys other than name, email and phone are ignored. */
export const updateSchoolPupil = (id: number, input: SchoolUserInput) =>
  api.put<WriteResult<SchoolUserDetail>>(`${BASE}/pelajar/${String(id)}`, {
    body: input,
    raw: true,
  })

/** #9 `POST /api/admin-sekolah/pelajar/:id/reset-password`. */
export const resetSchoolPupilPassword = (id: number, input: ResetPasswordInput) =>
  api.post<WriteResult<{ reset: true }>>(`${BASE}/pelajar/${String(id)}/reset-password`, {
    body: input,
    raw: true,
  })

/** #11 `GET /api/admin-sekolah/guru/:id` (S10). 403 for an inactive teacher. */
export const fetchSchoolTeacher = (id: number, o: { signal?: AbortSignal } = {}) =>
  api.get<SchoolUserDetail>(`${BASE}/guru/${String(id)}`, o.signal ? { signal: o.signal } : {})

/** #12 `POST /api/admin-sekolah/guru` (S11): 201, role `teacher`, own school, active. */
export const createSchoolTeacher = (input: CreateTeacherInput) =>
  api.post<WriteResult<SchoolUserDetail>>(`${BASE}/guru`, { body: input, raw: true })

/** #13 `PUT /api/admin-sekolah/guru/:id`. */
export const updateSchoolTeacher = (id: number, input: SchoolUserInput) =>
  api.put<WriteResult<SchoolUserDetail>>(`${BASE}/guru/${String(id)}`, { body: input, raw: true })

/** #14 `POST /api/admin-sekolah/guru/:id/toggle-active` (works on an inactive teacher). */
export const toggleSchoolTeacherActive = (id: number) =>
  api.post<WriteResult<{ isActive: boolean }>>(`${BASE}/guru/${String(id)}/toggle-active`, {
    raw: true,
  })

/** #15 `POST /api/admin-sekolah/guru/:id/reset-password`. */
export const resetSchoolTeacherPassword = (id: number, input: ResetPasswordInput) =>
  api.post<WriteResult<{ reset: true }>>(`${BASE}/guru/${String(id)}/reset-password`, {
    body: input,
    raw: true,
  })

/** #19 `POST /api/admin-sekolah/pelajar` (S12): 201 with the one-time `credential`. */
export const createSchoolPupil = (input: CreatePupilInput) =>
  api.post<CreatePupilResult>(`${BASE}/pelajar`, { body: input, raw: true })

// --- #22 S12 form options ----------------------------------------------------------------------

export interface SchoolPupilFormOptions {
  school: SchoolInfo
  /** The school's active `classroom` classes by name A to Z (valid targets of #19). */
  classes: { id: number; name: string }[]
  /** Non-secret placeholder (bullets of the default password's length); never the literal password. */
  passwordPlaceholder: string
  passwordHint: 'Biarkan kosong untuk guna kata laluan lalai (minimum 8 aksara).'
  passwordMinLength: 8
}

/** #22 `GET /api/admin-sekolah/pelajar/form-options` (S12). */
export const fetchSchoolPupilFormOptions = (o: { signal?: AbortSignal } = {}) =>
  api.get<SchoolPupilFormOptions>(
    `${BASE}/pelajar/form-options`,
    o.signal ? { signal: o.signal } : {},
  )

// --- #16 S8 classes ----------------------------------------------------------------------------

export interface SchoolClassRow {
  /** `classroom:{id}`. */
  key: string
  kind: 'classroom'
  id: number
  name: string
  subject: { id: number; name: string } | null
  /** "Tingkatan n" / "Darjah n". */
  levelLabel: string
  teacherName: string | null
  /** Active enrolments (may include pupils of another school). */
  members: number
  joinCode: string | null
  isActive: boolean
  /** `/prestasi/kelas/{id}`. */
  link: string
}

export interface SchoolClassListMeta {
  /** Rows matching the filters ("{n} kelas dipaparkan"). */
  displayed: number
}

/** #16 body: the list envelope plus `tiles` and `levels` (top-level extras, so the call uses `raw`). */
export interface SchoolClassList extends ListResult<SchoolClassRow, SchoolClassListMeta> {
  tiles: { activeClasses: number }
  /** Levels present in the school's classes ("Tingkatan n" / "Darjah n"). */
  levels: { code: string; label: string }[]
}

export interface SchoolClassListQuery {
  level?: string | null
  search?: string | null
  page?: number | null
  signal?: AbortSignal
}

/** #16 `GET /api/admin-sekolah/kelas` (S8): ordered by class name A to Z, 25 per page. */
export const fetchSchoolClasses = (o: SchoolClassListQuery = {}) =>
  api.get<SchoolClassList>(`${BASE}/kelas`, {
    query: { level: o.level, search: o.search, page: o.page },
    raw: true,
    ...(o.signal ? { signal: o.signal } : {}),
  })

// --- #20, #21 "Menyamar" (handlers: M27-T1d) -----------------------------------------------------

export interface ImpersonationSession {
  token: string
  expiresAt: string
  user: UserMe
}

export type ImpersonateResult = WriteResult<
  ImpersonationSession & { impersonator: { id: number; name: string } }
>

export type LeaveImpersonationResult = WriteResult<
  ImpersonationSession & {
    returnTo: '/admin-sekolah/pelajar' | '/admin-sekolah/guru'
    /** The actor session's "Ingat saya" flag, so the client keeps it when restoring the session. */
    remember?: boolean
  }
>

/** #20 `POST /api/admin-sekolah/users/:id/impersonate`. 409 when already impersonating. */
export const impersonateSchoolUser = (id: number) =>
  api.post<ImpersonateResult>(`${BASE}/users/${String(id)}/impersonate`, { raw: true })

/** #21 `POST /api/admin-sekolah/impersonate/leave` ("Kembali ke Admin"). */
export const leaveImpersonation = () =>
  api.post<LeaveImpersonationResult>(`${BASE}/impersonate/leave`, { raw: true })
