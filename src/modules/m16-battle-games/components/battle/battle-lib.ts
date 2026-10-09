/**
 * Pure helpers of the M16 battle screens S1-S5 (SRS M16 v1.6 §7.1, §8.1, BR-M16-37; M16-T3).
 */

import { clock } from '@/lib/time/clock'
import { diffForHumans } from '@/lib/time/relative'
import { toEpochMs, type DateInput } from '@/lib/time/zone'

import type { BattleStartBody, PkskLevel, QuestionType } from '../../api'

/** S3 state select (discovery A.4): "Semua Negeri" (empty value) + 16 states. */
export const BATTLE_STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Kuala Lumpur',
  'Labuan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Pulau Pinang',
  'Putrajaya',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
] as const

/** Exact messages of §7.1 / §8.1. */
export const BATTLE_MSG = {
  noOpponent: 'Tiada lawan dijumpai. Sila cuba lagi.',
  noOpponentTimeout: 'Tiada lawan dijumpai dalam masa 2 minit. Sila cuba lagi.',
  repeatedError: 'Ralat berulang semasa mencari lawan. Sila cuba lagi.',
  repeatedNetwork: 'Ralat rangkaian berulang. Sila semak internet anda.',
  noQueueId: 'Ralat sistem: ID giliran tidak sah. Sila cuba lagi.',
  startFallback: 'Ralat dari server. Sila cuba lagi.',
  unexpected: 'Respon tidak dijangka. Sila cuba lagi.',
  startNetwork: 'Ralat rangkaian. Sila semak internet anda.',
  challengerNetwork: 'Ralat rangkaian.',
  joinError: 'Ralat menghantar permohonan.',
  waitingNetwork: 'Ralat rangkaian. Sila cuba lagi.',
  leftQueue: 'Pemain sudah keluar dari barisan.',
  sendChallengeNetwork: 'Ralat menghantar cabaran.',
  acceptInviteNetwork: 'Ralat.',
  forfeitConfirm: 'Tamatkan battle ini? Anda akan dikira kalah.',
  forfeitNetwork: 'Ralat. Sila cuba lagi.',
} as const

export const rejectedMessage = (name: string): string => `${name} menolak permohonan anda.`
export const challengeSentMessage = (name: string): string =>
  `Cabaran berjaya dihantar kepada ${name}!`

/** Timer text `m:ss` of the searching card. */
export function formatMss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, '0')}`
}

/** BR-M16-37: under a minute "baru sahaja", else the Carbon-style text with the week step. */
export function battleRelativeTime(date: DateInput, now: DateInput = clock.now()): string {
  const diff = toEpochMs(now) - toEpochMs(date)
  if (diff >= 0 && diff < 60_000) return 'baru sahaja'
  return diffForHumans(date, now)
}

/** The "m/s/k" text (menang / seri / kalah). */
export function mskText(menang: number, seri: number, kalah: number): string {
  return `${String(menang)}/${String(seri)}/${String(kalah)}`
}

export interface BattleSelection {
  questionType: QuestionType
  openToAll: boolean
  subjectId: number | null
  pkskDomainId: number | null
  pkskLevel: PkskLevel | null
  spmSubjectId: number | null
}

/** FN-M16-2.1.6: `canStart` per question type. */
export function canStart(sel: BattleSelection): boolean {
  if (sel.questionType === 'biasa') return sel.subjectId !== null
  if (sel.questionType === 'pksk') return sel.pkskDomainId !== null && sel.pkskLevel !== null
  return sel.spmSubjectId !== null
}

/** BR-M16-03 request body of #2, #3 and #8. */
export function matchParams(sel: BattleSelection): BattleStartBody {
  if (sel.questionType === 'pksk') {
    return {
      question_type: 'pksk',
      open_to_all: sel.openToAll,
      pksk_domain_id: sel.pkskDomainId as number,
      pksk_target_level: sel.pkskLevel as PkskLevel,
    }
  }
  return {
    question_type: sel.questionType,
    open_to_all: sel.openToAll,
    subject_id: (sel.questionType === 'spm' ? sel.spmSubjectId : sel.subjectId) as number,
  }
}

/** Option letter of the arena (A-D). */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index)
}
