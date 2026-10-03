/**
 * Copy, labels and small pure rules of S2 Command Center (SRS M10 v1.19 §8 / §10; URS FN-M10-2.2.1-2.2.14).
 * Exact BM strings of the live script; strings marked PROPOSED are not observed on live.
 */

import { formatNumber } from '@/lib/number'

import type {
  CcDrillType,
  CcEngagementBand,
  CcEvaluationRisk,
  CcLiveData,
  CcMoodName,
  CcRisk,
} from '../../api/command-center-types'

export const S2_BASE = '/guru/command-center'

export const S2_COPY = {
  back: '← Dashboard',
  title: 'Command Center',
  live: 'LIVE',
  tz: 'MYT',
  footer: 'Powered by ALESA AI · PrestasiPlus © 2026 · Data dikemaskini setiap 10 saat',
  noData: 'Tiada data',
  noActivity: 'Tiada aktiviti terkini',
  noWeek: 'Tiada data minggu ini',
  sameWeek: 'Sama dengan minggu lepas',
  loadingTitle: 'Memuatkan...',
  loadingBody: 'Memuatkan data...',
  classHint: 'Klik: lihat pelajar dalam kelas',
  bandHint: 'Klik: senarai pelajar',
} as const

export const TAB_TITLE = (name: string) => `Command Center — Guru: ${name}`

/** The modals opened from the top bar (FN-M10-2.2.1). */
export type NavAction = 'remedial' | 'evaluate' | 'predictive' | 'kelas' | 'badges'

/** The six top-bar links in live order; `rekod` is a real link, the rest open a modal. */
export const NAV_LINKS: readonly { id: NavAction | 'rekod'; label: string; tone: string }[] = [
  {
    id: 'remedial',
    label: '🔬 Remedial',
    tone: 'border-rose-400/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25',
  },
  {
    id: 'rekod',
    label: '📊 Rekod',
    tone: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25',
  },
  {
    id: 'evaluate',
    label: '⚠ Evaluate',
    tone: 'border-amber-400/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25',
  },
  {
    id: 'predictive',
    label: '🔮 Ramalan SPM',
    tone: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25',
  },
  {
    id: 'kelas',
    label: '👩‍🏫 Kelas',
    tone: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25',
  },
  {
    id: 'badges',
    label: '🏆 Badges',
    tone: 'border-amber-400/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25',
  },
]
export const REKOD_PATH = '/guru/remedial-progress'

export const MOODS: readonly { key: CcMoodName; emoji: string; label: string }[] = [
  { key: 'happy', emoji: '😊', label: 'Gembira' },
  { key: 'okay', emoji: '😐', label: 'OK' },
  { key: 'sad', emoji: '😢', label: 'Sedih' },
  { key: 'stressed', emoji: '😩', label: 'Tekanan' },
]

export const BANDS: readonly { key: CcEngagementBand; label: string; bar: string }[] = [
  { key: 'champion', label: 'Champion', bar: 'bg-emerald-500' },
  { key: 'consistent', label: 'Konsisten', bar: 'bg-cyan-500' },
  { key: 'developing', label: 'Berkembang', bar: 'bg-amber-500' },
  { key: 'minimum', label: 'Minimum', bar: 'bg-orange-500' },
  { key: 'disengaged', label: 'Disengaged', bar: 'bg-rose-500' },
]

export const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G'] as const

/** The initial values of the page before the first poll answers (the live initial HTML). */
export const EMPTY_LIVE: CcLiveData = {
  teacherName: '',
  totalStudents: '0',
  totalStudentsRaw: 0,
  activeStudents: '0',
  activeStudentsRaw: 0,
  totalAnswered: '0',
  totalAnsweredRaw: 0,
  answeredToday: '0',
  answeredTodayRaw: 0,
  answeredWeek: '0',
  answeredWeekRaw: 0,
  weekChange: 0,
  accuracy: 0,
  gpsOverall: null,
  classes: [],
  topStudents: [],
  leaderboardWeek: [],
  recentBadges: [],
  engagement: { champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 },
  recentFeed: [],
  kirkT1: 0,
  kirkT1Count: 0,
  kirkT2Accuracy: 0,
  kirkT2Delta: 0,
  kirkT2Prev: 0,
  kirkT3Active: 0,
  kirkT3Delta: 0,
  kirkT3Prev: 0,
  kirkT4Gps: 0,
  mood: { happy: 0, okay: 0, sad: 0, stressed: 0 },
  generatedAt: '',
}

/** GPS shown with 2 decimals; `null` shows "--" (FN-M10-2.2.3). */
export const gpsText = (gps: number | null): string => (gps === null ? '--' : gps.toFixed(2))

/** A number without a forced fraction ("0", "46", "7.5"). */
export const plain = (value: number, decimals = 1): string =>
  formatNumber(value, { decimals, dropZeroFraction: true, grouping: false })

/** FN-M10-2.2.4: stars = round(t1 / 10 * 5). */
export function stars(t1: number): string {
  const n = Math.max(0, Math.min(5, Math.round((t1 / 10) * 5)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

/** FN-M10-2.2.4 insight: r = (champion + konsisten + berkembang) / total x 100, 1 decimal; 0 without students. */
export function insightText(d: CcLiveData): string {
  const e = d.engagement
  const total = e.champion + e.consistent + e.developing + e.minimum + e.disengaged
  const active = total === 0 ? 0 : ((e.champion + e.consistent + e.developing) / total) * 100
  return `"${plain(active)}% pelajar terlibat aktif. Ketepatan purata ${String(d.accuracy)}%. GPS sekolah: ${gpsText(d.gpsOverall)}."`
}

/** FN-M10-2.2.5: width (percent) of the "Aktiviti Hari Ini" bar. */
export function activityWidth(today: number, week: number): number {
  const base = Math.max(today, week / 5, 100)
  return Math.min((today / base) * 100, 100)
}

/** FN-M10-2.2.5: the week-change text and its colour. */
export function weekChangeText(change: number): { text: string; tone: string } {
  if (change === 0) return { text: S2_COPY.sameWeek, tone: 'text-slate-400' }
  if (change > 0) return { text: `▲ +${String(change)}% vs minggu lepas`, tone: 'text-emerald-400' }
  return { text: `▼ ${String(Math.abs(change))}% vs minggu lepas`, tone: 'text-rose-400' }
}

/** FN-M10-2.2.5 / 2.2.7: accuracy >= 70 emerald, < 50 rose, else amber. */
export function accuracyTone(value: number): string {
  if (value >= 70) return 'text-emerald-400'
  if (value < 50) return 'text-rose-400'
  return 'text-amber-400'
}

/** FN-M10-2.2.7: GPS <= 2 emerald, <= 3 amber, else rose. */
export function gpsTone(gps: number): string {
  if (gps <= 2) return 'text-emerald-400'
  if (gps <= 3) return 'text-amber-400'
  return 'text-rose-400'
}

/** FN-M10-2.2.13: Common >= 20, Uncommon >= 10, Rare >= 5, Epic >= 1, Legendary 0 holders. */
export function rarityOf(holders: number): { label: string; tone: string } {
  if (holders >= 20) return { label: 'Common', tone: 'text-slate-300' }
  if (holders >= 10) return { label: 'Uncommon', tone: 'text-emerald-300' }
  if (holders >= 5) return { label: 'Rare', tone: 'text-sky-300' }
  if (holders >= 1) return { label: 'Epic', tone: 'text-violet-300' }
  return { label: 'Legendary', tone: 'text-amber-300' }
}

type AnyRisk = CcRisk | CcEvaluationRisk
const RISK: Record<AnyRisk, { label: string; tone: string }> = {
  kritikal: { label: 'KRITIKAL', tone: 'bg-rose-500/20 text-rose-300' },
  critical: { label: 'KRITIKAL', tone: 'bg-rose-500/20 text-rose-300' },
  tinggi: { label: 'TINGGI', tone: 'bg-orange-500/20 text-orange-300' },
  high: { label: 'TINGGI', tone: 'bg-orange-500/20 text-orange-300' },
  sederhana: { label: 'SEDERHANA', tone: 'bg-amber-500/20 text-amber-300' },
  medium: { label: 'SEDERHANA', tone: 'bg-amber-500/20 text-amber-300' },
  rendah: { label: 'RENDAH', tone: 'bg-emerald-500/20 text-emerald-300' },
}
export const riskTone = (risk: AnyRisk) => RISK[risk].tone
export const riskLabel = (risk: AnyRisk) => RISK[risk].label

/** The signed percent of a predictive trend ("+8%", "-3%", "0%"). */
export const signedPct = (value: number): string => `${value > 0 ? '+' : ''}${plain(value)}%`

/** Dark-table class strings (text never below 12 px, DV-M10-28). */
export const TBL = {
  wrap: 'overflow-x-auto',
  table: 'w-full min-w-max border-collapse text-left',
  th: 'px-2 py-2 text-xs font-semibold tracking-wider whitespace-nowrap text-slate-400 uppercase',
  td: 'px-2 py-2 align-middle text-sm text-slate-300',
  row: 'border-t border-slate-700/60',
  link: 'cursor-pointer hover:bg-slate-700/40',
} as const

/** FN-M10-2.2.14: the mounted M17 pages (new tab). */
export const studentPath = (id: number) => `${S2_BASE}/student/${String(id)}`
export const classPath = (id: number) => `${S2_BASE}/classroom/${String(id)}`
/** M05 Q4 remedial test page. */
export const remedialPath = (id: number) => `/remedial/${String(id)}`

/** What a tile or panel asks the page to drill (`label` is the DV-M10-04 title the modal falls back to). */
export interface DrillRequest {
  type: CcDrillType
  filter?: string
  label: string
}
