/**
 * The `submissions` repository (owner M04; SRS §6.4 DATA-M04-05, BR-M04-18, §7 #20–#22): the
 * question papers teachers upload in M10 and admins manage on S10. M10 creates rows through
 * `submissions.create` (a new upload starts `pending`); S10 lists them and changes the status.
 */

import { toIsoMyt } from '@/lib/time'
import { defineNamedQueries } from '@/mock/dataset'
import { defineTable, maxPlusOne, type Where } from '@/mock/define'
import { defineRepository, RepositoryError } from '@/mock/repository'

export type SubmissionStatus = 'pending' | 'processing' | 'done' | 'rejected'

export const SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
  'pending',
  'processing',
  'done',
  'rejected',
]

/** The 7 paper types of the M10 form, stored as the live value = label (DATA-M04-05). */
export const PAPER_TYPES = [
  'Soalan Umum',
  'Kertas Percubaan',
  'Soalan DSKP',
  'Buku Teks',
  'Buku Latihan',
  'Soalan Peperiksaan',
  'Lain-lain',
] as const

/** The status note limit of S10 (`maxlength` 1000, BR-M04-18). */
export const SUBMISSION_NOTES_MAX = 1000

export interface SubmissionFile {
  /** 0-based position in the upload (`/files/:index`). */
  index: number
  name: string
  size: number
  mime: string
}

export interface QuestionSubmission {
  id: number
  teacherId: number
  /** Free text as typed, e.g. "SEJARAH SPM". */
  subjectText: string
  /** "T1"–"T5" or null. */
  levelCode: string | null
  year: number
  paperType: string
  authorCredit: string
  note: string | null
  files: SubmissionFile[]
  status: SubmissionStatus
  adminNotes: string | null
  createdAt: string
}

export const submissionsTable = defineTable<QuestionSubmission>({
  name: 'questionSubmissions',
  ids: maxPlusOne(),
  indexes: ['teacherId', 'status'],
})

export const submissionQueries = defineNamedQueries(submissionsTable, {
  'S-STATUS': {
    where: (status?: SubmissionStatus): Where<QuestionSubmission> =>
      status === undefined ? {} : { status },
    source: 'M04 §7 #20 meta.counts',
  },
})

export interface SubmissionInput {
  teacherId: number
  subjectText: string
  levelCode?: string | null
  year: number
  paperType: string
  authorCredit: string
  note?: string | null
  files: readonly Omit<SubmissionFile, 'index'>[]
}

export interface SubmissionUpdate {
  status: SubmissionStatus
  adminNotes?: string | null
}

function contract(message: string): never {
  throw new RepositoryError('CONTRACT', `submissions: ${message}`)
}

export const submissionsRepo = defineRepository({
  name: 'submissions',
  owner: 'M04',
  store: submissionsTable,
  queries: submissionQueries,
  methods: ({ store, transaction }) => ({
    get: (id: number): QuestionSubmission | null => store.get(id) ?? null,
    /** S10 (#20): one status (`undefined` = all), newest first (id descending as live). */
    list: (status?: string): QuestionSubmission[] =>
      store.query({
        where: status === undefined ? {} : { status: status as SubmissionStatus },
        sort: { field: 'id', dir: 'desc' },
      }).rows,
    /** `meta.counts` of #20: over every row, whatever the filter. */
    counts: (): Record<'all' | SubmissionStatus, number> => ({
      all: store.count(),
      pending: store.count({ status: 'pending' }),
      processing: store.count({ status: 'processing' }),
      done: store.count({ status: 'done' }),
      rejected: store.count({ status: 'rejected' }),
    }),
    /** M10 upload: a new paper starts `pending` (BR-M04-18). */
    create: (input: SubmissionInput, now: number): QuestionSubmission => {
      if (input.files.length === 0) contract('a paper needs at least one file')
      return transaction(() =>
        store.insert({
          teacherId: input.teacherId,
          subjectText: input.subjectText,
          levelCode: input.levelCode ?? null,
          year: input.year,
          paperType: input.paperType,
          authorCredit: input.authorCredit,
          note: input.note ?? null,
          files: input.files.map((f, index) => ({ index, ...f })),
          status: 'pending',
          adminNotes: null,
          createdAt: toIsoMyt(now),
        }),
      )
    },
    /** #21: any status may follow any other (BR-M04-18); `adminNotes` replaces when given. */
    updateStatus: (id: number, patch: SubmissionUpdate): QuestionSubmission | null => {
      if (!store.get(id)) return null
      return transaction(() =>
        store.update(id, {
          status: patch.status,
          ...(patch.adminNotes !== undefined ? { adminNotes: patch.adminNotes } : {}),
        }),
      )
    },
    /** Seed rows; seed phase, through the repository (rule 3a). */
    seedRows: (rows: readonly QuestionSubmission[]): void => {
      for (const r of rows) store.insert(r)
    },
  }),
})
