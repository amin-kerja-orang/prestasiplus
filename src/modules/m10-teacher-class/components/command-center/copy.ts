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
export const NAV_LINKS: readonly { id: NavAction | 'rekod'; label: string; icon: string }[] = [
  { id: 'remedial', label: 'Remedial', icon: 'i-ph-flask' },
  { id: 'rekod', label: 'Rekod', icon: 'i-ph-chart-bar' },
  { id: 'evaluate', label: 'Evaluate', icon: 'i-ph-warning' },
  { id: 'predictive', label: 'Ramalan SPM', icon: 'i-ph-crystal-ball' },
  { id: 'kelas', label: 'Kelas', icon: 'i-ph-chalkboard-teacher' },
  { id: 'badges', label: 'Badges', icon: 'i-ph-trophy' },
]
export const REKOD_PATH = '/guru/remedial-progress'

export const MOODS: readonly { key: CcMoodName; icon: string; label: string }[] = [
  { key: 'happy', icon: 'i-ph-smiley', label: 'Gembira' },
  { key: 'okay', icon: 'i-ph-smiley-meh', label: 'OK' },
  { key: 'sad', icon: 'i-ph-smiley-sad', label: 'Sedih' },
  { key: 'stressed', icon: 'i-ph-smiley-nervous', label: 'Tekanan' },
]

/** Colour of a `UProgress` bar. */
export type BarColor = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'

export const BANDS: readonly { key: CcEngagementBand; label: string; bar: BarColor }[] = [
  { key: 'champion', label: 'Champion', bar: 'success' },
  { key: 'consistent', label: 'Konsisten', bar: 'primary' },
  { key: 'developing', label: 'Berkembang', bar: 'info' },
  { key: 'minimum', label: 'Minimum', bar: 'warning' },
  { key: 'disengaged', label: 'Disengaged', bar: 'error' },
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
  if (change === 0) return { text: S2_COPY.sameWeek, tone: 'text-muted' }
  if (change > 0) return { text: `▲ +${String(change)}% vs minggu lepas`, tone: 'text-success' }
  return { text: `▼ ${String(Math.abs(change))}% vs minggu lepas`, tone: 'text-error' }
}

/** FN-M10-2.2.5 / 2.2.7: accuracy >= 70 emerald, < 50 rose, else amber. */
export function accuracyTone(value: number): string {
  if (value >= 70) return 'text-success'
  if (value < 50) return 'text-error'
  return 'text-warning'
}

/** FN-M10-2.2.7: GPS <= 2 emerald, <= 3 amber, else rose. */
export function gpsTone(gps: number): string {
  if (gps <= 2) return 'text-success'
  if (gps <= 3) return 'text-warning'
  return 'text-error'
}

/** FN-M10-2.2.13: Common >= 20, Uncommon >= 10, Rare >= 5, Epic >= 1, Legendary 0 holders. */
export function rarityOf(holders: number): { label: string; tone: string } {
  if (holders >= 20) return { label: 'Common', tone: 'text-muted' }
  if (holders >= 10) return { label: 'Uncommon', tone: 'text-success' }
  if (holders >= 5) return { label: 'Rare', tone: 'text-info' }
  if (holders >= 1) return { label: 'Epic', tone: 'text-primary' }
  return { label: 'Legendary', tone: 'text-warning' }
}

type AnyRisk = CcRisk | CcEvaluationRisk
export type RiskColor = 'error' | 'warning' | 'info' | 'success'
const RISK: Record<AnyRisk, { label: string; color: RiskColor }> = {
  kritikal: { label: 'KRITIKAL', color: 'error' },
  critical: { label: 'KRITIKAL', color: 'error' },
  tinggi: { label: 'TINGGI', color: 'warning' },
  high: { label: 'TINGGI', color: 'warning' },
  sederhana: { label: 'SEDERHANA', color: 'info' },
  medium: { label: 'SEDERHANA', color: 'info' },
  rendah: { label: 'RENDAH', color: 'success' },
}
export const riskColor = (risk: AnyRisk): RiskColor => RISK[risk].color
export const riskLabel = (risk: AnyRisk) => RISK[risk].label

/** The signed percent of a predictive trend ("+8%", "-3%", "0%"). */
export const signedPct = (value: number): string => `${value > 0 ? '+' : ''}${plain(value)}%`

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
