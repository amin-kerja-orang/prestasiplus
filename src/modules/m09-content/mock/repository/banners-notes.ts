/**
 * The `banners` and `notes` repositories (owner M09; SRS M09 v1.2 §6.2, §6.3, §6.11,
 * BR-M09-11/12/13/14, BR-M09-33).
 *
 * `banners.activeFor(user)` is the M05 dashboard carousel input (FR-M09-40, M05 §7 #1
 * `banners:[{type, title, body}]`; `description` is M05's `body`).
 */

import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'

import { bannersTable, notesTable } from '../tables/tables'
import type {
  ActiveBanner,
  BannerAudienceUser,
  BannerRow,
  NoteRow,
  NoteSubject,
  NoteType,
} from '../types'
import { M09Error, nowIso, norm, todayKey } from './common'

export const BANNER_SORT = [
  { field: 'displayOrder', dir: 'asc' },
  { field: 'id', dir: 'asc' },
] as const

export const bannerQueries = defineNamedQueries(bannersTable, {
  'Q-BANNER-ALL': { where: {}, expected: 5, source: 'M09 §6.11' },
  'Q-BANNER-TYPE': {
    where: (bannerType: string) => ({ bannerType }),
    expected: [
      { args: ['HERO'], value: 1 },
      { args: ['FEATURE'], value: 2 },
      { args: ['PROMOTIONAL'], value: 1 },
      { args: ['ANNOUNCEMENT'], value: 1 },
    ],
    source: 'M09 §6.11',
  },
  'Q-BANNER-AUDIENCE': {
    where: (targetAudience: string) => ({ targetAudience }),
    expected: [
      { args: ['ALL'], value: 2 },
      { args: ['STUDENT'], value: 3 },
    ],
    source: 'M09 §6.11',
  },
  'Q-BANNER-ACTIVE': { where: { isActive: true }, expected: 5, source: 'M09 §6.11' },
})

/** BR-M09-14: the user's role as an audience code. */
const AUDIENCE_OF_ROLE: Readonly<Record<string, string>> = {
  student: 'STUDENT',
  teacher: 'TEACHER',
  admin: 'ADMIN',
}

export type BannerInput = Omit<BannerRow, 'id' | 'createdAt' | 'updatedAt'>

export const bannersRepo = defineRepository({
  owner: 'M09',
  name: 'banners',
  store: bannersTable,
  queries: bannerQueries,
  methods: ({ store, transaction }) => {
    const mustGet = (id: number): BannerRow => {
      const row = store.get(id)
      if (!row) throw new M09Error('NOT_FOUND', `Banner ${String(id)} tidak dijumpai.`)
      return row
    }
    const upper = (input: BannerInput): BannerInput => ({
      ...input,
      bannerType: input.bannerType.toUpperCase(),
      linkType: input.linkType.toUpperCase(),
      targetAudience: input.targetAudience.toUpperCase(),
    })
    return {
      seed(rows: readonly BannerRow[]): void {
        transaction(() => {
          for (const row of rows) store.insert({ ...row })
        })
      },

      get(id: number): BannerRow | undefined {
        return store.get(id)
      },

      /** S9: all banners, `displayOrder` asc then id asc (BR-M09-12). */
      all(): BannerRow[] {
        return store.query({ sort: BANNER_SORT }).rows
      },

      /**
       * BR-M09-14: active, inside the date window (today, Asia/Kuala_Lumpur) and for the user's
       * audience (`ALL` or the mapped role; the admin receives every audience). Order BR-M09-12.
       */
      activeFor(user: BannerAudienceUser): ActiveBanner[] {
        const today = todayKey()
        const audience = AUDIENCE_OF_ROLE[user.role]
        return store
          .query({ where: { isActive: true }, sort: BANNER_SORT })
          .rows.filter(
            (b) =>
              (b.startDate === null || b.startDate <= today) &&
              (b.endDate === null || b.endDate >= today) &&
              (user.role === 'admin' ||
                b.targetAudience === 'ALL' ||
                (audience !== undefined && b.targetAudience === audience)),
          )
          .map((b) => ({ type: b.bannerType, title: b.title, description: b.description }))
      },

      create(input: BannerInput): BannerRow {
        return transaction(() => {
          const now = nowIso()
          return store.insert({ ...upper(input), createdAt: now, updatedAt: now })
        })
      },

      update(id: number, input: BannerInput): BannerRow {
        return transaction(() => {
          mustGet(id)
          return store.update(id, { ...upper(input), updatedAt: nowIso() })
        })
      },

      remove(id: number): void {
        transaction(() => {
          mustGet(id)
          store.remove(id)
        })
      },
    }
  },
})

/** FR-M09-42: the S5 list is ordered by id ascending (a new note is listed last). */
export const NOTE_SORT = [{ field: 'id', dir: 'asc' }] as const

export const noteQueries = defineNamedQueries(notesTable, {
  'Q-NOTE-ALL': { where: {}, expected: 10, source: 'M09 §6.11' },
  'Q-NOTE-SUBJECT': {
    where: (subject: NoteSubject) => ({ subject }),
    expected: [
      { args: ['matematik'], value: 3 },
      { args: ['sains'], value: 3 },
      { args: ['bahasa_melayu'], value: 2 },
      { args: ['bahasa_inggeris'], value: 2 },
    ],
    source: 'M09 §6.11',
  },
  'Q-NOTE-TYPE': {
    where: (noteType: NoteType) => ({ noteType }),
    expected: [
      { args: ['RINGKASAN'], value: 5 },
      { args: ['FORMULA'], value: 2 },
      { args: ['LENGKAP'], value: 2 },
      { args: ['TIPS_TRICKS'], value: 1 },
    ],
    source: 'M09 §6.11',
  },
})

/** BR-M09-11 `note_type` filter mapping (DV-M09-06). */
const NOTE_TYPE_FILTER: Readonly<Record<string, NoteType>> = {
  summary: 'RINGKASAN',
  full_notes: 'LENGKAP',
  mind_map: 'MIND_MAP',
  flashcard: 'FLASHCARD',
  cheat_sheet: 'CHEAT_SHEET',
}

export interface NoteFilter {
  search?: string
  /** `matematik`… or `all`/empty. */
  subject?: string
  /** `summary`, `full_notes`, `mind_map`, `flashcard`, `cheat_sheet` or `all`/empty. */
  noteType?: string
  page?: number
  pageSize?: number
}

/** The note form fields S6/S7 (DV-M09-01). */
export interface NoteInput {
  title: string
  summary: string | null
  content: string
  subject: NoteSubject
  noteType: NoteType
  grade: string
  isPublished: boolean
}

export const notesRepo = defineRepository({
  owner: 'M09',
  name: 'notes',
  store: notesTable,
  queries: noteQueries,
  methods: ({ store, transaction }) => ({
    /** S6 create: views and downloads start at 0 (BR-M09-33). */
    create(authorId: number, input: NoteInput): NoteRow {
      return transaction(() => {
        const now = nowIso()
        return store.insert({
          ...input,
          views: 0,
          downloads: 0,
          authorId,
          createdAt: now,
          updatedAt: now,
        })
      })
    },

    /** S7 update: the counters and the author are kept. */
    update(id: number, input: NoteInput): NoteRow {
      return transaction(() => {
        if (!store.get(id)) throw new M09Error('NOT_FOUND', `Nota ${String(id)} tidak dijumpai.`)
        return store.update(id, { ...input, updatedAt: nowIso() })
      })
    },

    /** S5 delete. */
    remove(id: number): void {
      transaction(() => {
        if (!store.get(id)) throw new M09Error('NOT_FOUND', `Nota ${String(id)} tidak dijumpai.`)
        store.remove(id)
      })
    },

    seed(rows: readonly NoteRow[]): void {
      transaction(() => {
        for (const row of rows) store.insert({ ...row })
      })
    },

    get(id: number): NoteRow | undefined {
      return store.get(id)
    },

    /** S5 list and its "Jumlah" (`total`). */
    adminList(filter: NoteFilter = {}): { rows: NoteRow[]; total: number } {
      const term = norm(filter.search ?? '')
      const type = filter.noteType ? NOTE_TYPE_FILTER[filter.noteType] : undefined
      return store.query({
        where: {
          ...(filter.subject && filter.subject !== 'all'
            ? { subject: filter.subject as NoteSubject }
            : {}),
          ...(type ? { noteType: type } : {}),
        },
        ...(term === '' ? {} : { match: (n: NoteRow) => n.title.toLowerCase().includes(term) }),
        sort: NOTE_SORT,
        page: filter.page ?? 1,
        pageSize: filter.pageSize ?? 20,
      })
    },
  }),
})
