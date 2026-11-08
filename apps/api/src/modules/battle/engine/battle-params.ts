/**
 * Start / invite body of the battle routes (M16-02, M16-03, M16-08), validated at the boundary. Checks run in the order of
 * the mock (`parseBattleParams`): question type, then the type's own fields; an SPM request from a caller below
 * Tingkatan 4 is "forbidden" before its subject is looked at. The body is an unknown JSON value: only the fields named
 * here are read, everything else (points, scores, ...) is ignored.
 */
import { BATTLE_MESSAGES, BATTLE_QUESTION_COUNTS, BATTLE_RULES, BattleInviteRequestSchema, BattleStartRequestSchema, type BattleQuestionCount } from '@pp/contract'

import { isIdString } from '../../../db/ids'
import type { BattleDeps } from '../battle.deps'

export interface BattleParams {
  questionType: 'biasa' | 'pksk' | 'spm'
  subjectId: string | null
  pkskDomainId: string | null
  pkskTargetLevel: 'T1' | 'T4' | null
  openToAll: boolean
  /** The chip (5, 10, 15, 20): how many questions the battle draws (FR-GM-01.1). */
  questionCount: BattleQuestionCount
}

/** A refused body: `forbidden` is a 403 (SPM below Tingkatan 4, PKSK without a grant for the level), anything else a 422. */
export class ParamRefusal extends Error {
  constructor(
    readonly forbidden: boolean,
    message: string,
  ) {
    super(message)
  }
}

const asRecord = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {}

const idOf = (v: unknown): string | null => (typeof v === 'string' && isIdString(v) ? v : null)

const isQuestionCount = (v: unknown): v is BattleQuestionCount => BATTLE_QUESTION_COUNTS.some((n) => n === v)

/** `defaultCount` is `battle_questions_default`; it is used only when the body has no `question_count`. */
export async function parseBattleParams(body: unknown, callerGrade: number | null, deps: BattleDeps, who: { userId: string; role: string }, defaultCount: BattleQuestionCount, withReceiver = false): Promise<BattleParams> {
  const b = asRecord(body)
  const type = b.question_type
  const bad = (message: string): ParamRefusal => new ParamRefusal(false, message)
  if (type !== 'biasa' && type !== 'pksk' && type !== 'spm') throw bad(BATTLE_MESSAGES.typeInvalid)
  const openToAll = b.open_to_all === true
  const subject = idOf(b.subject_id)
  let params: Omit<BattleParams, 'questionCount'>
  if (type === 'biasa') {
    if (subject === null || (await deps.subject(subject)) === null) throw bad(BATTLE_MESSAGES.subjectInvalid)
    params = { questionType: type, subjectId: subject, pkskDomainId: null, pkskTargetLevel: null, openToAll }
  } else if (type === 'pksk') {
    const domain = idOf(b.pksk_domain_id)
    const level = b.pksk_target_level
    if (domain === null || !(await deps.pkskDomains()).some((d) => d.id === domain)) throw bad(BATTLE_MESSAGES.pkskDomainInvalid)
    if (level !== 'T1' && level !== 'T4') throw bad(BATTLE_MESSAGES.pkskLevelInvalid)
    if (!(await deps.pkskAccess(who))[level]) throw new ParamRefusal(true, BATTLE_MESSAGES.pkskNoAccess)
    params = { questionType: type, subjectId: null, pkskDomainId: domain, pkskTargetLevel: level, openToAll }
  } else {
    if (callerGrade === null || callerGrade < BATTLE_RULES.spmMinGrade) throw new ParamRefusal(true, BATTLE_MESSAGES.spmOnly)
    if (subject === null || (await deps.subject(subject)) === null || (await deps.spmPoolCount(subject)) === 0) throw bad(BATTLE_MESSAGES.subjectInvalid)
    params = { questionType: type, subjectId: subject, pkskDomainId: null, pkskTargetLevel: null, openToAll }
  }
  // FR-GM-01.1: absent is the default chip; anything that is not one of the four chips (a string, null, 7, an array) is refused.
  let questionCount = defaultCount
  if (Object.hasOwn(b, 'question_count')) {
    if (!isQuestionCount(b.question_count)) throw bad(BATTLE_MESSAGES.outOfRange)
    questionCount = b.question_count
  }
  // The contract schema is the final word on the shape (receiver_id is checked by the caller with its own message).
  const shape = { ...b, open_to_all: openToAll, ...(withReceiver ? { receiver_id: typeof b.receiver_id === 'string' && b.receiver_id !== '' ? b.receiver_id : '0' } : {}) }
  if (!(withReceiver ? BattleInviteRequestSchema : BattleStartRequestSchema).safeParse(shape).success) throw bad(BATTLE_MESSAGES.typeInvalid)
  return { ...params, questionCount }
}
