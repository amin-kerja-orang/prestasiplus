/**
 * AI explanation of a question (SRS v1.16 §7 #8, BR-M04-24, D4): no AI is called. The mock builds a
 * canned Markdown text from the question (title "## Penjelasan", the correct answer, a short
 * reasoning list and a 2-column table) and stores it. Content and message copy are INFERRED
 * (UNVERIFIED COPY); three variants cycle so a regeneration (`force=1`) visibly changes the text.
 *
 * Test controls (`ctx.config`, set through the `config(key, value)` test hook):
 * - `m04.aiLatencyMs` (default 1500, the FR-M04-45 "mock latency 1.5 s"; tests set 0);
 * - `m04.aiFailNext`: the next call fails once with `'message'` (HTTP 500 `{ok:false, message}`),
 *   `'no-message'` (HTTP 500 `{ok:false}`), `'ok-false'` (HTTP 200 `{ok:false}`) or `'non-json'`
 *   (HTTP 500 with an HTML body). A network failure is `failNext(path, 'network')`.
 */

import type { Question } from '../repository/types'
import { LETTERS } from '../repository/rules'

export const AI_LATENCY_KEY = 'm04.aiLatencyMs'
export const AI_FAIL_KEY = 'm04.aiFailNext'
export const AI_DEFAULT_LATENCY_MS = 1500

/** UNVERIFIED COPY. */
export const AI_MESSAGE_OK = 'Penjelasan AI berjaya dijana.'
export const AI_MESSAGE_KEPT = 'Penjelasan AI sudah wujud.'
export const AI_MESSAGE_FAILED = 'Perkhidmatan AI tidak tersedia buat masa ini.'
/** What a browser shows for `JSON.parse` of an HTML page (SRS §8.2). */
export const AI_HTML_BODY = '<!DOCTYPE html><html><body>Server Error</body></html>'

const HEADINGS = ['### Sebab jawapan ini betul', '### Langkah penyelesaian', '### Ringkasan konsep']

const REASONS: readonly (readonly string[])[] = [
  [
    'Baca soalan dengan teliti dan kenal pasti konsep utama yang diuji.',
    'Bandingkan setiap pilihan dengan konsep tersebut.',
    'Hanya satu pilihan yang sepadan sepenuhnya dengan konsep itu.',
  ],
  [
    'Nyatakan maklumat penting yang diberi dalam soalan.',
    'Gunakan konsep atau rumus yang berkaitan untuk mendapatkan jawapan.',
    'Semak semula jawapan dengan pilihan yang tersedia.',
  ],
  [
    'Ingat semula definisi dan contoh yang berkaitan dengan topik ini.',
    'Singkirkan pilihan yang bercanggah dengan definisi.',
    'Pilih jawapan yang selaras dengan konsep yang dipelajari.',
  ],
]

const TYPE_LABELS: Readonly<Record<Question['questionType'], string>> = {
  mcq: 'Aneka pilihan',
  true_false: 'Betul / Salah',
  short_answer: 'Jawapan pendek',
  fill_blank: 'Isi tempat kosong',
  essay: 'Esei',
}

/** The variant (0–2) a stored text was built from; `-1` when it is not a canned text. */
export function variantOf(markdown: string): number {
  return HEADINGS.findIndex((h) => markdown.includes(h))
}

function cell(text: string): string {
  return text.replaceAll('|', '/').replaceAll('\n', ' ')
}

/** The canned Markdown of a question for `variant` (0–2). */
export function cannedExplanation(q: Question, variant: number): string {
  const v = ((variant % HEADINGS.length) + HEADINGS.length) % HEADINGS.length
  const lines: string[] = ['## Penjelasan', '']
  let table: string[]

  if (q.questionType === 'mcq' && q.options !== null && q.correctAnswer !== null) {
    const letter = LETTERS[q.correctAnswer] ?? 'A'
    lines.push(`**Jawapan betul:** ${letter}. ${q.options[q.correctAnswer] ?? ''}`.trimEnd(), '')
    table = [
      '| Pilihan | Ulasan |',
      '| --- | --- |',
      ...q.options.map(
        (text, i) =>
          `| ${LETTERS[i] ?? ''}. ${cell(text)} | ${i === q.correctAnswer ? 'Betul' : 'Tidak tepat'} |`,
      ),
    ]
  } else {
    let answer = '-'
    if (q.questionType === 'true_false') {
      answer = q.tfAnswer === null ? '-' : q.tfAnswer ? 'Betul' : 'Salah'
    } else if (q.questionType === 'short_answer' || q.questionType === 'fill_blank') {
      answer =
        [q.correctAnswerText ?? '', ...q.altAnswers].filter((a) => a !== '').join(' / ') || '-'
    } else if (q.questionType === 'essay') {
      answer = q.modelAnswer ?? '-'
    }
    lines.push(`**Jawapan betul:** ${answer}`, '')
    table = [
      '| Perkara | Butiran |',
      '| --- | --- |',
      `| Jenis soalan | ${TYPE_LABELS[q.questionType]} |`,
      `| Tahap kesukaran | ${String(q.difficultyLevel)} / 5 |`,
      `| Nilai mata | ${String(q.pointsValue)} |`,
    ]
  }

  lines.push(HEADINGS[v] as string, '')
  for (const item of REASONS[v] as readonly string[]) lines.push(`- ${item}`)
  lines.push('', ...table)
  return lines.join('\n')
}
