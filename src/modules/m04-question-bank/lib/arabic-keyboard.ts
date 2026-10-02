/**
 * S2 Arabic / Jawi virtual keyboard data and caret helpers (M04-T4; FR-M04-29..32, FN-M04-1.3.x).
 * The letter rows are the live rows; Jawi adds its letters inside them at the live positions.
 */

export type KeyboardMode = 'arab' | 'jawi'

export const KEYBOARD_CAPTIONS: Record<KeyboardMode, string> = {
  arab: 'Papan Kekunci Arab',
  jawi: 'Papan Kekunci Jawi',
}

export const ARAB_ROWS: readonly (readonly string[])[] = [
  [...'ضصثقفغعهخحجد'],
  [...'شسيبلاتنمكط'],
  ['ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'و', 'ز', 'ظ'],
]

export const JAWI_ROWS: readonly (readonly string[])[] = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'ڤ', 'غ', 'ڠ', 'ع', 'ه', 'خ', 'ح', 'چ', 'ج', 'د'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'ڽ', 'م', 'ك', 'ݢ', 'ط'],
  ['ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'و', 'ۏ', 'ز', 'ظ'],
]

export const keyboardRows = (mode: KeyboardMode): readonly (readonly string[])[] =>
  mode === 'jawi' ? JAWI_ROWS : ARAB_ROWS

/** The 9 harakat keys: the mark (shown after "◌") and its live title. */
export const HARAKAT: readonly { mark: string; title: string }[] = [
  { mark: 'َ', title: 'Fathah (atas)' },
  { mark: 'ِ', title: 'Kasrah (bawah)' },
  { mark: 'ُ', title: 'Dammah' },
  { mark: 'ْ', title: 'Sukun' },
  { mark: 'ً', title: 'Tanwin Fathah' },
  { mark: 'ٍ', title: 'Tanwin Kasrah' },
  { mark: 'ٌ', title: 'Tanwin Dammah' },
  { mark: 'ّ', title: 'Shadda (sabdu)' },
  { mark: 'ٰ', title: 'Superscript Alif (alif kecil)' },
]

/** The bottom-row keys that insert text: label shown and the text inserted. */
export const BOTTOM_KEYS: readonly { label: string; text: string }[] = [
  { label: 'SPACE', text: ' ' },
  { label: 'ال', text: 'ال' },
  { label: 'ة', text: 'ة' },
]

export interface CaretEdit {
  value: string
  caret: number
}

/** Inserts `text` at the caret, replacing the selection (FR-M04-31). */
export function insertAtCaret(value: string, start: number, end: number, text: string): CaretEdit {
  const from = Math.min(start, end)
  const to = Math.max(start, end)
  return { value: value.slice(0, from) + text + value.slice(to), caret: from + text.length }
}

/** Backspace: deletes the selection, else the one character before the caret. */
export function backspaceAtCaret(value: string, start: number, end: number): CaretEdit {
  const from = Math.min(start, end)
  const to = Math.max(start, end)
  if (to > from) return { value: value.slice(0, from) + value.slice(to), caret: from }
  if (from === 0) return { value, caret: 0 }
  return { value: value.slice(0, from - 1) + value.slice(from), caret: from - 1 }
}

export const PANEL_WIDTH = 580
export const PANEL_HEIGHT = 360

export interface PanelPlacement {
  above: boolean
  left: number
  width: number
}

/**
 * >= 640px placement (FR-M04-32): below the textarea, or above it when
 * `rect.bottom + 8 + 360 > innerHeight`; horizontally clamped inside the viewport (8px / 12px).
 */
export function placePanel(
  rect: { left: number; bottom: number },
  viewport: { width: number; height: number },
): PanelPlacement {
  const width = Math.min(PANEL_WIDTH, viewport.width - 20)
  const left = Math.max(8, Math.min(rect.left, viewport.width - width - 12))
  return { above: rect.bottom + 8 + PANEL_HEIGHT > viewport.height, left, width }
}
