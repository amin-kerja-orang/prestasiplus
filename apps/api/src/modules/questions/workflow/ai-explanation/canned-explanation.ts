import type { ExplanationSource } from '../ports'

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

const TYPE_LABELS: Readonly<Record<string, string>> = {
  mcq: 'Aneka pilihan',
  true_false: 'Betul / Salah',
  short_answer: 'Jawapan pendek',
  fill_blank: 'Isi tempat kosong',
  essay: 'Esei',
}

/** The variant (0 to 2) a stored text was built from; -1 when it is not a canned text. */
export function variantOf(markdown: string): number {
  return HEADINGS.findIndex((h) => markdown.includes(h))
}

/** The variant for a new text: previous + 1 when the stored text is canned, else `id % 3`. */
export function nextVariant(previous: string | null, id: string): number {
  const prev = previous === null ? -1 : variantOf(previous)
  return prev >= 0 ? (prev + 1) % HEADINGS.length : Number(BigInt(id) % BigInt(HEADINGS.length))
}

const cell = (text: string): string => text.replaceAll('|', '/').replaceAll('\n', ' ')

/** The canned Markdown of a question for `variant` (copy of the mock `cannedExplanation`). Deterministic; no network. */
export function cannedExplanation(q: ExplanationSource, variant: number): string {
  const v = ((variant % HEADINGS.length) + HEADINGS.length) % HEADINGS.length
  const lines: string[] = ['## Penjelasan', '']
  let table: string[]
  const correct = q.options?.findIndex((o) => o.isCorrect) ?? -1

  if (q.type === 'mcq' && q.options !== null && correct >= 0) {
    const right = q.options[correct]
    lines.push(`**Jawapan betul:** ${right?.label ?? 'A'}. ${right?.text ?? ''}`.trimEnd(), '')
    table = [
      '| Pilihan | Ulasan |',
      '| --- | --- |',
      ...q.options.map((o) => `| ${o.label}. ${cell(o.text)} | ${o.isCorrect ? 'Betul' : 'Tidak tepat'} |`),
    ]
  } else {
    lines.push(`**Jawapan betul:** ${q.answerText !== null && q.answerText !== '' ? q.answerText : '-'}`, '')
    table = [
      '| Perkara | Butiran |',
      '| --- | --- |',
      `| Jenis soalan | ${TYPE_LABELS[q.type] ?? q.type} |`,
      `| Tahap kesukaran | ${q.difficultyLevel === undefined || q.difficultyLevel === null ? '-' : String(q.difficultyLevel)} / 5 |`,
      `| Nilai mata | ${q.pointsValue === undefined || q.pointsValue === null ? '-' : String(q.pointsValue)} |`,
    ]
  }

  lines.push(HEADINGS[v] as string, '')
  for (const item of REASONS[v] as readonly string[]) lines.push(`- ${item}`)
  lines.push('', ...table)
  return lines.join('\n')
}
