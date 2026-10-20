/**
 * Pure rules of Cikgu Alesa (M13): routing of a chat message, the hand-off parser, the RPH request parser, the RPH plan
 * text, CSV cells and the roll-up maths. No I/O, no clock, no store; ported from the frontend mock
 * (`src/modules/m13-cikgu-alesa/mock/repository/canned.ts`) and the shared contract constants (`@pp/contract`).
 */
import {
  CIKGU_CHAT_TOOLS,
  CIKGU_HANDOFF_PREFIX,
  CIKGU_LEVELS,
  CIKGU_RUBRICS,
  CIKGU_SP_LABELS,
  cikguLevelLabel,
  type CikguLevelCode,
  type CikguRubric,
} from '@pp/contract'

export type ChatRoute = 'mark_essay' | 'rph' | 'practice' | 'general'
export type ChatTool = (typeof CIKGU_CHAT_TOOLS)[number]

/** BR-M13-04: first match on the trimmed message, case-insensitive. */
export function routeOf(message: string): ChatRoute {
  const m = message.trim().toLowerCase()
  if (m.startsWith(CIKGU_HANDOFF_PREFIX.toLowerCase())) return 'mark_essay'
  if (m.includes('rph')) return 'rph'
  if (m.includes('latihan') || m.includes('soalan')) return 'practice'
  return 'general'
}

/** The rubric of a key (BR-M13-08 fallback to the first rubric). */
export function rubricOf(key: string | null | undefined): CikguRubric {
  return CIKGU_RUBRICS.find((r) => r.key === key) ?? (CIKGU_RUBRICS[0] as CikguRubric)
}

// --- hand-off message (BR-M13-08) ----------------------------------------------------------------

export interface ParsedHandoff {
  rubric: CikguRubric
  subject: string | null
  level: string | null
  student: string | null
  title: string | null
  essay: string
}

const nul = (v: string | undefined): string | null => {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

/** Parses the message the screen builds (markers `. Subjek: `, `. Level: `, `. Pelajar: `, `. Tajuk: `, `. Karangan:`). */
export function parseHandoff(message: string): ParsedHandoff {
  const text = message.trim()
  let rubric: CikguRubric | undefined
  let rest = ''
  for (const r of CIKGU_RUBRICS) {
    const head = `${CIKGU_HANDOFF_PREFIX}${r.label}.`
    if (text.toLowerCase().startsWith(head.toLowerCase())) {
      rubric = r
      rest = text.slice(head.length)
      break
    }
  }
  if (!rubric) {
    // Unknown label: keep what follows the first full stop after the prefix, rubric = the first.
    rubric = rubricOf(null)
    const dot = text.indexOf('. ', CIKGU_HANDOFF_PREFIX.length)
    rest = dot === -1 ? '' : text.slice(dot + 1)
  }
  const m =
    /^(?: Subjek: ([\s\S]*?)\.)?(?: Level: ([\s\S]*?)\.)?(?: Pelajar: ([\s\S]*?)\.)?(?: Tajuk: ([\s\S]*?)\.)?(?: Karangan:([\s\S]*))?$/.exec(
      rest,
    )
  return {
    rubric,
    subject: nul(m?.[1]),
    level: nul(m?.[2]),
    student: nul(m?.[3]),
    title: nul(m?.[4]),
    essay: (m?.[5] ?? '').trim(),
  }
}

// --- RPH request in the chat (BR-M13-10) -----------------------------------------------------------

export interface ParsedRphRequest {
  subject: string
  level: CikguLevelCode
  tajuk: string
  /** `true` when the message says "esok". */
  tomorrow: boolean
}

const LEVEL_TOKEN = /\b([TD])([1-6])\b|\b(Tingkatan|Darjah)\s+([1-6])\b/gi

/** `null` when no subject or no level is found (follow-up reply, nothing saved). The subject is the longest active name in the message. */
export function parseRphRequest(message: string, subjectNames: readonly string[]): ParsedRphRequest | null {
  const lower = message.toLowerCase()
  const subject = [...subjectNames]
    .filter((n) => n.trim() !== '' && lower.includes(n.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0]
  if (subject === undefined) return null

  let level: CikguLevelCode | null = null
  let end = 0
  const re = new RegExp(LEVEL_TOKEN.source, LEVEL_TOKEN.flags)
  for (let m = re.exec(message); m !== null; m = re.exec(message)) {
    const letter = (m[1] ?? (m[3] ?? '').charAt(0)).toUpperCase()
    const digit = m[2] ?? m[4] ?? ''
    const code = `${letter}${digit}`
    const known = CIKGU_LEVELS.find((l) => l.code === code)
    if (known) {
      level = known.code
      end = m.index + m[0].length
      break
    }
  }
  if (level === null) return null

  let tajuk = message
    .slice(end)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*\b(esok|hari ini)$/i, '')
    .trim()
  if (tajuk === '') tajuk = `${subject} ${cikguLevelLabel(level)}`
  return { subject, level, tajuk, tomorrow: /\besok\b/i.test(message) }
}

// --- RPH plan text (BR-M13-11) ------------------------------------------------------------------------

export interface RphContentInput {
  subjectName: string
  level: CikguLevelCode
  tajuk: string
  className: string | null
  /** `dd/mm/yyyy`. */
  dateLabel: string
  durationMinutes: number
  timeSlot: string | null
  tema: string | null
  pengajaranKeperluan: string | null
}

/** BR-M13-11 minute split: [set induksi, aktiviti 1, 2, 3, penutup]. */
export function activityMinutes(total: number): [number, number, number, number, number] {
  const a = Math.round(0.1 * total)
  const e = Math.round(0.15 * total)
  const b = Math.floor((total - a - e) / 3)
  const d = total - a - e - 2 * b
  return [a, b, b, d, e]
}

export function rphContent(i: RphContentInput): string {
  const level = cikguLevelLabel(i.level)
  const [a, b, c, d, e] = activityMinutes(i.durationMinutes)
  const lines: string[] = [`${i.subjectName} · ${level}`]
  if (i.className) lines.push(`Kelas: ${i.className}`)
  lines.push(`Tarikh: ${i.dateLabel}`)
  if (i.timeSlot) lines.push(`Masa: ${i.timeSlot}`)
  lines.push(`Tempoh: ${String(i.durationMinutes)} minit`, `Tajuk: ${i.tajuk}`)
  if (i.tema) lines.push(`Tema: ${i.tema}`)
  lines.push(
    '',
    `Standard Kandungan: rujuk DSKP ${i.subjectName} ${level} — ${i.tajuk}`,
    `Standard Pembelajaran: rujuk DSKP ${i.subjectName} ${level} — ${i.tajuk}`,
    '',
    'Objektif Pembelajaran',
    `1. Menyatakan konsep utama ${i.tajuk} dengan betul.`,
    `2. Menerangkan ${i.tajuk} dengan contoh yang sesuai.`,
    `3. Menyelesaikan sekurang-kurangnya 3 daripada 4 soalan berkaitan ${i.tajuk}.`,
    '',
    'Aktiviti PdPc',
    `Set Induksi (${String(a)} minit)`,
    `Aktiviti 1 (${String(b)} minit)`,
    `Aktiviti 2 (${String(c)} minit)`,
    `Aktiviti 3 (${String(d)} minit)`,
    `Penutup (${String(e)} minit)`,
    '',
    'BBM: buku teks, lembaran kerja, slaid ringkas',
    'EMK: kreativiti dan inovasi',
    'PBD Assessment plan: pemerhatian semasa Aktiviti 2 dan lembaran kerja (TP1–TP6)',
  )
  if (i.pengajaranKeperluan) lines.push(`Keperluan Khas: ${i.pengajaranKeperluan}`)
  return lines.join('\n')
}

/** `YYYY-MM-DD` as `dd/mm/yyyy`. */
export function dateLabelOf(dateKey: string): string {
  const [y, m, d] = dateKey.split('-')
  return `${d ?? ''}/${m ?? ''}/${y ?? ''}`
}

// --- PBD (BR-M13-15) -----------------------------------------------------------------------------------

/** BR-M13-15 SP label per subject name; `Kimia` 5.1.1, `Sejarah` and every other subject 1.1.1 (illustrative). */
export function spOf(subjectName: string): string {
  return subjectName === 'Kimia' ? CIKGU_SP_LABELS.Kimia : subjectName === 'Sejarah' ? CIKGU_SP_LABELS.Sejarah : CIKGU_SP_LABELS.default
}

// --- CSV (BR-M13-17 / SEC-M13-04) ----------------------------------------------------------------------

/**
 * One CSV cell with the spreadsheet-formula guard: a cell starting with `=`, `+`, `-` or `@` gets a leading `'`
 * (the contract's `cikguCsvCell` rule). Stricter than the mock and the contract: a leading tab or carriage return is
 * guarded too (OWASP CSV injection list). RFC 4180 quoting: a cell with `"`, `,`, CR or LF is double-quoted, inner
 * quotes doubled.
 */
export function csvCell(value: string | number): string {
  let s = String(value)
  if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
