/**
 * The `masterNotes` repository (owner M04; SRS §6.5 DATA-M04-06, BR-M04-23, §7 #26–#27): the
 * AI "master notes" (a misconception note and a trap per question) that S12 lets an admin review.
 *
 * The seed is the D11 set of 525 notes (ids 1–525), so it is a materialised table: every count is
 * computed from its rows. The live flags are 0 flagged and 0 teacher-approved; test overrides
 * (`reset({ masterNotes: { flagged: [...], approved: [...] } })`) set them.
 */

import { defineNamedQueries } from '@/mock/dataset'
import { defineTable, maxPlusOne, type Where } from '@/mock/define'
import { defineRepository, RepositoryError } from '@/mock/repository'

export type MasterNoteTab = 'flagged' | 'approved' | 'all'
export type MasterNoteAction = 'approve' | 'regen' | 'unflag'

export interface MasterNote {
  id: number
  questionId: number
  /** The subject and question text the note was written for; null = read from the question row. */
  subjectName: string | null
  questionText: string | null
  /** null = "—" on S12. */
  chapter: string | null
  model: string
  tokens: number
  confidence: number
  noteText: string
  trapText: string
  flagged: boolean
  teacherApproved: boolean
  /** How many times "Regenerate" ran (picks the next canned note, BR-M04-23). */
  regenCount: number
  createdAt: string
}

/** S12 page size (BR-M04-23). */
export const MASTER_NOTES_PAGE_SIZE = 15

export const masterNotesTable = defineTable<MasterNote>({
  name: 'questionMasterNotes',
  ids: maxPlusOne(),
  indexes: ['flagged', 'teacherApproved'],
})

export const masterNoteQueries = defineNamedQueries(masterNotesTable, {
  'MN-ALL': {
    where: (): Where<MasterNote> => ({}),
    source: 'M04 §7 #26 meta.summary.total',
  },
  'MN-FLAGGED': {
    where: (): Where<MasterNote> => ({ flagged: true }),
    source: 'M04 §7 #26 meta.summary.flagged',
  },
  'MN-APPROVED': {
    where: (): Where<MasterNote> => ({ teacherApproved: true }),
    source: 'M04 §7 #26 meta.summary.teacherApproved',
  },
})

/** The 3 canned regeneration notes, cycled (BR-M04-23; D4 no external AI). PROPOSED texts. */
export const CANNED_NOTES: readonly { noteText: string; trapText: string; tokens: number }[] = [
  {
    noteText:
      'Mungkin anda keliru sebab anda menganggap dua konsep yang berkaitan sebagai sama. Bandingkan takrifan setiap konsep sebelum memilih jawapan.',
    trapText: 'Salah faham tentang perbezaan antara dua konsep yang hampir serupa.',
    tokens: 745,
  },
  {
    noteText:
      'Mungkin anda tergesa-gesa membaca soalan dan terlepas kata kunci. Baca semula arahan dan tandakan kata kunci sebelum mengira atau memilih.',
    trapText: 'Terlepas kata kunci dalam soalan lalu memilih jawapan yang kelihatan betul.',
    tokens: 802,
  },
  {
    noteText:
      'Mungkin anda mengingati peraturan tetapi tersalah menggunakannya dalam situasi ini. Semak syarat penggunaan peraturan itu langkah demi langkah.',
    trapText: 'Menggunakan peraturan yang betul pada situasi yang tidak sesuai.',
    tokens: 768,
  },
]

function contract(message: string): never {
  throw new RepositoryError('CONTRACT', `masterNotes: ${message}`)
}

export const masterNotesRepo = defineRepository({
  name: 'masterNotes',
  owner: 'M04',
  store: masterNotesTable,
  queries: masterNoteQueries,
  methods: ({ store, transaction }) => ({
    get: (id: number): MasterNote | null => store.get(id) ?? null,
    /** S12 (#26): one tab, `id` descending, 15 per page (BR-M04-23). */
    list: (tab: MasterNoteTab, page: number) =>
      store.query({
        where:
          tab === 'flagged'
            ? { flagged: true }
            : tab === 'approved'
              ? { teacherApproved: true }
              : {},
        sort: { field: 'id', dir: 'desc' },
        page,
        pageSize: MASTER_NOTES_PAGE_SIZE,
      }),
    /** The S12 summary line: flagged, teacher-approved and all notes. */
    summary: (): { flagged: number; teacherApproved: number; total: number } => ({
      flagged: store.count({ flagged: true }),
      teacherApproved: store.count({ teacherApproved: true }),
      total: store.count(),
    }),
    /**
     * #27 (BR-M04-23): `approve` → approved and unflagged; `unflag` → unflagged; `regen` → the next
     * canned note (flags kept). `null` for an unknown id.
     */
    act: (id: number, action: MasterNoteAction): MasterNote | null => {
      const row = store.get(id)
      if (!row) return null
      return transaction(() => {
        if (action === 'approve') return store.update(id, { teacherApproved: true, flagged: false })
        if (action === 'unflag') return store.update(id, { flagged: false })
        const canned = CANNED_NOTES[
          row.regenCount % CANNED_NOTES.length
        ] as (typeof CANNED_NOTES)[number]
        return store.update(id, {
          noteText: canned.noteText,
          trapText: canned.trapText,
          tokens: canned.tokens,
          regenCount: row.regenCount + 1,
        })
      })
    },
    /** Seed rows; seed phase, through the repository (rule 3a). */
    seedRows: (rows: readonly MasterNote[]): void => {
      for (const r of rows) store.insert(r)
    },
    /**
     * Seed override `masterNotes: { flagged?: number[], approved?: number[] }` (E2E-M04-52): sets the
     * flags of the listed notes. Seed phase only; unknown ids and other shapes are `CONTRACT` errors.
     */
    applySeedOverride: (value: unknown): void => {
      if (value === undefined || value === null) return
      if (typeof value !== 'object' || Array.isArray(value)) contract('override must be an object')
      const v = value as { flagged?: unknown; approved?: unknown }
      for (const key of Object.keys(v)) {
        if (key !== 'flagged' && key !== 'approved') contract(`override: unknown key '${key}'`)
      }
      const ids = (list: unknown, key: string): number[] => {
        if (list === undefined) return []
        if (!Array.isArray(list)) contract(`override.${key} must be an array of note ids`)
        for (const id of list as unknown[]) {
          if (typeof id !== 'number' || !store.get(id))
            contract(`override.${key}: unknown note ${String(id)}`)
        }
        return list as number[]
      }
      for (const id of ids(v.flagged, 'flagged')) store.update(id, { flagged: true })
      for (const id of ids(v.approved, 'approved')) store.update(id, { teacherApproved: true })
    },
  }),
})
