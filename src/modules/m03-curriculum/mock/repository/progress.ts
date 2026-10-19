/**
 * Topic progress port (SRS v1.8 BR-19, DATA-M03-07; overview §6.8). M03 stores no progress: it is
 * derived on read from the M05 answer log (DATA-M05-02, owner M05 per D12).
 *
 * The answer log belongs to M05, which is built after this store (F-26), and M05 depends on M03, so
 * M03 does not import it statically. Instead M03 reads it through this port. Until it is connected,
 * the reader is empty and every topic reports the no-history state (0 everywhere), as the build
 * plan requires for F-24.
 *
 * Wiring (M03-T1a, after F-26), inside M03's own mock code:
 *
 * ```ts
 * import { practice } from '@/modules/m05-practice/mock'
 * connectAnswerLog({ answersFor: (userId, chapterId) => practice.answers(userId, { chapterId }) })
 * ```
 *
 * This module is private to M03 (`mock/repository` is off limits to other modules by lint).
 */

/** The fields of an M05 answer-log row BR-19 needs. */
export interface AnswerLogRow {
  isCorrect: boolean
  sessionId: string | number | null
}

export interface AnswerLogReader {
  /** The answer-log rows of `userId` whose question is linked to curriculum chapter `chapterId`. */
  answersFor(userId: number, chapterId: number): Iterable<AnswerLogRow>
}

/** The reader before M05 exists: no answers for anyone. */
export const EMPTY_ANSWER_LOG: AnswerLogReader = Object.freeze({
  answersFor: () => [],
})

let reader: AnswerLogReader = EMPTY_ANSWER_LOG

/** Connects the M05 answer log (M03-internal wiring). Returns the previous reader. */
export function connectAnswerLog(next: AnswerLogReader): AnswerLogReader {
  const prev = reader
  reader = next
  return prev
}

export function answerLog(): AnswerLogReader {
  return reader
}
