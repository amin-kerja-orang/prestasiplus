/**
 * The `studentConsistency` repository (owner **M12**; SRS M12 v1.6 §6.4 DATA-M12-05, BR-M12-28): the S8
 * "Konsistensi" tile. Anchors 4664 -> 22.5 and 4644 -> 21.1 are stored (observed); every other value is generated
 * deterministically in 0-100 from the user id (`observed: false`).
 */

import { defineRepository } from '@/mock/repository'

import { consistencyTable } from '../tables/tables'

/** Deterministic Konsistensi (0-100, 1 decimal) of a student without a stored row (INFERRED). */
export function generatedKonsistensi(userId: number): number {
  const h = Math.imul(userId ^ 0x9e3779b9, 2654435761) >>> 0
  return (h % 1001) / 10
}

export const consistencyRepo = defineRepository({
  owner: 'M12',
  name: 'studentConsistency',
  store: consistencyTable,
  methods: ({ store, transaction }) => ({
    /** Seed: the observed anchors `[userId, konsistensi]`. */
    seed(rows: readonly (readonly [number, number])[]): void {
      transaction(() => {
        for (const [id, konsistensi] of rows) store.insert({ id, konsistensi, observed: true })
      })
    },

    /** The stored value of the user, else the generated one. */
    konsistensiOf(userId: number): number {
      return store.get(userId)?.konsistensi ?? generatedKonsistensi(userId)
    },
  }),
})
