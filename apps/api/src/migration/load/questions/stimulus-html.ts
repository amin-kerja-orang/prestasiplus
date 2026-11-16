/**
 * Inline media of a V2 stimulus body (feature slug `etl-stimulus-inline-img`).
 *
 * V2 keeps some stimuli as HTML: `<img src="/storage/stimuli/<uuid>/<file>">` (Laravel public storage) and a raw `<table>`. The learner UI shows a
 * stimulus body as text, so such a body printed its tags. This module is the ONE rule, shared by the loader (`ensureStimuli`, a fresh load) and by the
 * repair of rows that are already loaded (`repair-stimuli.ts`): it splits the body into pieces a V3 stimulus can show.
 *
 * What the data model and the display allow (checked in `src/components/question-display`, `UNSHOWABLE_STIMULUS_SQL`):
 *  - a stimulus is EITHER a picture (kind image/diagram/graph/map/infographic with `asset_file_id`; its body text is never drawn), OR a passage
 *    (text), OR a table (`table_data` `{ head, rows }`, the shape `stimulusTableOf` reads); it cannot be two of them at once;
 *  - a question (or a group) shows up to 3 stimuli, in `position` order.
 * So the row keeps the FIRST picture or table (the part that was broken) and every other part (the text, a second picture, a second table) becomes an
 * extra stimulus linked after it, at the next free position. A row that already has a picture of its own (media asset) keeps it, its text stays in
 * the body, and every inline picture or table becomes an extra.
 */
import { plainFromHtml } from '../../transform/question-bank'

export const PICTURE_KINDS: readonly string[] = ['image', 'diagram', 'graph', 'map', 'infographic']

/** Why a body cannot be turned into pieces: fixed words, counted and never printed with a value. */
export type MediaCause = 'other_img' | 'path' | 'table' | 'markup' | 'bilingual'

export interface InlineImage {
  /** Path inside the V2 storage export (`stimuli/<uuid>/<file>` or `exam-media/...`), decoded. */
  path: string
  /** Position of the picture among the pictures of the body (0 = first): part of the `files` legacy key. */
  index: number
}

export interface TableGrid {
  head: string[]
  rows: string[][]
}

export interface StimulusPiece {
  kind: string
  bodyMs: string | null
  bodyEn: string | null
  tableData: TableGrid | null
  image: InlineImage | null
  altText: string | null
}

/**
 * `primaryAt`: how many extras come BEFORE the row in the body (the text that precedes the first picture or table). Linked in this order the stimuli read
 * as the body does: `extras[0..primaryAt)`, the row, then the other extras.
 */
export type MediaPlan = { ok: true; primary: StimulusPiece; extras: StimulusPiece[]; primaryAt: number } | { ok: false; cause: MediaCause }

type Segment =
  | { type: 'text'; text: string }
  | { type: 'image'; path: string | null; bad: 'other_img' | 'path' | null; alt: string | null }
  | { type: 'table'; grid: TableGrid | null }

const TOKEN = /<table(?:\s[^<>]*)?>[\s\S]*?<\/table\s*>|<img(?:[\s/][^<>]*)?>/gi
const STRICT_IMG = /<img\b[^>]*\/storage\/(?:stimuli|exam-media)\//i
const ANY_MEDIA = /<(?:img|table)\b/i
const RESIDUAL = /<\/?(?:table|thead|tbody|tfoot|tr|td|th|caption|img)\b/i
const SRC = /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
const ALT = /\salt\s*=\s*(?:"([^"]*)"|'([^']*)')/i
/** V2 public storage: `stimuli/<uuid>/<file>` and `exam-media/<...>` (one or more safe segments; `..` is refused later by `normaliseRelativePath`). */
const STORAGE = /^\/storage\/((?:stimuli|exam-media)\/(?:[^/\\?#]+\/)*[^/\\?#]+)$/

/** True when the body holds an inline picture of V2 storage or a raw table (the rows the repair command selects). */
export function hasInlineMedia(html: string | null | undefined): boolean {
  return html !== null && html !== undefined && (STRICT_IMG.test(html) || /<table\b/i.test(html))
}

const plain = (html: string): string => plainFromHtml(html).text.replace(/<[^>]*>/g, '').trim()

function imageOf(tag: string): Extract<Segment, { type: 'image' }> {
  const m = SRC.exec(tag)
  const src = plainFromHtml(m?.[1] ?? m?.[2] ?? m?.[3] ?? '').text
  const alt = ALT.exec(tag)
  const altText = alt === null ? null : plain(alt[1] ?? alt[2] ?? '') || null
  const hit = STORAGE.exec(src)
  if (hit === null) return { type: 'image', path: null, bad: 'other_img', alt: altText }
  try {
    return { type: 'image', path: decodeURIComponent(hit[1] as string), bad: null, alt: altText }
  } catch {
    return { type: 'image', path: null, bad: 'path', alt: altText }
  }
}

/** `{ head, rows }` of a table, or null when it has no head plus at least one row, or holds a picture or a nested table. */
function gridOf(table: string): { grid: TableGrid | null; caption: string | null } {
  const caption = /<caption(?:\s[^<>]*)?>([\s\S]*?)<\/caption\s*>/i.exec(table)
  const inner = table.replace(/<caption(?:\s[^<>]*)?>[\s\S]*?<\/caption\s*>/i, '').replace(/^<table(?:\s[^<>]*)?>/i, '').replace(/<\/table\s*>$/i, '')
  const captionText = caption === null ? null : plain(caption[1] as string) || null
  if (/<img\b|<table\b/i.test(inner)) return { grid: null, caption: captionText }
  const rows: string[][] = []
  for (const tr of inner.matchAll(/<tr(?:\s[^<>]*)?>([\s\S]*?)<\/tr\s*>/gi)) {
    const cells = [...(tr[1] as string).matchAll(/<t[hd](?:\s[^<>]*)?>([\s\S]*?)<\/t[hd]\s*>/gi)].map((c) => plain(c[1] as string).replace(/\s+/g, ' '))
    if (cells.length > 0) rows.push(cells)
  }
  const width = Math.max(0, ...rows.map((r) => r.length))
  if (rows.length < 2 || width === 0) return { grid: null, caption: captionText }
  const padded = rows.map((r) => [...r, ...Array.from({ length: width - r.length }, () => '')])
  return { grid: { head: padded[0] as string[], rows: padded.slice(1) }, caption: captionText }
}

/** The ordered pieces of a body, or a cause. Text is converted to plain text like every V2 body. */
function split(html: string): { segments: Segment[] } | { cause: MediaCause } {
  const segments: Segment[] = []
  const text = (raw: string): boolean => {
    if (RESIDUAL.test(raw)) return false
    const t = plain(raw)
    if (t !== '') segments.push({ type: 'text', text: t })
    return true
  }
  let at = 0
  for (const m of html.matchAll(TOKEN)) {
    if (!text(html.slice(at, m.index))) return { cause: 'markup' }
    at = (m.index as number) + m[0].length
    if (/^<img/i.test(m[0])) segments.push(imageOf(m[0]))
    else {
      const { grid, caption } = gridOf(m[0])
      if (caption !== null) segments.push({ type: 'text', text: caption })
      segments.push({ type: 'table', grid })
    }
  }
  if (!text(html.slice(at))) return { cause: 'markup' }
  for (const s of segments) {
    if (s.type === 'image' && s.bad !== null) return { cause: s.bad }
    if (s.type === 'table' && s.grid === null) return { cause: 'table' }
  }
  return { segments }
}

const mediaKey = (s: Segment): string => (s.type === 'image' ? `i:${s.path}` : s.type === 'table' ? `t:${JSON.stringify(s.grid)}` : '')

/**
 * Pieces for a stimulus whose Malay (`ms`) and English (`en`) bodies are given as stored. Null = nothing to do (no picture and no table in either body).
 * The Malay body decides the layout (the English one when it is the only one with media); the other language must carry the same media in the same order
 * and the same number of text parts, else the cause is `bilingual` and the row is left alone.
 */
export function planInlineMedia(input: { kind: string; ms: string | null; en: string | null; hasAsset: boolean }): MediaPlan | null {
  const hasMs = input.ms !== null && ANY_MEDIA.test(input.ms)
  const hasEn = input.en !== null && ANY_MEDIA.test(input.en)
  if (!hasMs && !hasEn) return null
  const layoutIsMs = hasMs
  const first = split((layoutIsMs ? input.ms : input.en) as string)
  if ('cause' in first) return { ok: false, cause: first.cause }
  const otherHtml = layoutIsMs ? input.en : input.ms
  let other: Segment[] = []
  if (otherHtml !== null && otherHtml.trim() !== '') {
    const second = split(otherHtml)
    if ('cause' in second) return { ok: false, cause: second.cause }
    other = second.segments
  }
  const media = first.segments.filter((s) => s.type !== 'text')
  const otherMedia = other.filter((s) => s.type !== 'text')
  const texts = (list: Segment[]): string[] => list.flatMap((s) => (s.type === 'text' ? [s.text] : []))
  const own = texts(first.segments)
  const twin = texts(other)
  if (other.length > 0 && (media.map(mediaKey).join('|') !== otherMedia.map(mediaKey).join('|') || twin.length !== own.length)) {
    return { ok: false, cause: 'bilingual' }
  }

  const textOf = (i: number): { ms: string | null; en: string | null } => {
    const a = own[i] ?? null
    const b = twin[i] ?? null
    return layoutIsMs ? { ms: a, en: b } : { ms: b, en: a }
  }
  const pictureKind = PICTURE_KINDS.includes(input.kind) ? input.kind : 'image'
  let textNo = 0
  let imageNo = 0
  const pieces: StimulusPiece[] = first.segments.map((s) => {
    if (s.type === 'text') {
      const t = textOf(textNo++)
      return { kind: 'passage', bodyMs: t.ms, bodyEn: t.en, tableData: null, image: null, altText: null }
    }
    if (s.type === 'table') return { kind: 'table', bodyMs: null, bodyEn: null, tableData: s.grid, image: null, altText: null }
    return { kind: pictureKind, bodyMs: null, bodyEn: null, tableData: null, image: { path: s.path as string, index: imageNo++ }, altText: s.alt }
  })
  const extraKind = (p: StimulusPiece): StimulusPiece => (p.kind === pictureKind && p.image !== null ? { ...p, kind: 'image' } : p)

  if (input.hasAsset) {
    const joined = (pick: (p: StimulusPiece) => string | null): string | null => pieces.filter((p) => p.kind === 'passage').map(pick).filter((t): t is string => t !== null).join('\n') || null
    const bodyMs = joined((p) => p.bodyMs)
    const bodyEn = joined((p) => p.bodyEn)
    // a row whose only content is its picture is a picture, never a blank passage (the serving rule hides a blank passage)
    const kind = input.kind === 'passage' && bodyMs === null && bodyEn === null ? 'image' : input.kind
    return {
      ok: true,
      primary: { kind, bodyMs, bodyEn, tableData: null, image: null, altText: null },
      extras: pieces.filter((p) => p.kind !== 'passage').map(extraKind),
      primaryAt: 0,
    }
  }
  const at = pieces.findIndex((p) => p.kind !== 'passage')
  return { ok: true, primary: pieces[at] as StimulusPiece, extras: pieces.filter((_, i) => i !== at).map(extraKind), primaryAt: at }
}
