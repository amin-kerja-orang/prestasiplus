/**
 * Materialised M13 stores (SRS M13 v1.1 §6.8.1). Seed ids sit in 13101–13599; runtime ids start at
 * 9,000,001 (`floor`). Threads are keyed by their `thr-{n}` string and always inserted with the id.
 */

import { defineTable, floor, ID_RANGES, maxPlusOne, opaque } from '@/mock/define'

import type { EssayMarking, Rph } from '../../api/types'
import type { ChatMessage, ChatThread, PbdTag, TestStateRow } from '../repository/types'

const RUNTIME = ID_RANGES.questionsRuntimeFloor

export const threadsTable = defineTable<ChatThread>({
  name: 'cikgu.threads',
  ids: opaque('thr-', 'm13:thread-keys', 12),
  indexes: ['userId'],
})

export const messagesTable = defineTable<ChatMessage>({
  name: 'cikgu.messages',
  ids: floor({ start: RUNTIME }),
  indexes: ['threadId'],
})

export const rphsTable = defineTable<Rph>({
  name: 'cikgu.rphs',
  ids: floor({ start: RUNTIME }),
  indexes: ['userId'],
})

export const essaysTable = defineTable<EssayMarking>({
  name: 'cikgu.essays',
  ids: floor({ start: RUNTIME }),
  indexes: ['userId'],
})

export const pbdTagsTable = defineTable<PbdTag>({
  name: 'cikgu.pbdTags',
  ids: floor({ start: RUNTIME }),
  indexes: ['userId', 'classroomId', 'status'],
})

export const testStateTable = defineTable<TestStateRow>({
  name: 'cikgu.testState',
  ids: maxPlusOne(),
  indexes: ['kind', 'userId'],
})

export const M13_TABLES = {
  threads: threadsTable,
  messages: messagesTable,
  rphs: rphsTable,
  essays: essaysTable,
  pbdTags: pbdTagsTable,
  testState: testStateTable,
}
