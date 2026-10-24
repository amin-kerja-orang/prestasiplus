/**
 * The `audioKbat` and `support` repositories (owner M09; SRS M09 v1.2 §6.4, §6.8, §6.9, §6.11,
 * BR-M09-15, BR-M09-30). Audio KBAT has no live set (0), so the store is empty at the seed; the
 * provisional fixture `seedAudioKbatSet()` (§6.9, §6.10) builds the two scenario sets on demand.
 */

import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'

import {
  audioKbatAttemptsTable,
  audioKbatSetsTable,
  screenshotsTable,
  supportConfigTable,
} from '../tables/tables'
import type {
  AudioKbatAttemptRow,
  AudioKbatQuestion,
  AudioKbatSection,
  AudioKbatSetRow,
  AudioKbatStatus,
  ScreenshotRow,
  SupportConfigRow,
} from '../types'
import { M09Error, nowIso, norm } from './common'

/** BR-M09-15: the fixed section ranges. */
export const SECTION_RANGES: readonly (readonly [number, number])[] = [
  [1, 8],
  [9, 16],
  [17, 24],
  [25, 30],
]

export const QUESTION_COUNT = 30

export const audioQueries = defineNamedQueries(audioKbatSetsTable, {
  'Q-AUDIO-ALL': { where: {}, expected: 0, source: 'M09 §6.11 (S12 "0/0/0/0")' },
  'Q-AUDIO-APPROVED': {
    where: { status: 'approved' },
    expected: 0,
    source: 'M09 §6.11',
  },
  'Q-AUDIO-DRAFT': {
    where: { status: 'draft' },
    expected: 0,
    source: 'M09 §6.11',
  },
  'Q-AUDIO-PENDING': {
    where: { status: 'pending_review' },
    expected: 0,
    source: 'M09 §6.11',
  },
})

export interface AudioFilter {
  educationLevelId?: number
  subjectId?: number
  status?: AudioKbatStatus
  search?: string
}

export interface AudioSetInput {
  title: string
  educationLevelId: number
  subjectId: number
  status?: AudioKbatStatus
  sourceLabel?: string | null
  instructions?: string | null
  sections: AudioKbatSection[]
  questions: AudioKbatQuestion[]
}

/** §6.9 fixture body: 4 sections "Audio n" (`audion.mp3`) and 30 questions "Soalan contoh n". */
export function fixtureAudioSet(
  variant: 1 | 2,
): Omit<AudioSetInput, 'status'> & { status: AudioKbatStatus } {
  const sections = SECTION_RANGES.map(([from, to], i) => ({
    no: i + 1,
    title: `Audio ${String(i + 1)}`,
    audioFileName: `audio${String(i + 1)}.mp3`,
    transcript: null,
    questionFrom: from,
    questionTo: to,
  }))
  const questions = Array.from({ length: QUESTION_COUNT }, (_, i) => {
    const n = i + 1
    return {
      no: n,
      questionText: `Soalan contoh ${String(n)}`,
      optionA: `Pilihan A ${String(n)}`,
      optionB: `Pilihan B ${String(n)}`,
      optionC: `Pilihan C ${String(n)}`,
      optionD: `Pilihan D ${String(n)}`,
      correctAnswer: 'A' as const,
      marks: 1,
      kbatLevel: 3,
      dskpSpId: null,
      explanation: null,
    }
  })
  return variant === 1
    ? {
        title: 'BM T4 Ujian Mendengar Set 1',
        educationLevelId: 10,
        subjectId: 1,
        status: 'approved',
        sourceLabel: 'Cikgu Demo 02',
        instructions: null,
        sections,
        questions,
      }
    : {
        title: 'BI T5 Ujian Mendengar Set 1',
        educationLevelId: 11,
        subjectId: 2,
        status: 'draft',
        sourceLabel: 'Cikgu Demo 02',
        instructions: null,
        sections,
        questions,
      }
}

export const audioKbatRepo = defineRepository({
  owner: 'M09',
  name: 'audioKbat',
  store: audioKbatSetsTable,
  stores: { attempts: audioKbatAttemptsTable },
  queries: audioQueries,
  methods: ({ store, stores, transaction }) => {
    const matching = (f: AudioFilter): AudioKbatSetRow[] => {
      const term = norm(f.search ?? '')
      return store.query({
        where: {
          ...(f.educationLevelId !== undefined ? { educationLevelId: f.educationLevelId } : {}),
          ...(f.subjectId !== undefined ? { subjectId: f.subjectId } : {}),
          ...(f.status ? { status: f.status } : {}),
        },
        ...(term === ''
          ? {}
          : {
              match: (s: AudioKbatSetRow) =>
                s.title.toLowerCase().includes(term) ||
                (s.sourceLabel ?? '').toLowerCase().includes(term),
            }),
        sort: [{ field: 'id', dir: 'desc' }],
      }).rows
    }
    const insertSet = (createdById: number, input: AudioSetInput): AudioKbatSetRow =>
      transaction(() => {
        const now = nowIso()
        return store.insert({
          title: input.title,
          educationLevelId: input.educationLevelId,
          subjectId: input.subjectId,
          status: input.status ?? 'approved',
          sourceLabel: input.sourceLabel ?? null,
          instructions: input.instructions ?? null,
          sections: input.sections,
          questions: input.questions,
          createdById,
          createdAt: now,
          updatedAt: now,
        })
      })
    return {
      get(id: number): AudioKbatSetRow | undefined {
        return store.get(id)
      },

      /** S12 list (filters AND). */
      adminList(filter: AudioFilter = {}): AudioKbatSetRow[] {
        return matching(filter)
      },

      /** S12 stat cards: Set, Approved, Draf/Menunggu, Soalan = 30 × sets (BR-M09-15). */
      stats(): { sets: number; approved: number; draftOrPending: number; questions: number } {
        const all = store.query().rows
        return {
          sets: all.length,
          approved: all.filter((s) => s.status === 'approved').length,
          draftOrPending: all.filter((s) => s.status === 'draft' || s.status === 'pending_review')
            .length,
          questions: all.reduce((sum, s) => sum + s.questions.length, 0),
        }
      },

      /** S21: approved sets for a level and subject. */
      approved(filter: { educationLevelId?: number; subjectId?: number } = {}): AudioKbatSetRow[] {
        return matching({ ...filter, status: 'approved' })
      },

      /** Create (default status `approved`, BR-M09-15); the shape must be 4 sections and 30 questions. */
      create(createdById: number, input: AudioSetInput): AudioKbatSetRow {
        if (input.sections.length !== 4 || input.questions.length !== QUESTION_COUNT) {
          throw new M09Error('VALIDATION_ERROR', 'Set mesti mempunyai 4 bahagian dan 30 soalan.')
        }
        return insertSet(createdById, input)
      },

      /**
       * BR-M09-16 (provisional): one attempt row per submit; score = sum of the marks of the correct
       * answers, total = sum of the marks of all questions. Only an `approved` set can be attempted.
       */
      attempt(
        setId: number,
        userId: number,
        answers: AudioKbatAttemptRow['answers'],
      ): AudioKbatAttemptRow {
        const set = store.get(setId)
        if (set?.status !== 'approved') {
          throw new M09Error('NOT_FOUND', `Set Audio KBAT ${String(setId)} tidak dijumpai.`)
        }
        const chosen = new Map(answers.map((a) => [a.no, a.choice]))
        const totalMarks = set.questions.reduce((sum, q) => sum + q.marks, 0)
        const score = set.questions.reduce(
          (sum, q) => (chosen.get(q.no) === q.correctAnswer ? sum + q.marks : sum),
          0,
        )
        return transaction(() =>
          stores.attempts.insert({
            setId,
            userId,
            answers: answers.map((a) => ({ no: a.no, choice: a.choice })),
            score,
            totalMarks,
            submittedAt: nowIso(),
          }),
        )
      },

      /** The stored attempts of a set (newest first). */
      attempts(setId: number): AudioKbatAttemptRow[] {
        return stores.attempts.query({ where: { setId }, sort: [{ field: 'id', dir: 'desc' }] })
          .rows
      },

      /** Fixture `seedAudioKbatSet()` (§6.10, E2E-42/46 only): variant 1 approved, 2 draft. */
      seedFixture(createdById: number, variant: 1 | 2): AudioKbatSetRow {
        return insertSet(createdById, fixtureAudioSet(variant))
      },
    }
  },
})

const SCREENSHOT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
const SCREENSHOT_MAX_BYTES = 10 * 1024 * 1024

export const MAX_FILE_NAME_LENGTH = 120

/**
 * BR-M09-30: lower case, spaces to "-", characters outside `a-z 0-9 . _ -` removed, leading dots
 * stripped (no hidden or relative names), length capped at 120 (INFERRED hardening, the extension
 * is kept). May return an empty string or only dots: callers apply their own fallback.
 */
export function sanitiseFileName(name: string): string {
  const clean = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^\.+/, '')
  if (clean.length <= MAX_FILE_NAME_LENGTH) return clean
  const dot = clean.lastIndexOf('.')
  const ext = dot > 0 && clean.length - dot <= 10 ? clean.slice(dot) : ''
  return clean.slice(0, MAX_FILE_NAME_LENGTH - ext.length) + ext
}

const MIME_EXT: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
}

export const supportRepo = defineRepository({
  owner: 'M09',
  name: 'support',
  store: supportConfigTable,
  stores: { screenshots: screenshotsTable },
  methods: ({ store, stores, transaction }) => ({
    seed(config: SupportConfigRow): void {
      transaction(() => {
        store.insert({ ...config })
      })
    },

    /** S26/S27: the support e-mail and WhatsApp number. */
    config(): { email: string; whatsappNumber: string } {
      const row = store.get(1)
      if (!row) throw new M09Error('NOT_FOUND', 'Konfigurasi sokongan tidak dijumpai.')
      return { email: row.email, whatsappNumber: row.whatsappNumber }
    },

    /** DV-M09-14 / `mock.config('supportWhatsappNumber', value)`: the owner replaces the number. */
    setWhatsappNumber(value: string): void {
      transaction(() => {
        store.update(1, { whatsappNumber: value })
      })
    },

    /** S14 "Jumlah" (Q-SHOT-COUNT). */
    screenshotCount(): number {
      return stores.screenshots.count()
    },

    screenshots(): ScreenshotRow[] {
      return stores.screenshots.query({ sort: [{ field: 'id', dir: 'desc' }] }).rows
    },

    /** BR-M09-30: image types ≤ 10 MB, sanitised name, a taken name gets "-1", "-2"…. */
    addScreenshot(
      uploadedById: number,
      file: { name: string; size: number; mime: string },
    ): ScreenshotRow {
      if (!SCREENSHOT_TYPES.includes(file.mime) || file.size > SCREENSHOT_MAX_BYTES) {
        throw new M09Error(
          'VALIDATION_ERROR',
          'Fail mesti JPG, PNG, GIF, WebP atau BMP, maksimum 10 MB.',
        )
      }
      return transaction(() => {
        let clean = sanitiseFileName(file.name)
        // Nothing usable left (e.g. "..." or only symbols): screenshot-{n}.{ext} (INFERRED).
        // The stem is checked on the raw name: `sanitiseFileName` strips leading dots (M-2), so
        // "$$$.png" arrives here as "png", which has no stem left either.
        const stem = file.name
          .replace(/\.[^.]*$/, '')
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '')
        if (clean === '' || stem === '') {
          clean = `screenshot-${String(stores.screenshots.count() + 1)}.${MIME_EXT[file.mime] ?? 'png'}`
        }
        const dot = clean.lastIndexOf('.')
        const base = dot > 0 ? clean.slice(0, dot) : clean
        const ext = dot > 0 ? clean.slice(dot) : ''
        const taken = new Set(stores.screenshots.query().rows.map((s) => s.fileName))
        let fileName = clean
        for (let n = 1; taken.has(fileName); n++) fileName = `${base}-${String(n)}${ext}`
        return stores.screenshots.insert({
          fileName,
          originalName: file.name,
          size: file.size,
          mimeType: file.mime,
          uploadedById,
          createdAt: nowIso(),
        })
      })
    },
  }),
})
