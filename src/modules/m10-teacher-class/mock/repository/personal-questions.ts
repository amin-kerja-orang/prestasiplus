/**
 * The `personalQuestions` repository (Soalan & Rujukan, S6-T16; PRD-20 R1-GUR-44a, PRD-60 API-GUR-24, PRD-50 DM-42).
 * A teacher's private MCQ with an optional reference link. Reads are always per owner, so a private question never
 * reaches another teacher, the bank or any count (FR-GUR-44a-4): nothing here is connected to the M04 question store.
 */

import { defineRepository } from '@/mock/repository'

import { personalQuestionsTable } from '../tables/tables'
import type { PersonalQuestionRow } from './types'

export type PersonalQuestionInput = Omit<
  PersonalQuestionRow,
  'id' | 'createdAt' | 'inActiveMission'
>

export const personalQuestionsRepo = defineRepository({
  owner: 'M10',
  name: 'personalQuestions',
  store: personalQuestionsTable,
  methods: ({ store, transaction }) => ({
    /** Seed phase (finalise): the designed questions of `seeds/personal-questions.ts`. */
    seed(rows: readonly PersonalQuestionRow[]): void {
      transaction(() => {
        for (const r of rows) {
          store.insert({ ...r, spIds: [...r.spIds], options: [...r.options] })
        }
      })
    },

    /** The owner's question, or `undefined` for another teacher's or an unknown id (404 either way). */
    getOwn(ownerId: number, id: number): PersonalQuestionRow | undefined {
      const row = store.get(id)
      return row && row.ownerId === ownerId ? row : undefined
    },

    /** The owner's questions, newest first; `educationLevelId` filters the Tahap. */
    forOwner(ownerId: number, educationLevelId?: number): PersonalQuestionRow[] {
      return store
        .query({
          where: { ownerId },
          match: (q) => educationLevelId === undefined || q.educationLevelId === educationLevelId,
        })
        .rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    },

    create(input: PersonalQuestionInput, now: string): PersonalQuestionRow {
      return transaction(() =>
        store.insert({
          ...input,
          spIds: [...input.spIds],
          options: [...input.options],
          inActiveMission: false,
          createdAt: now,
        }),
      )
    },

    update(id: number, input: PersonalQuestionInput): PersonalQuestionRow {
      return transaction(() =>
        store.update(id, { ...input, spIds: [...input.spIds], options: [...input.options] }),
      )
    },

    remove(id: number): void {
      transaction(() => {
        store.remove(id)
      })
    },
  }),
})
