import { POC_BANK } from './poc-bank'
import type { PocPart, PocQuestion } from './types'

export { POC_BANK } from './poc-bank'
export type * from './types'

/**
 * Reserved question id block of the PoC questions. The PoC placements reference the questions by
 * these ids, so the papers can be seeded before the question bank (BE-09) holds the questions. A
 * question loader must insert the PoC questions with exactly these ids (`OVERRIDING SYSTEM VALUE`
 * on the identity column). The block is far above any identity value the bank reaches.
 */
export const POC_QUESTION_ID_BASE = 9_000_000_000n

/** Question keys of the prototype in export order; the position gives the reserved id. */
export const POC_QUESTION_KEYS: readonly string[] = POC_BANK.questions.map((q) => q.id)

const ID_BY_KEY = new Map<string, bigint>(POC_QUESTION_KEYS.map((key, i) => [key, POC_QUESTION_ID_BASE + BigInt(i + 1)]))
const KEY_BY_ID = new Map<string, string>([...ID_BY_KEY].map(([key, id]) => [id.toString(), key]))

export function pocQuestionId(key: string): bigint {
  const id = ID_BY_KEY.get(key)
  if (id === undefined) throw new Error(`PoC question "${key}" is not in the export`)
  return id
}

export const pocQuestionKey = (id: string): string | undefined => KEY_BY_ID.get(id)

const leafMarks = (parts: readonly PocPart[]): number =>
  parts.reduce((n, p) => n + (p.children?.length ? leafMarks(p.children) : p.marks), 0)

/** Marks of a PoC question: an MCQ carries its marks on its scheme (default 1), a structured one sums its leaves. */
export function pocQuestionMarks(q: PocQuestion): number {
  if (q.mcq) return POC_BANK.schemes.find((s) => s.id === q.id)?.scheme.marks ?? 1
  return leafMarks(q.parts ?? [])
}
