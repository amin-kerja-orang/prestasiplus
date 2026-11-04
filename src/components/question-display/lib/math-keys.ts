/**
 * Key map of the on-screen maths keypad (Casio fx-570 / fx-991 style, the calculator SPM students
 * use). Pure data, so the layout can be tested. From the top:
 *
 * - function area, two swappable rows ("Fungsi" or "Simbol") over one shared row `( ) π ° [layer]`,
 * - the Casio number block `7 8 9 DEL AC / 4 5 6 × ÷ / 1 2 3 + − / 0 . ×10ˣ ◀ ▶`.
 *
 * Every key inserts friendly notation at the caret (never LaTeX); see `plainToLatex`.
 */
export interface KeyPress {
  insert?: string
  /** Caret offset inside the inserted text (default: its end). */
  cursor?: number
  action?: 'backspace' | 'left' | 'right' | 'clear'
}

/**
 * fn = function, sci = function key inside the number block (taller), sym = symbol, num = digit or
 * point, op = arithmetic operator, del = DEL / AC, nav = cursor.
 */
export type KeyTone = 'fn' | 'sci' | 'sym' | 'num' | 'op' | 'del' | 'nav'

export interface MathKey {
  id: string
  label: string
  /** Accessible name (BM). New keys start with their visible label (WCAG 2.5.3, label in name). */
  aria: string
  insert?: string
  cursor?: number
  action?: KeyPress['action']
  tone: KeyTone
}

const K = (
  id: string,
  label: string,
  aria: string,
  tone: KeyTone,
  rest: Pick<MathKey, 'insert' | 'cursor' | 'action'> = {},
): MathKey => ({ id, label, aria, tone, ...rest })

const digit = (d: string): MathKey => K(d, d, d, 'num', { insert: d })

/** Layer "Fungsi": 5 columns x 2 rows (above the shared row). */
export const FUNCTION_ROWS: MathKey[][] = [
  [
    K('frac', 'a/b', 'Pecahan', 'fn', { insert: '()/()', cursor: 1 }),
    K('sqrt', '√', 'Punca kuasa dua', 'fn', { insert: '√()', cursor: 2 }),
    K('sq', 'x²', 'Kuasa dua', 'fn', { insert: '^2' }),
    K('pow', 'xⁿ', 'Kuasa', 'fn', { insert: '^()', cursor: 2 }),
    K('inv', 'x⁻¹', 'x⁻¹ salingan', 'fn', { insert: '^(-1)' }),
  ],
  [
    K('sin', 'sin', 'sin', 'fn', { insert: 'sin()', cursor: 4 }),
    K('cos', 'cos', 'cos', 'fn', { insert: 'cos()', cursor: 4 }),
    K('tan', 'tan', 'tan', 'fn', { insert: 'tan()', cursor: 4 }),
    K('log', 'log', 'log, logaritma asas 10', 'fn', { insert: 'log()', cursor: 4 }),
    K('ln', 'ln', 'ln, logaritma asli', 'fn', { insert: 'ln()', cursor: 3 }),
  ],
]

/** Layer "Simbol": the working-step symbols, 5 columns x 2 rows (same place as "Fungsi"). */
export const SYMBOL_ROWS: MathKey[][] = [
  [
    K('x', 'x', 'Pemboleh ubah x', 'sym', { insert: 'x' }),
    K('y', 'y', 'Pemboleh ubah y', 'sym', { insert: 'y' }),
    K('comma', ',', 'Koma', 'sym', { insert: ', ' }),
    K('percent', '%', 'Peratus', 'sym', { insert: '%' }),
    K('pm', '±', 'Tambah atau tolak', 'sym', { insert: '±' }),
  ],
  [
    K('lt', '<', 'Kurang daripada', 'sym', { insert: '<' }),
    K('gt', '>', 'Lebih daripada', 'sym', { insert: '>' }),
    K('le', '≤', 'Kurang daripada atau sama dengan', 'sym', { insert: '≤' }),
    K('ge', '≥', 'Lebih daripada atau sama dengan', 'sym', { insert: '≥' }),
    K('eq', '=', 'Sama dengan', 'sym', { insert: '=' }),
  ],
]

/** Third function row, shown with both layers; its fifth key (not listed here) switches the layer. */
export const SHARED_KEYS: MathKey[] = [
  K('lp', '(', 'Kurungan buka', 'fn', { insert: '(' }),
  K('rp', ')', 'Kurungan tutup', 'fn', { insert: ')' }),
  K('pi', 'π', 'Pi', 'fn', { insert: 'π' }),
  K('deg', '°', '° darjah', 'fn', { insert: '°' }),
]

/** The number block, always visible: 5 columns x 4 rows. */
export const NUMBER_ROWS: MathKey[][] = [
  [
    digit('7'),
    digit('8'),
    digit('9'),
    K('back', 'DEL', 'Padam', 'del', { action: 'backspace' }),
    K('clear', 'AC', 'AC, kosongkan semua', 'del', { action: 'clear' }),
  ],
  [
    digit('4'),
    digit('5'),
    digit('6'),
    K('times', '×', 'Darab', 'op', { insert: '×' }),
    K('div', '÷', 'Bahagi', 'op', { insert: '÷' }),
  ],
  [
    digit('1'),
    digit('2'),
    digit('3'),
    K('plus', '+', 'Tambah', 'op', { insert: '+' }),
    K('minus', '−', 'Tolak', 'op', { insert: '-' }),
  ],
  [
    digit('0'),
    K('dot', '.', 'Titik perpuluhan', 'num', { insert: '.' }),
    K('e10', '×10ˣ', '×10ˣ darab sepuluh kuasa', 'sci', { insert: '×10^()', cursor: 5 }),
    K('left', '◀', 'Kursor ke kiri', 'nav', { action: 'left' }),
    K('right', '▶', 'Kursor ke kanan', 'nav', { action: 'right' }),
  ],
]

/** Every key that inserts text or acts on the line (the layer switch is not one of them). */
export const ALL_KEYS: MathKey[] = [
  ...FUNCTION_ROWS.flat(),
  ...SYMBOL_ROWS.flat(),
  ...SHARED_KEYS,
  ...NUMBER_ROWS.flat(),
]

export interface KeyResult {
  text: string
  caret: number
}

/**
 * Applies one key press to the line `text` with the selection `[a, b]`: insert at the caret, DEL
 * (an empty `()` pair goes in one step), AC (clears the line), cursor left, and cursor right
 * (steps over the `)/(` of a fraction so "▶" goes from numerator to denominator).
 */
export function applyKey(text: string, a: number, b: number, k: KeyPress): KeyResult {
  if (k.insert !== undefined) {
    return {
      text: text.slice(0, a) + k.insert + text.slice(b),
      caret: a + (k.cursor ?? k.insert.length),
    }
  }
  switch (k.action) {
    case 'backspace': {
      if (a !== b) return { text: text.slice(0, a) + text.slice(b), caret: a }
      if (a === 0) return { text, caret: a }
      const pair = text.slice(a - 1, a + 1) === '()'
      return { text: text.slice(0, a - 1) + text.slice(a + (pair ? 1 : 0)), caret: a - 1 }
    }
    case 'clear':
      return { text: '', caret: 0 }
    case 'left':
      return { text, caret: Math.max(0, a - 1) }
    case 'right':
      return {
        text,
        caret: text.slice(a, a + 3) === ')/(' ? a + 3 : Math.min(text.length, a + 1),
      }
    default:
      return { text, caret: a }
  }
}
