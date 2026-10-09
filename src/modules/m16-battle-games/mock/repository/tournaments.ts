/**
 * The `tournaments` repository (owner M16; SRS M16 v1.6 DATA-M16-11, BR-M16-32, BR-M16-38, §5
 * V-M16-07…12, §7 #1, #42-#45, §7.2 `tournaments.active()`). The seed has no tournament (as live);
 * the test fixtures of §6.11.7 add three. A `registration` tournament whose close date has passed is
 * `ongoing` (INFERRED; no job runs in the prototype, so the status is derived when read).
 */

import { fromMytParts } from '@/lib/time'
import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'
import { curriculum } from '@/modules/m03-curriculum/mock'

import { tournamentsTable } from '../tables/tables'
import type { TournamentRow, TournamentStatus } from '../types'
import { M16Error, m16Now, nowIso, schoolName } from './common'

export const tournamentQueries = defineNamedQueries(tournamentsTable, {
  'Q-TOURN-ACTIVE': {
    where: { status: ['registration', 'ongoing'] },
    expected: 0,
    source: 'M16 §6.10 (S23, banner)',
  },
})

export interface TournamentActive {
  uuid: string
  title: string
  status: 'registration' | 'ongoing'
  live_match: { school_a: string; school_b: string } | null
}

const FORMATS = ['single_match', 'knockout', 'league', 'hybrid'] as const
const MODES = ['subject', 'exam_paper', 'random_mix'] as const
const LEVELS = ['tingkatan4', 'tingkatan5', 'spm'] as const

/** `datetime-local` text (`YYYY-MM-DDTHH:mm[:ss]`, MYT) or ISO text to epoch ms; NaN when invalid. */
export function parseLocalDateTime(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim())
  if (m) {
    return fromMytParts({
      year: Number(m[1]),
      month: Number(m[2]),
      day: Number(m[3]),
      hour: Number(m[4]),
      minute: Number(m[5]),
      second: Number(m[6] ?? 0),
    })
  }
  return Date.parse(value)
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
      ? Number(v)
      : null

const inRange = (v: unknown, lo: number, hi: number): boolean => {
  const n = num(v)
  return n !== null && Number.isInteger(n) && n >= lo && n <= hi
}

export interface TournamentInput {
  title: string
  description: string
  educationLevelId: string
  format: TournamentRow['format']
  groupsCount: number | null
  questionMode: TournamentRow['questionMode']
  subjectId: number | null
  examPaperId: number | null
  mixedSubjectIds: number[]
  totalQuestions: number
  timeWindowMinutes: number
  topNScoring: number
  minParticipants: number
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  action: 'draft' | 'open_registration'
}

/**
 * Validates the S24 body (SRS §5 V-M16-07…12; PROPOSED messages). Returns the typed input, or throws
 * a `VALIDATION_ERROR` carrying every failing field.
 */
export function parseTournamentBody(body: unknown): TournamentInput {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const f: Record<string, string> = {}
  const title = typeof b.title === 'string' ? b.title.trim() : ''
  if (title === '' || title.length > 255) f.title = 'Tajuk tournament diperlukan.'
  const level = b.education_level_id
  if (!LEVELS.includes(level as (typeof LEVELS)[number])) {
    f.education_level_id = 'Sila pilih tahap pendidikan.'
  }
  const format = b.format
  if (!FORMATS.includes(format as (typeof FORMATS)[number])) f.format = 'Format tidak sah.'
  let groups: number | null = null
  if (format === 'league' || format === 'hybrid') {
    if (inRange(b.groups_count, 2, 8)) groups = Number(b.groups_count)
    else f.groups_count = 'Bilangan kumpulan mesti antara 2 dan 8.'
  }
  const mode = b.question_mode
  let subjectId: number | null = null
  const examPaperId: number | null = null
  let mixed: number[] = []
  if (!MODES.includes(mode as (typeof MODES)[number])) {
    f.question_mode = 'Sila pilih sumber soalan.'
  } else if (mode === 'subject') {
    const s = num(b.subject_id)
    if (s !== null && Number.isInteger(s) && s >= 1 && s <= 31 && curriculum.subject(s))
      subjectId = s
    else f.subject_id = 'Sila pilih sumber soalan.'
  } else if (mode === 'exam_paper') {
    // No exam paper exists (as live, DV-M16-28): any value is refused.
    f.exam_paper_id = 'Sila pilih sumber soalan.'
  } else {
    const raw = Array.isArray(b.mixed_subject_ids) ? b.mixed_subject_ids : []
    mixed = raw.map(num).filter((n): n is number => n !== null && !!curriculum.subject(n))
    if (mixed.length === 0) f.mixed_subject_ids = 'Sila pilih sumber soalan.'
  }
  const ranges: [string, number, number][] = [
    ['total_questions', 5, 100],
    ['time_window_minutes', 10, 180],
    ['top_n_scoring', 1, 50],
    ['min_participants', 1, 100],
  ]
  for (const [key, lo, hi] of ranges) if (!inRange(b[key], lo, hi)) f[key] = 'Nilai di luar julat.'
  const opens =
    typeof b.registration_opens_at === 'string' && b.registration_opens_at !== ''
      ? b.registration_opens_at
      : null
  const closes =
    typeof b.registration_closes_at === 'string' && b.registration_closes_at !== ''
      ? b.registration_closes_at
      : null
  if (opens !== null && Number.isNaN(parseLocalDateTime(opens)))
    f.registration_opens_at = 'Tarikh tidak sah.'
  if (closes !== null && Number.isNaN(parseLocalDateTime(closes)))
    f.registration_closes_at = 'Tarikh tidak sah.'
  if (
    opens !== null &&
    closes !== null &&
    !f.registration_opens_at &&
    !f.registration_closes_at &&
    parseLocalDateTime(closes) < parseLocalDateTime(opens)
  ) {
    f.registration_closes_at = 'Tarikh tutup mesti selepas tarikh buka.'
  }
  const action = b.action
  if (action !== 'draft' && action !== 'open_registration') f.action = 'Tindakan tidak sah.'
  if (Object.keys(f).length > 0) {
    throw new M16Error('VALIDATION_ERROR', Object.values(f)[0] as string, undefined, f)
  }
  return {
    title,
    description: typeof b.description === 'string' ? b.description : '',
    educationLevelId: level as string,
    format: format as TournamentInput['format'],
    groupsCount: groups,
    questionMode: mode as TournamentInput['questionMode'],
    subjectId,
    examPaperId,
    mixedSubjectIds: mixed,
    totalQuestions: Number(b.total_questions),
    timeWindowMinutes: Number(b.time_window_minutes),
    topNScoring: Number(b.top_n_scoring),
    minParticipants: Number(b.min_participants),
    registrationOpensAt: opens,
    registrationClosesAt: closes,
    action: action as TournamentInput['action'],
  }
}

/** The status a reader sees: `registration` past its close date is `ongoing` (BR-M16-32). */
export function effectiveStatus(t: TournamentRow, now: number): TournamentStatus {
  if (t.status !== 'registration' || t.registrationClosesAt === null) return t.status
  const close = parseLocalDateTime(t.registrationClosesAt)
  return Number.isNaN(close) || close > now ? 'registration' : 'ongoing'
}

export const tournamentsRepo = defineRepository({
  owner: 'M16',
  name: 'tournaments',
  store: tournamentsTable,
  queries: tournamentQueries,
  methods: ({ store, transaction }) => {
    /** Active tournaments (registration or ongoing), banner order (BR-M16-38). */
    const activeRows = (): (TournamentRow & { shown: 'registration' | 'ongoing' })[] => {
      const now = m16Now()
      return store
        .query({})
        .rows.flatMap((t) => {
          const s = effectiveStatus(t, now)
          return s === 'registration' || s === 'ongoing' ? [{ ...t, shown: s }] : []
        })
        .sort((a, b) => {
          const ao =
            a.registrationOpensAt === null ? Infinity : parseLocalDateTime(a.registrationOpensAt)
          const bo =
            b.registrationOpensAt === null ? Infinity : parseLocalDateTime(b.registrationOpensAt)
          return ao - bo || a.createdAtMs - b.createdAtMs || a.seq - b.seq
        })
    }

    return {
      /** BR-M16-38 / §7.2: the banner list `{uuid, title, status, live_match}`. */
      active(): TournamentActive[] {
        return activeRows().map((t) => ({
          uuid: t.id,
          title: t.title,
          status: t.shown,
          live_match: t.liveMatch
            ? { school_a: t.liveMatch.schoolA, school_b: t.liveMatch.schoolB }
            : null,
        }))
      },

      /** #42: the list `{uuid, title, status}`. */
      list(): { uuid: string; title: string; status: 'registration' | 'ongoing' }[] {
        return activeRows().map((t) => ({ uuid: t.id, title: t.title, status: t.shown }))
      },

      /** #45: one tournament; drafts only for admins. */
      get(
        uuid: string,
        isAdmin: boolean,
      ): (TournamentRow & { shown: TournamentStatus }) | undefined {
        const t = store.get(uuid)
        if (!t || (t.status === 'draft' && !isAdmin)) return undefined
        return { ...t, shown: effectiveStatus(t, m16Now()) }
      },

      /** #44: creates a tournament (`draft` or `registration`, BR-M16-32). */
      create(input: TournamentInput, adminId: number): TournamentRow {
        return transaction(() =>
          store.insert({
            title: input.title,
            description: input.description,
            educationLevelId: input.educationLevelId,
            format: input.format,
            groupsCount: input.groupsCount,
            questionMode: input.questionMode,
            subjectId: input.subjectId,
            examPaperId: input.examPaperId,
            mixedSubjectIds: input.mixedSubjectIds,
            totalQuestions: input.totalQuestions,
            timeWindowMinutes: input.timeWindowMinutes,
            topNScoring: input.topNScoring,
            minParticipants: input.minParticipants,
            registrationOpensAt: input.registrationOpensAt,
            registrationClosesAt: input.registrationClosesAt,
            status: input.action === 'draft' ? 'draft' : 'registration',
            liveMatch: null,
            createdBy: adminId,
            createdAt: nowIso(),
            createdAtMs: m16Now(),
            seq: store.count() + 1,
          }),
        )
      },

      /** Test fixture `tournaments` (§6.11.7): the three placeholder tournaments of discovery. */
      insertFixtures(adminId: number): TournamentRow[] {
        return transaction(() => {
          const base = {
            description: '',
            educationLevelId: 'spm',
            format: 'hybrid' as const,
            groupsCount: 2,
            questionMode: 'subject' as const,
            subjectId: 3,
            examPaperId: null,
            mixedSubjectIds: [] as number[],
            totalQuestions: 40,
            timeWindowMinutes: 60,
            topNScoring: 20,
            minParticipants: 10,
            registrationOpensAt: null,
            registrationClosesAt: null,
            createdBy: adminId,
            createdAt: nowIso(),
            createdAtMs: m16Now(),
          }
          return [
            store.insert({
              ...base,
              seq: store.count() + 1,
              title: 'Contoh Tournament Pendaftaran',
              status: 'registration',
              liveMatch: null,
            }),
            store.insert({
              ...base,
              seq: store.count() + 1,
              title: 'Contoh Tournament Berlangsung',
              status: 'ongoing',
              liveMatch: null,
            }),
            store.insert({
              ...base,
              seq: store.count() + 1,
              title: 'Contoh Tournament LIVE',
              status: 'ongoing',
              liveMatch: { schoolA: schoolName(8106), schoolB: schoolName(8090) },
            }),
          ]
        })
      },
    }
  },
})
