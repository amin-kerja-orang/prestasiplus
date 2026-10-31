/**
 * DATA-M13-06 CikguSettings (SRS M13 v1.1 §6.7): constants shared by the mock and the screens.
 * Rubrics, levels and the sub-line structure are OBSERVED; the rest is PROPOSED.
 */

export type RubricKey =
  | 'spm_bm_karangan'
  | 'spm_bi_continuous_writing'
  | 'pt3_bm_karangan'
  | 'pt3_bi_essay'
  | 'sejarah_essay'
  | 'general'

export interface Rubric {
  key: RubricKey
  label: string
  max: number
}

/** The six S5 options, in order (the first is the default). */
export const RUBRICS: readonly Rubric[] = [
  {
    key: 'spm_bm_karangan',
    label: 'SPM Bahasa Melayu — Karangan (Bahagian B) (50 markah)',
    max: 50,
  },
  {
    key: 'spm_bi_continuous_writing',
    label: 'SPM English — Continuous Writing (Section B) (50 markah)',
    max: 50,
  },
  { key: 'pt3_bm_karangan', label: 'PT3 Bahasa Melayu — Karangan (30 markah)', max: 30 },
  { key: 'pt3_bi_essay', label: 'PT3 English — Essay (30 markah)', max: 30 },
  { key: 'sejarah_essay', label: 'Sejarah — Karangan Esei (20 markah)', max: 20 },
  { key: 'general', label: 'Rubric Am (default) (100 markah)', max: 100 },
]

export type LevelCode = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5'

/** The S3 / S5 level options: code and label. */
export const LEVELS: readonly { code: LevelCode; label: string }[] = [
  { code: 'D1', label: 'Darjah 1' },
  { code: 'D2', label: 'Darjah 2' },
  { code: 'D3', label: 'Darjah 3' },
  { code: 'D4', label: 'Darjah 4' },
  { code: 'D5', label: 'Darjah 5' },
  { code: 'D6', label: 'Darjah 6' },
  { code: 'T1', label: 'Tingkatan 1' },
  { code: 'T2', label: 'Tingkatan 2' },
  { code: 'T3', label: 'Tingkatan 3' },
  { code: 'T4', label: 'Tingkatan 4' },
  { code: 'T5', label: 'Tingkatan 5' },
]

/** The levels the RPH form offers (v2: secondary only, Tingkatan 1-5). */
export const RPH_LEVELS = LEVELS.filter((l) => l.code.startsWith('T'))

export const LEVEL_CODES: readonly LevelCode[] = LEVELS.map((l) => l.code)

export function levelLabelOf(code: string): string {
  return LEVELS.find((l) => l.code === code)?.label ?? code
}

export type ChatTier = 'admin' | 'guru' | 'pelajar'

/** BR-M13-06 tiers and daily limits. */
export const TIERS = {
  admin: { tier: 'admin', dailyTurns: 100 },
  teacher: { tier: 'guru', dailyTurns: 30 },
  other: { tier: 'pelajar', dailyTurns: 10 },
} as const

/** BR-M13-15 SP labels (illustrative, not DSKP). */
export const SP_LABELS = { Kimia: '5.1.1', Sejarah: '1.1.1', default: '1.1.1' } as const

/** DV-M13-12: fictitious "Powered by" names. */
export const POWERED_BY: readonly string[] = [
  'Cikgu Nur Demo',
  'Cikgu Amin Demo',
  'Cikgu Siti Demo',
]

export const PAGE_SIZE = 20
/** BR-M13-22: default latency of #1 and #3. */
export const AI_LATENCY_MS = 1500

/** Greeting that opens S1 (FR-M13-14). */
export const GREETING =
  'Hai! Saya Cikgu Alesa. Apa nak belajar hari ni? Cuba tanya pasal subjek tertentu, atau minta latihan soalan.'

/** FR-M13-30: simulated speaker status text (PROPOSED COPY, OQ-M13-09). */
export const SPEAKING_STATUS = '🔊 Cikgu sedang bercakap…'

/** BR-M13-08 start of the hand-off message. */
export const HANDOFF_PREFIX = 'Tolong mark karangan ini menggunakan rubric '

export function rubricOf(key: string | null | undefined): Rubric {
  return RUBRICS.find((r) => r.key === key) ?? (RUBRICS[0] as Rubric)
}

/** BR-M13-08: the hand-off message S1 puts in the input. Empty parts are left out. */
export function buildHandoffMessage(input: {
  rubric?: string | null
  subject?: string | null
  level?: string | null
  student?: string | null
  title?: string | null
  essay: string
}): string {
  const part = (name: string, v: string | null | undefined): string => {
    const t = (v ?? '').trim()
    return t === '' ? '' : ` ${name}: ${t}.`
  }
  const essay = input.essay.replace(/[\r\n]+/g, ' ').trim()
  return (
    `${HANDOFF_PREFIX}${rubricOf(input.rubric).label}.` +
    part('Subjek', input.subject) +
    part('Level', input.level) +
    part('Pelajar', input.student) +
    part('Tajuk', input.title) +
    ` Karangan: ${essay}`
  )
}
