/**
 * The six lane cards of the V2 hub "Kandungan SPM", in V2 order, with the V2 names and descriptions verbatim
 * (docs/discovery/cloud-student-mechanism.md line 324; AC-R1-21.1). `inR1` lanes have a screen here; the others are R2
 * (D86: "lain2 features KIV") or flag OFF (D80 item 2, Kertas Subjektif) and show with NO link to a missing screen.
 */
import type { ServabilityActivity } from '@pp/contract'

export type LaneKey = 'databank' | 'tracking-a' | 'subjektif' | 'simulasi' | 'kertas' | 'latih-tubi'

export interface LaneCard {
  key: LaneKey
  name: string
  desc: string
  /** The overview activity whose attention count the card shows (null = no servability data for this lane yet). */
  activity: ServabilityActivity | null
  /** A screen exists in R1. */
  inR1: boolean
  /** V2 "Flag OFF" badge (the lane is switched off in V2). */
  flagOff?: boolean
}

export const LANE_CARDS: readonly LaneCard[] = [
  { key: 'databank', name: 'Databank Soalan', desc: 'Bank soalan objektif SPM mengikut subjek.', activity: 'databank', inR1: true },
  { key: 'tracking-a', name: 'Tracking A', desc: 'Set objektif penuh dan lane bahasa.', activity: null, inR1: false },
  { key: 'subjektif', name: 'Subjektif', desc: 'Soalan berstruktur dan esei.', activity: null, inR1: false },
  { key: 'simulasi', name: 'Bijak SPM', desc: 'Kertas SPM penuh dalam format sebenar.', activity: 'simulasi_paper', inR1: true },
  { key: 'kertas', name: 'Kertas Subjektif', desc: 'Kertas 2, 3 & 4 percubaan negeri.', activity: null, inR1: false, flagOff: true },
  { key: 'latih-tubi', name: 'Latih Tubi', desc: 'Latihan ikut topik dan bab.', activity: 'latih_tubi_spm', inR1: false },
]

/** V2 strings of the hub (DISC 3.10 P1/A1). */
export const hubCopy = {
  title: 'Kandungan SPM',
  intro: 'Setiap kad ialah satu laluan yang pelajar boleh buka. Nombor merah menunjukkan berapa banyak item yang perlu diperiksa.',
  allGood: 'Semua elok',
  open: 'Buka senarai',
  flagOff: 'Flag OFF',
  /** [PROPOSED] UX-20: the card of a lane whose screen is not in R1 has no button. */
  notYet: 'Belum tersedia',
  /** [PROPOSED] UX-21: the word after the count; D94 reasons are the servability copy, not the V2 phrases (H2). */
  attention: 'perlu perhatian',
} as const

/** V2 strings of a lane list (DISC 3.10 P2/A2). */
export const laneCopy = {
  title: 'Kandungan SPM',
  back: 'Kembali',
  allSubjects: 'Semua Subjek',
  allStatuses: 'Semua Status',
  search: 'Cari',
  apply: 'Tapis',
  reset: 'Set Semula',
  colList: 'Senarai',
  colTitle: 'Tajuk',
  colStatus: 'Status',
  colAttention: 'Perhatian',
  colActions: 'Tindakan',
  preview: 'Pratonton',
  copy: 'Salin',
  edit: 'Sunting',
  /** V2 (A2/P2): the attention text of a published paper. Kept for the zero-question case. */
  noQuestions: 'Disajikan tetapi tiada soalan',
  empty: 'Tiada rekod dijumpai.',
} as const
