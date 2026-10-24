/**
 * Canned AI and the pure rules around it (SRS M13 v1.1 BR-M13-04…11, BR-M13-14, §8.2; D4: no real AI,
 * everything deterministic, BR-M13-23). No store access here.
 */

import {
  HANDOFF_PREFIX,
  LEVELS,
  levelLabelOf,
  RUBRICS,
  rubricOf,
  type LevelCode,
  type Rubric,
} from '../../api/settings'

// --- texts (§8.2, PROPOSED COPY) -----------------------------------------------------------------

export const GENERAL_REPLY =
  'Soalan yang baik! Ini penerangan ringkas:\n' +
  '1. Mulakan dengan konsep asas dan satu contoh mudah.\n' +
  '2. Kaitkan konsep itu dengan pengalaman harian murid.\n' +
  '3. Akhiri dengan 2–3 soalan semakan kefahaman.\n' +
  'Nak saya sediakan latihan soalan untuk topik ini?'

export const PRACTICE_REPLY =
  'Ini 3 soalan latihan ringkas:\n' +
  '1. Nyatakan maksud konsep utama topik ini.\n' +
  '2. Berikan satu contoh konsep ini dalam kehidupan harian.\n' +
  '3. Terangkan perbezaan antara dua konsep yang berkaitan.\n' +
  'Cuba jawab dahulu, kemudian hantar jawapan untuk saya semak.'

export const RPH_FOLLOW_UP =
  'Boleh nyatakan subjek, tingkatan/tahun dan tajuk? ' +
  'Contoh: "Tolong jana RPH untuk Matematik T4 Bab 3 esok".'

export const rphConfirmation = (
  tajuk: string,
  subject: string,
  level: LevelCode,
  dateLabel: string,
): string =>
  `Siap! RPH "${tajuk}" (${subject}, ${levelLabelOf(level)}) untuk ${dateLabel} ` +
  'telah dijana dan disimpan dalam senarai RPH.'

/** BR-M13-09: 70 % of the maximum, rounded. */
export const cannedMarks = (max: number): number => Math.round(0.7 * max)

export function markingReply(rubric: Rubric, marks: number): string {
  return (
    `Markah: ${String(marks)}/${String(rubric.max)}\n` +
    `Rubrik: ${rubric.label}\n` +
    'Komen membina:\n' +
    '1. Isi: idea utama jelas; tambah satu contoh untuk setiap isi.\n' +
    '2. Bahasa: ayat gramatis; kurangkan pengulangan perkataan.\n' +
    '3. Cadangan: kukuhkan penutup dengan rumusan yang merujuk tajuk.'
  )
}

// --- routing (BR-M13-04) ------------------------------------------------------------------------

export type Route = 'mark_essay' | 'rph' | 'practice' | 'general'

export function routeOf(message: string): Route {
  const m = message.trim().toLowerCase()
  if (m.startsWith(HANDOFF_PREFIX.toLowerCase())) return 'mark_essay'
  if (m.includes('rph')) return 'rph'
  if (m.includes('latihan') || m.includes('soalan')) return 'practice'
  return 'general'
}

/** BR-M13-05, Unicode code points. */
export const countChars = (s: string): number => [...s].length
export const tokensIn = (message: string): number => 120 + Math.ceil(countChars(message) / 4)
export const tokensOut = (reply: string): number => Math.ceil(countChars(reply) / 4)

// --- hand-off message (BR-M13-08) ----------------------------------------------------------------

export interface ParsedHandoff {
  rubric: Rubric
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

/** Parses the message built by `buildHandoffMessage` (the same markers). */
export function parseHandoff(message: string): ParsedHandoff {
  const text = message.trim()
  let rubric: Rubric | undefined
  let rest = ''
  for (const r of RUBRICS) {
    const head = `${HANDOFF_PREFIX}${r.label}.`
    if (text.toLowerCase().startsWith(head.toLowerCase())) {
      rubric = r
      rest = text.slice(head.length)
      break
    }
  }
  if (!rubric) {
    // Unknown label: keep what follows the first full stop after the prefix, rubric = the first.
    rubric = rubricOf(null)
    const dot = text.indexOf('. ', HANDOFF_PREFIX.length)
    rest = dot === -1 ? '' : text.slice(dot + 1)
  }
  const m =
    /^(?: Subjek: ([\s\S]*?)\.)?(?: Tahap: ([\s\S]*?)\.)?(?: Pelajar: ([\s\S]*?)\.)?(?: Tajuk: ([\s\S]*?)\.)?(?: Karangan:([\s\S]*))?$/.exec(
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

// --- RPH request (BR-M13-10) ---------------------------------------------------------------------

export interface ParsedRphRequest {
  subject: string
  level: LevelCode
  tajuk: string
  /** `true` when the message says "esok". */
  tomorrow: boolean
}

const LEVEL_TOKEN = /\b([TD])([1-6])\b|\b(Tingkatan|Darjah)\s+([1-6])\b/gi

/** `null` when no subject or no level is found (follow-up reply, nothing saved). */
export function parseRphRequest(
  message: string,
  subjectNames: readonly string[],
): ParsedRphRequest | null {
  const lower = message.toLowerCase()
  const subject = [...subjectNames]
    .filter((n) => n.trim() !== '' && lower.includes(n.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0]
  if (subject === undefined) return null

  let level: LevelCode | null = null
  let end = 0
  LEVEL_TOKEN.lastIndex = 0
  for (let m = LEVEL_TOKEN.exec(message); m !== null; m = LEVEL_TOKEN.exec(message)) {
    const letter = (m[1] ?? (m[3] ?? '').charAt(0)).toUpperCase()
    const digit = m[2] ?? m[4] ?? ''
    const code = `${letter}${digit}`
    if (LEVELS.some((l) => l.code === code)) {
      level = code as LevelCode
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
  if (tajuk === '') tajuk = `${subject} ${levelLabelOf(level)}`
  return { subject, level, tajuk, tomorrow: /\besok\b/i.test(message) }
}

// --- RPH content (BR-M13-11) ---------------------------------------------------------------------

export interface RphContentInput {
  subjectName: string
  level: LevelCode
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
  const level = levelLabelOf(i.level)
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

// --- PBD (BR-M13-14) -----------------------------------------------------------------------------

export function tpOf(skor: number): number {
  if (skor < 20) return 1
  if (skor < 40) return 2
  if (skor < 60) return 3
  if (skor < 75) return 4
  if (skor < 90) return 5
  return 6
}

/** Skor = correct ÷ answered × 100, one decimal. */
export const skorOf = (correct: number, answered: number): number =>
  Math.round((correct / answered) * 1000) / 10
