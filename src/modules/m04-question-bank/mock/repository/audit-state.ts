/**
 * The `qualityAudit` repository (owner M04; SRS §6.7 `lastAuditAt`, BR-M04-22): one row that
 * remembers when "Jalankan Audit Semula" last ran. INFERRED: there is no run before the first
 * audit, so `lastAuditAt` is `null` at seed.
 */

import { toIsoMyt } from '@/lib/time'
import { defineTable, maxPlusOne } from '@/mock/define'
import { defineRepository } from '@/mock/repository'

export interface QualityAuditState {
  id: number
  lastAuditAt: string | null
}

export const qualityAuditTable = defineTable<QualityAuditState>({
  name: 'questionQualityAudit',
  ids: maxPlusOne(),
})

const ROW_ID = 1

export const qualityAuditRepo = defineRepository({
  name: 'qualityAudit',
  owner: 'M04',
  store: qualityAuditTable,
  methods: ({ store, transaction }) => ({
    lastAuditAt: (): string | null => store.get(ROW_ID)?.lastAuditAt ?? null,
    /** Records an audit run at `now` (epoch ms); returns the ISO timestamp. */
    record: (now: number): string =>
      transaction(() => {
        const at = toIsoMyt(now)
        if (store.get(ROW_ID)) store.update(ROW_ID, { lastAuditAt: at })
        else store.insert({ id: ROW_ID, lastAuditAt: at })
        return at
      }),
  }),
})
