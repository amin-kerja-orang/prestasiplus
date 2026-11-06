/**
 * The `diagramReviews` repository (owner M04; S6-T18): one row per teacher diagram upload that awaits
 * review. It is a db-registered table, so `db.reset()` clears it. The mock models no stimulus groups,
 * so a row marks only its own question.
 */

import { defineTable, maxPlusOne } from '@/mock/define'
import { defineRepository } from '@/mock/repository'

export interface DiagramReview {
  id: number
  kind: 'mcq' | 'structured'
  questionId: number
}

export const diagramReviewsTable = defineTable<DiagramReview>({
  name: 'questionDiagramReviews',
  ids: maxPlusOne(),
  indexes: ['questionId'],
})

export const diagramReviewsRepo = defineRepository({
  name: 'diagramReviews',
  owner: 'M04',
  store: diagramReviewsTable,
  methods: ({ store, transaction }) => ({
    isPending: (kind: DiagramReview['kind'], questionId: number): boolean =>
      store.count({ kind, questionId }) > 0,
    /** Records an open upload; `false` when one is already open for the question. */
    open: (kind: DiagramReview['kind'], questionId: number): boolean =>
      transaction(() => {
        if (store.count({ kind, questionId }) > 0) return false
        store.insert({ kind, questionId })
        return true
      }),
  }),
})
