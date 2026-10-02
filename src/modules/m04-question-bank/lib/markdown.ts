/**
 * Small Markdown parser for the stored AI explanation (FR-M04-45: headings, lists, tables, code,
 * bold). It returns a typed tree, never HTML: `MarkdownView.vue` renders the tree with Vue templates,
 * so every text is escaped by Vue and no `v-html` is used. The explanation is model output and is
 * treated as untrusted.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; content: Inline[] }
  | { kind: 'paragraph'; lines: Inline[][] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { kind: 'code'; text: string }

const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g

/** Inline: `code`, **bold**, *italic*; everything else is plain text. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    const at = m.index
    if (at > last) out.push({ kind: 'text', text: text.slice(last, at) })
    if (m[1] !== undefined) out.push({ kind: 'code', text: m[1] })
    else if (m[2] !== undefined) out.push({ kind: 'strong', text: m[2] })
    else out.push({ kind: 'em', text: m[3] ?? '' })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

const isTableRow = (line: string): boolean => /^\s*\|.*\|\s*$/.test(line)
const isDivider = (line: string): boolean => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line)
const cells = (line: string): Inline[][] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => parseInline(c.trim()))

const BULLET = /^\s*[-*]\s+/
const NUMBERED = /^\s*\d+[.)]\s+/

export function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n')
  const out: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (line.trim() === '') {
      i++
      continue
    }
    if (line.trim().startsWith('```')) {
      const code: string[] = []
      i++
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
        code.push(lines[i] ?? '')
        i++
      }
      i++
      out.push({ kind: 'code', text: code.join('\n') })
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      out.push({
        kind: 'heading',
        level: (heading[1] ?? '#').length as 1 | 2 | 3 | 4,
        content: parseInline(heading[2] ?? ''),
      })
      i++
      continue
    }
    if (isTableRow(line) && isDivider(lines[i + 1] ?? '')) {
      const head = cells(line)
      i += 2
      const rows: Inline[][][] = []
      while (i < lines.length && isTableRow(lines[i] ?? '')) {
        rows.push(cells(lines[i] ?? ''))
        i++
      }
      out.push({ kind: 'table', head, rows })
      continue
    }
    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line)
      const pattern = ordered ? NUMBERED : BULLET
      const items: Inline[][] = []
      while (i < lines.length && pattern.test(lines[i] ?? '')) {
        items.push(parseInline((lines[i] ?? '').replace(pattern, '')))
        i++
      }
      out.push({ kind: 'list', ordered, items })
      continue
    }
    const para: Inline[][] = []
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^(#{1,4}\s|```|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i] ?? '') &&
      !isTableRow(lines[i] ?? '')
    ) {
      para.push(parseInline(lines[i] ?? ''))
      i++
    }
    if (para.length === 0) {
      // A line no block rule took (e.g. a lone table row): render it as text so the loop advances.
      para.push(parseInline(line))
      i++
    }
    out.push({ kind: 'paragraph', lines: para })
  }
  return out
}
