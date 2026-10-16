/**
 * Small expression engine for marking maths answers (no CAS dependency).
 *
 * - `latexToPlain` turns the stored LaTeX (or plain typing such as `1/2`, `x^2`, `√3`) into one
 *   plain text form.
 * - `parseExpr` is a recursive-descent parser (implicit multiplication, powers, roots, % and pi).
 * - `exprEquivalent` compares two expressions numerically, at fixed pseudo-random points when they
 *   have variables (so `2x+6` equals `2(x+3)`), and within a tolerance when they do not.
 * - `answersEquivalent` also understands `x = 3` against `3`, equations and inequalities, lists
 *   (`2, -3` against `-3 atau 2`) and `±`.
 *
 * Malay comma decimals: a comma between two digits with no space is a decimal comma (`0,5`); a
 * comma followed by a space separates list items (`2, 3`).
 */

/* ------------------------------------------------------------------------------ LaTeX -> text */

/** Reads the `{...}` group starting at `i` (which must point at `{`). Returns content and next index. */
function readGroup(s: string, i: number): [string, number] {
  if (s[i] !== '{') {
    // `\frac12`: single-token argument
    return [s[i] ?? '', i + 1]
  }
  let depth = 0
  let j = i
  for (; j < s.length; j++) {
    if (s[j] === '{') depth++
    else if (s[j] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  return [s.slice(i + 1, j), j + 1]
}

function skipSpaces(s: string, i: number): number {
  while (s[i] === ' ') i++
  return i
}

const SYMBOLS: Record<string, string> = {
  '\\times': '*',
  '\\cdot': '*',
  '\\div': '/',
  '\\pi': 'pi',
  '\\pm': '±',
  '\\le': '<=',
  '\\leq': '<=',
  '\\leqslant': '<=',
  '\\ge': '>=',
  '\\geq': '>=',
  '\\geqslant': '>=',
  '\\lt': '<',
  '\\gt': '>',
  '\\neq': '!=',
  '\\ne': '!=',
  '\\degree': '',
  '\\circ': '',
  '\\%': '%',
  '\\sin': 'sin',
  '\\cos': 'cos',
  '\\tan': 'tan',
  '\\log': 'log',
  '\\ln': 'ln',
}

/** LaTeX or plain text -> plain text (still one string; the parser handles the rest). */
export function latexToPlain(input: string): string {
  let s = input.replace(/\$/g, '')
  s = s
    .replace(/\\left|\\right/g, '')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/\\(dfrac|tfrac)/g, '\\frac')
    .replace(/\\text\s*\{([^}]*)\}/g, ' $1 ')
    .replace(/\\mathrm\s*\{([^}]*)\}/g, ' $1 ')
  s = s
    .replace(/−|–/g, '-')
    .replace(/×|·|⋅/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=')
    .replace(/°/g, '')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
  // Decimal commas: digit,digit -> digit.digit.
  s = s.replace(/(\d),(\d)/g, '$1.$2')
  let out = ''
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === '\\') {
      const m = /^\\[a-zA-Z]+|^\\%/.exec(s.slice(i))
      const cmd = m?.[0] ?? '\\'
      i += cmd.length
      if (cmd === '\\frac') {
        i = skipSpaces(s, i)
        const [a, ni] = readGroup(s, i)
        const [b, nj] = readGroup(s, skipSpaces(s, ni))
        out += `((${latexToPlain(a)})/(${latexToPlain(b)}))`
        i = nj
      } else if (cmd === '\\sqrt') {
        i = skipSpaces(s, i)
        let index = '2'
        if (s[i] === '[') {
          const close = s.indexOf(']', i)
          index = latexToPlain(s.slice(i + 1, close))
          i = close + 1
        }
        const [a, ni] = readGroup(s, skipSpaces(s, i))
        out += index === '2' ? `sqrt(${latexToPlain(a)})` : `((${latexToPlain(a)})^(1/(${index})))`
        i = ni
      } else if (cmd === '\\' || cmd === '\\\\') {
        out += ' '
      } else {
        out += SYMBOLS[cmd] ?? ''
      }
      continue
    }
    if (ch === '^' || ch === '_') {
      if (s[i + 1] === '(') {
        out += '^'
        i++
        continue
      }
      if (s[i + 1] !== '{') {
        // Unbraced: a whole number or one letter (`10^3`, `x^2`), as friendly typing expects.
        const um = /^-?\d+(?:\.\d+)?|^[a-zA-Z]/.exec(s.slice(i + 1))
        if (um) {
          out += ch === '^' ? `^(${um[0]})` : `_${um[0]}`
          i += 1 + um[0].length
          continue
        }
      }
      const [g, ni] = readGroup(s, i + 1)
      const inner = latexToPlain(g)
      out += ch === '^' ? `^(${inner})` : `_${inner.replace(/\s+/g, '')}`
      i = ni
      continue
    }
    if (ch === '√') {
      out += 'sqrt'
      i++
      // `√3`, `√(x)`: wrap a bare number / letter argument
      const m = /^\s*(\d+(?:\.\d+)?|[a-zA-Z])/.exec(s.slice(i))
      if (m && s[i] !== '(') {
        out += `(${m[1]})`
        i += m[0].length
      }
      continue
    }
    if (ch === '{' || ch === '}') {
      out += ch === '{' ? '(' : ')'
      i++
      continue
    }
    out += ch
    i++
  }
  return out.replace(/\s+/g, ' ').trim()
}

/* ------------------------------------------------------------------------------- tokenizer */

type Tok =
  { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'fn'; v: string } | { t: 'op'; v: string }

const FUNCS = new Set(['sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'abs'])

class ParseError extends Error {}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]!
    if (ch === ' ') {
      i++
      continue
    }
    if (/\d|\./.test(ch)) {
      const m = /^\d*\.?\d+|^\d+\.?/.exec(src.slice(i))
      if (!m) throw new ParseError('number')
      toks.push({ t: 'num', v: Number(m[0]) })
      i += m[0].length
      continue
    }
    if (/[a-zA-Z]/.test(ch)) {
      const run = /^[a-zA-Z]+/.exec(src.slice(i))![0]
      // Words are not maths: a long letter run without a function name is unreadable.
      if (run.length > 3 && ![...FUNCS].some((f) => run.includes(f))) throw new ParseError('word')
      let rest = run
      let used = 0
      while (rest.length) {
        const fn = [...FUNCS].find((f) => rest.startsWith(f))
        if (fn) {
          toks.push({ t: 'fn', v: fn })
          rest = rest.slice(fn.length)
          used += fn.length
        } else if (rest.startsWith('pi')) {
          toks.push({ t: 'id', v: 'pi' })
          rest = rest.slice(2)
          used += 2
        } else {
          let name = rest[0]!
          rest = rest.slice(1)
          used += 1
          // optional subscript digits: x_1
          const sub = /^_(\w)/.exec(src.slice(i + used))
          if (sub && rest.length === 0) {
            name += `_${sub[1]}`
            used += 2
          }
          toks.push({ t: 'id', v: name })
        }
      }
      i += used
      continue
    }
    if ('+-*/^()=<>!%'.includes(ch)) {
      const two = src.slice(i, i + 2)
      if (two === '<=' || two === '>=' || two === '!=') {
        toks.push({ t: 'op', v: two })
        i += 2
        continue
      }
      toks.push({ t: 'op', v: ch })
      i++
      continue
    }
    throw new ParseError(`char ${ch}`)
  }
  return toks
}

/* ---------------------------------------------------------------------------------- parser */

export type Expr =
  | { k: 'num'; v: number }
  | { k: 'var'; v: string }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Expr; b: Expr }
  | { k: 'neg'; a: Expr }
  | { k: 'fn'; f: string; a: Expr }

class Parser {
  private pos = 0
  constructor(private readonly toks: Tok[]) {}

  private peek(): Tok | undefined {
    return this.toks[this.pos]
  }
  private isOp(v: string): boolean {
    const p = this.peek()
    return p?.t === 'op' && p.v === v
  }
  get done(): boolean {
    return this.pos >= this.toks.length
  }

  parseExpr(): Expr {
    let left = this.parseTerm()
    for (;;) {
      if (this.isOp('+') || this.isOp('-')) {
        const op = (this.peek() as { v: '+' | '-' }).v
        this.pos++
        left = { k: 'bin', op, a: left, b: this.parseTerm() }
      } else return left
    }
  }

  private startsAtom(): boolean {
    const p = this.peek()
    if (!p) return false
    if (p.t === 'num' || p.t === 'id' || p.t === 'fn') return true
    return p.t === 'op' && p.v === '('
  }

  private parseTerm(): Expr {
    let left = this.parseUnary()
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = (this.peek() as { v: '*' | '/' }).v
        this.pos++
        left = { k: 'bin', op, a: left, b: this.parseUnary() }
      } else if (this.startsAtom()) {
        left = { k: 'bin', op: '*', a: left, b: this.parsePower() }
      } else return left
    }
  }

  private parseUnary(): Expr {
    if (this.isOp('-')) {
      this.pos++
      return { k: 'neg', a: this.parseUnary() }
    }
    if (this.isOp('+')) {
      this.pos++
      return this.parseUnary()
    }
    return this.parsePower()
  }

  private parsePower(): Expr {
    const base = this.parsePostfix()
    if (this.isOp('^')) {
      this.pos++
      // right associative; exponent may be signed
      const exp = this.isOp('-')
        ? (this.pos++, { k: 'neg', a: this.parsePower() } as Expr)
        : this.parsePower()
      return { k: 'bin', op: '^', a: base, b: exp }
    }
    return base
  }

  private parsePostfix(): Expr {
    let e = this.parseAtom()
    while (this.isOp('%')) {
      this.pos++
      e = { k: 'bin', op: '/', a: e, b: { k: 'num', v: 100 } }
    }
    return e
  }

  private parseAtom(): Expr {
    const p = this.peek()
    if (!p) throw new ParseError('end')
    if (p.t === 'num') {
      this.pos++
      return { k: 'num', v: p.v }
    }
    if (p.t === 'id') {
      this.pos++
      return p.v === 'pi' ? { k: 'num', v: Math.PI } : { k: 'var', v: p.v }
    }
    if (p.t === 'fn') {
      this.pos++
      if (!this.isOp('(')) {
        // `sin x` style: parse a single atom
        return { k: 'fn', f: p.v, a: this.parsePower() }
      }
      return { k: 'fn', f: p.v, a: this.parseAtom() }
    }
    if (p.t === 'op' && p.v === '(') {
      this.pos++
      const e = this.parseExpr()
      if (!this.isOp(')')) throw new ParseError('paren')
      this.pos++
      return e
    }
    throw new ParseError('atom')
  }
}

/** Parses a plain expression; null when it is not valid maths. */
export function parseExpr(plain: string): Expr | null {
  try {
    const toks = tokenize(plain)
    if (!toks.length) return null
    const p = new Parser(toks)
    const e = p.parseExpr()
    return p.done ? e : null
  } catch {
    return null
  }
}

export function evalExpr(e: Expr, env: Record<string, number>): number {
  switch (e.k) {
    case 'num':
      return e.v
    case 'var':
      return env[e.v] ?? NaN
    case 'neg':
      return -evalExpr(e.a, env)
    case 'fn': {
      const a = evalExpr(e.a, env)
      switch (e.f) {
        case 'sqrt':
          return Math.sqrt(a)
        case 'sin':
          return Math.sin((a * Math.PI) / 180)
        case 'cos':
          return Math.cos((a * Math.PI) / 180)
        case 'tan':
          return Math.tan((a * Math.PI) / 180)
        case 'log':
          return Math.log10(a)
        case 'ln':
          return Math.log(a)
        default:
          return Math.abs(a)
      }
    }
    case 'bin': {
      const a = evalExpr(e.a, env)
      const b = evalExpr(e.b, env)
      switch (e.op) {
        case '+':
          return a + b
        case '-':
          return a - b
        case '*':
          return a * b
        case '/':
          return a / b
        default:
          return Math.pow(a, b)
      }
    }
  }
}

export function variablesOf(e: Expr, into = new Set<string>()): Set<string> {
  if (e.k === 'var') into.add(e.v)
  else if (e.k === 'neg' || e.k === 'fn') variablesOf(e.a, into)
  else if (e.k === 'bin') {
    variablesOf(e.a, into)
    variablesOf(e.b, into)
  }
  return into
}

/* ---------------------------------------------------------------------------- equivalence */

/** Deterministic sample points (never 0, 1 or -1, which hide differences). */
const SAMPLES: number[][] = [
  [1.7, 2.3, 3.1, 0.6],
  [2.9, 0.8, 1.3, 2.2],
  [0.4, 3.6, 2.7, 1.9],
  [3.3, 1.2, 0.7, 3.4],
  [1.1, 2.8, 3.9, 0.5],
  [2.4, 3.1, 1.6, 2.6],
  [4.2, 0.9, 2.1, 1.4],
]

function envAt(vars: string[], n: number): Record<string, number> {
  const row = SAMPLES[n % SAMPLES.length]!
  const env: Record<string, number> = {}
  vars.forEach((v, i) => {
    env[v] = row[i % row.length]! + (Math.floor(n / SAMPLES.length) + 1) * 0.013 * (i + 1)
  })
  return env
}

function close(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= Math.max(tol, 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)))
}

/** Numeric / algebraic equivalence of two parsed expressions. */
export function exprEquivalent(a: Expr, b: Expr, tolerance = 0): boolean {
  const vars = [...new Set([...variablesOf(a), ...variablesOf(b)])].sort()
  if (vars.length === 0) return close(evalExpr(a, {}), evalExpr(b, {}), tolerance)
  let valid = 0
  for (let n = 0; n < 9; n++) {
    const env = envAt(vars, n)
    const x = evalExpr(a, env)
    const y = evalExpr(b, env)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    valid++
    if (!close(x, y, Math.max(tolerance, 1e-7 * Math.max(1, Math.abs(x), Math.abs(y)))))
      return false
  }
  return valid >= 3
}

export interface Relation {
  op: '=' | '<' | '>' | '<=' | '>=' | '!='
  lhs: Expr
  rhs: Expr
}

export type Parsed =
  { kind: 'expr'; e: Expr } | { kind: 'relation'; r: Relation } | { kind: 'list'; items: Parsed[] }

const REL_RE = /(<=|>=|!=|=|<|>)/

/** Splits on list separators: ", " ";" "atau" "dan" "or" "and"; never on a decimal comma. */
function splitList(plain: string): string[] {
  return plain
    .split(/\s*(?:;|,\s|\bdan\b|\batau\b|\bor\b|\band\b)\s*/i)
    .map((x) => x.trim())
    .filter(Boolean)
}

function parseOne(plain: string): Parsed | null {
  const m = REL_RE.exec(plain)
  if (m) {
    const [l, r] = [plain.slice(0, m.index), plain.slice(m.index + m[0].length)]
    if (REL_RE.test(r)) return null
    const lhs = parseExpr(l)
    const rhs = parseExpr(r)
    if (!lhs || !rhs) return null
    return { kind: 'relation', r: { op: m[0] as Relation['op'], lhs, rhs } }
  }
  const e = parseExpr(plain)
  return e ? { kind: 'expr', e } : null
}

/** `±` expands to two items. */
function expandPm(plain: string): string[] {
  if (!plain.includes('±')) return [plain]
  return [plain.replace('±', '+'), plain.replace('±', '-')].flatMap(expandPm)
}

export function parseAnswer(raw: string): Parsed | null {
  const plain = latexToPlain(raw)
    .replace(/^\$|\$$/g, '')
    .trim()
  if (!plain) return null
  const pieces = splitList(plain).flatMap(expandPm)
  if (pieces.length === 0) return null
  if (pieces.length === 1) return parseOne(pieces[0]!)
  const items: Parsed[] = []
  for (const p of pieces) {
    const one = parseOne(p)
    if (!one) return null
    items.push(one)
  }
  return { kind: 'list', items }
}

/** `x = 3` -> the value expression `3` (variable alone on the left, absent on the right). */
function valueOf(p: Parsed): Expr | null {
  if (p.kind === 'expr') return p.e
  if (p.kind === 'relation' && p.r.op === '=') {
    const lv = variablesOf(p.r.lhs)
    if (p.r.lhs.k === 'var' && !variablesOf(p.r.rhs).has(p.r.lhs.v)) return p.r.rhs
    if (p.r.rhs.k === 'var' && lv.size === 0) return p.r.lhs
    // `y = 2x + 3`: compare the right-hand side when the left is a single variable
    if (p.r.lhs.k === 'var') return p.r.rhs
  }
  return null
}

function diff(r: Relation): Expr {
  return { k: 'bin', op: '-', a: r.lhs, b: r.rhs }
}

/** f(p) / g(p) is the same constant at every sample point; returns that constant or null. */
function constantRatio(f: Expr, g: Expr): number | null {
  const vars = [...new Set([...variablesOf(f), ...variablesOf(g)])].sort()
  let ratio: number | null = null
  let valid = 0
  for (let n = 0; n < 9; n++) {
    const env = envAt(vars, n)
    const x = evalExpr(f, env)
    const y = evalExpr(g, env)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    if (Math.abs(y) < 1e-12) {
      if (Math.abs(x) < 1e-9) continue
      return null
    }
    valid++
    const q = x / y
    if (ratio === null) ratio = q
    else if (!close(q, ratio, 1e-7 * Math.max(1, Math.abs(q)))) return null
  }
  return valid >= 3 ? ratio : null
}

function flipOp(op: Relation['op']): Relation['op'] {
  return { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '=': '=', '!=': '!=' }[op] as Relation['op']
}

function parsedEquivalent(a: Parsed, b: Parsed, tolerance: number): boolean {
  if (a.kind === 'list' || b.kind === 'list') {
    const la = a.kind === 'list' ? a.items : [a]
    const lb = b.kind === 'list' ? b.items : [b]
    if (la.length !== lb.length) return false
    const used = new Set<number>()
    return la.every((x) => {
      const idx = lb.findIndex((y, i) => !used.has(i) && parsedEquivalent(x, y, tolerance))
      if (idx < 0) return false
      used.add(idx)
      return true
    })
  }
  if (a.kind === 'expr' && b.kind === 'expr') return exprEquivalent(a.e, b.e, tolerance)
  const va = valueOf(a)
  const vb = valueOf(b)
  if (va && vb) return exprEquivalent(va, vb, tolerance)
  if (a.kind === 'relation' && b.kind === 'relation') {
    const ra = a.r
    const rb = b.r
    const ratio = constantRatio(diff(ra), diff(rb))
    if (ratio === null || ratio === 0) return false
    if (ra.op === rb.op) return ratio > 0
    return flipOp(ra.op) === rb.op && ratio < 0
  }
  return false
}

/**
 * Whether two answers mean the same. Examples that are equivalent: `2x+6` and `2(x+3)`;
 * `0.5`, `1/2`, `\frac{1}{2}` and `50%`; `x=3` and `3`; `0,5` (comma decimal) and `0.5`.
 */
export function answersEquivalent(a: string, b: string, tolerance = 0): boolean {
  const pa = parseAnswer(a)
  const pb = parseAnswer(b)
  if (!pa || !pb) return false
  return parsedEquivalent(pa, pb, tolerance)
}

/** The numeric value of an answer without variables, or null. */
export function numericValue(raw: string): number | null {
  const p = parseAnswer(raw)
  if (!p) return null
  const e = p.kind === 'list' ? null : valueOf(p)
  if (!e || variablesOf(e).size) return null
  const v = evalExpr(e, {})
  return Number.isFinite(v) ? v : null
}

/* -------------------------------------------------------------------------------- units */

export function normaliseUnit(u: string): string {
  return latexToPlain(u)
    .toLowerCase()
    .replace(/[\s^(){}]/g, '')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/\\/g, '')
}

const CURRENCY = /^(rm)\s*(?=[\d.(-])/i

/**
 * Separates a trailing (or leading RM) unit from a final answer when the part expects `unit`.
 * `12 cm` -> `{ value: '12', unit: 'cm' }`.
 */
export function splitUnit(raw: string, expected?: string): { value: string; unit: string } {
  const text = raw.trim()
  if (!expected) return { value: text, unit: '' }
  const exp = normaliseUnit(expected)
  if (CURRENCY.test(text) && exp === 'rm') {
    return { value: text.replace(CURRENCY, '').trim(), unit: 'rm' }
  }
  // Longest suffix whose normalised form equals a unit-looking token.
  const m =
    /^(.*?[\d)}a-z])\s*((?:\\?[a-zA-Zµ°]+)(?:\s*(?:\^\s*[({]?\s*\d\s*[)}]?|[²³]|\d))?(?:\s*\/\s*\w+)?)\s*$/.exec(
      text,
    )
  if (
    m &&
    /^(cm|m|mm|km|kg|g|s|min|jam|rm|sen|ml|l|cm2|m2|cm3|m3|mm2|km2|kmj|m\/s|km\/j|km\/h|rad|unit|unit2|biji|orang|darjah)$/.test(
      normaliseUnit(m[2]!),
    )
  ) {
    return { value: m[1]!.trim(), unit: normaliseUnit(m[2]!) }
  }
  return { value: text, unit: '' }
}

/* --------------------------------------------------------------------------- final matching */

export interface FinalMatch {
  value: 'match' | 'mismatch' | 'unparseable' | 'empty'
  unit: 'ok' | 'missing' | 'wrong' | 'na'
}

/** Compares a student's final answer (and unit field) with a scheme final. */
export function matchFinal(
  studentFinal: string,
  studentUnit: string,
  key: { accept: string[]; tolerance?: number; unit?: string },
): FinalMatch {
  const raw = studentFinal.trim()
  if (!raw) return { value: 'empty', unit: key.unit ? 'missing' : 'na' }
  const { value, unit: inlineUnit } = splitUnit(latexToPlain(raw), key.unit)
  const given = studentUnit.trim() ? normaliseUnit(studentUnit) : inlineUnit
  const parsed = parseAnswer(value)
  if (!parsed) return { value: 'unparseable', unit: unitState(key.unit, given) }
  const ok = key.accept.some((k) => answersEquivalent(value, k, key.tolerance ?? 0))
  return { value: ok ? 'match' : 'mismatch', unit: unitState(key.unit, given) }
}

function unitState(expected: string | undefined, given: string): FinalMatch['unit'] {
  if (!expected) return 'na'
  if (!given) return 'missing'
  return normaliseUnit(expected) === normaliseUnit(given) ? 'ok' : 'wrong'
}

/* ----------------------------------------------------------------------- plain -> LaTeX */

/**
 * Converts friendly typing to LaTeX when the text has no LaTeX command yet:
 * `1/2` -> `\frac{1}{2}`, `x^2` -> `x^{2}`, `sqrt(3)` or `√3` -> `\sqrt{3}`, `*` -> `\times`.
 */
export function plainToLatex(input: string): string {
  if (!input || input.includes('\\')) return input
  let s = input
  s = s
    .replace(/√\s*\(([^()]*)\)/g, '\\sqrt{$1}')
    .replace(/√\s*(\d+(?:\.\d+)?|[a-zA-Z])/g, '\\sqrt{$1}')
  s = s.replace(/sqrt\(([^()]*)\)/g, '\\sqrt{$1}')
  s = s.replace(
    /(\d+(?:\.\d+)?|[a-zA-Z])\s*\/\s*(\d+(?:\.\d+)?|[a-zA-Z])(?![\w^])/g,
    '\\frac{$1}{$2}',
  )
  s = s.replace(/\^\s*\(([^()]*)\)/g, '^{$1}').replace(/\^\s*(-?\d+|[a-zA-Z])/g, '^{$1}')
  s = s
    .replace(/\*/g, '\\times ')
    .replace(/π/g, '\\pi ')
    .replace(/\bpi\b/g, '\\pi ')
  return s.replace(/\s{2,}/g, ' ').trim()
}
