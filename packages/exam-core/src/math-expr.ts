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
  // Thousands groupings first: "1 000" and "3,000" are 1000 and 3000 (a separator followed by
  // exactly three digits); "0,5" and "1,2345" stay decimal commas.
  s = s.replace(
    /(?<![\d.])(\d{1,3})((?:[ ,]\d{3})+)(?!\d)/g,
    (_m, a: string, rest: string) => a + rest.replace(/[ ,]/g, ''),
  )
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
      const m = /^\d+(?:\.\d+)?|^\.\d+/.exec(src.slice(i))
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
  const folded = foldMixed(toks)
  // Two numbers side by side ("1 000" that is not a grouping, "1.2.3") are unreadable, never a product.
  for (let k = 0; k + 1 < folded.length; k++) {
    if (folded[k]!.t === 'num' && folded[k + 1]!.t === 'num')
      throw new ParseError('adjacent numbers')
  }
  return folded
}

/** `1 1/2` is the mixed number (1 + 1/2); the folding keeps it from reading as 1 times 1/2. */
function foldMixed(toks: Tok[]): Tok[] {
  const out: Tok[] = []
  for (let i = 0; i < toks.length; i++) {
    const a = toks[i]
    const b = toks[i + 1]
    const op = toks[i + 2]
    const c = toks[i + 3]
    const prev = out[out.length - 1]
    if (
      a?.t === 'num' &&
      b?.t === 'num' &&
      op?.t === 'op' &&
      op.v === '/' &&
      c?.t === 'num' &&
      Number.isInteger(a.v) &&
      Number.isInteger(b.v) &&
      Number.isInteger(c.v) &&
      c.v > 0 &&
      b.v < c.v &&
      !(prev?.t === 'op' && prev.v === '^')
    ) {
      out.push({ t: 'op', v: '(' }, a, { t: 'op', v: '+' }, b, { t: 'op', v: '/' }, c, {
        t: 'op',
        v: ')',
      })
      i += 3
      continue
    }
    out.push(toks[i]!)
  }
  return out
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

/** Number of sample points per comparison. */
const SAMPLE_COUNT = 24

/**
 * Deterministic pseudo-random sample over negative and positive values (-8 to 24), so abs(x) and
 * x differ, and sqrt(x - 5) still finds points inside its domain. Values near 0 and +-1, which hide
 * differences, are nudged away.
 */
function sampleValue(n: number, i: number): number {
  let h = Math.imul(n + 1, 2654435761) ^ Math.imul(i + 7, 40503)
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
  const v = (h % 3200) / 100 - 8
  return Math.abs(v) < 0.4 || Math.abs(Math.abs(v) - 1) < 0.1 ? v + 0.77 : v
}

function envAt(vars: string[], n: number): Record<string, number> {
  const env: Record<string, number> = {}
  vars.forEach((v, i) => {
    env[v] = sampleValue(n, i)
  })
  return env
}

function close(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= Math.max(tol, 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)))
}

/** Numeric / algebraic equivalence of two parsed expressions. */
export function exprEquivalent(a: Expr, b: Expr, tolerance = 0): boolean {
  const vars = [...new Set([...variablesOf(a), ...variablesOf(b)])].sort()
  // Variable-free: the scheme tolerance applies. With variables only a relative tolerance does.
  if (vars.length === 0) return close(evalExpr(a, {}), evalExpr(b, {}), tolerance)
  let valid = 0
  for (let n = 0; n < SAMPLE_COUNT; n++) {
    const env = envAt(vars, n)
    const x = evalExpr(a, env)
    const y = evalExpr(b, env)
    const fx = Number.isFinite(x)
    const fy = Number.isFinite(y)
    if (!fx && !fy) continue
    if (fx !== fy) return false // different domains are different expressions
    valid++
    if (Math.abs(x - y) > 1e-9 + 1e-7 * Math.max(Math.abs(x), Math.abs(y))) return false
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

/** `x = 3`: a variable alone on one side and absent from the other. */
function assignment(p: Parsed): { name: string; value: Expr } | null {
  if (p.kind === 'relation' && p.r.op === '=') {
    const { lhs, rhs } = p.r
    if (lhs.k === 'var' && !variablesOf(rhs).has(lhs.v)) return { name: lhs.v, value: rhs }
    if (rhs.k === 'var' && !variablesOf(lhs).has(rhs.v)) return { name: rhs.v, value: lhs }
  }
  return null
}

/** The value expression of a plain expression or of `x = value` (the name is checked apart). */
function valueOf(p: Parsed): Expr | null {
  if (p.kind === 'expr') return p.e
  return assignment(p)?.value ?? null
}

function diff(r: Relation): Expr {
  return { k: 'bin', op: '-', a: r.lhs, b: r.rhs }
}

/** f(p) / g(p) is the same constant at every sample point; returns that constant or null. */
function constantRatio(f: Expr, g: Expr): number | null {
  const vars = [...new Set([...variablesOf(f), ...variablesOf(g)])].sort()
  let ratio: number | null = null
  let valid = 0
  for (let n = 0; n < SAMPLE_COUNT; n++) {
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
  const sa = assignment(a)
  const sb = assignment(b)
  // `x = 3` against `y = 3` is a different answer: the names must agree.
  if (sa && sb) return sa.name === sb.name && exprEquivalent(sa.value, sb.value, tolerance)
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

function numericOf(raw: string): number | null {
  const p = parseAnswer(raw)
  if (!p) return null
  const e = p.kind === 'list' ? null : valueOf(p)
  if (!e || variablesOf(e).size) return null
  const v = evalExpr(e, {})
  return Number.isFinite(v) ? v : null
}

/** The numeric value of an answer without variables, or null. "12 cm" and "RM12" read as 12. */
export function numericValue(raw: string): number | null {
  const direct = numericOf(raw)
  if (direct !== null) return direct
  const stripped = splitAnyUnit(latexToPlain(raw))
  return stripped.unit ? numericOf(stripped.value) : null
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

const UNIT_TOKENS =
  /^(cm|m|mm|km|kg|g|s|min|jam|rm|sen|ml|l|cm2|m2|cm3|m3|mm2|km2|kmj|m\/s|km\/j|km\/h|rad|unit|unit2|biji|orang|darjah)$/

/** A trailing known unit ("12 cm", "30cm^2") or null. */
function trailingUnit(text: string): { value: string; unit: string } | null {
  const m =
    /^(.*?[\d)}a-z])\s*((?:\\?[a-zA-Zµ°]+)(?:\s*(?:\^\s*[({]?\s*\d\s*[)}]?|[²³]|\d))?(?:\s*\/\s*\w+)?)\s*$/.exec(
      text,
    )
  if (m && UNIT_TOKENS.test(normaliseUnit(m[2]!))) {
    return { value: m[1]!.trim(), unit: normaliseUnit(m[2]!) }
  }
  return null
}

/** Strips a leading RM or a trailing known unit, whatever the part expects (for ECF values). */
export function splitAnyUnit(raw: string): { value: string; unit: string } {
  const text = raw.trim()
  if (CURRENCY.test(text)) return { value: text.replace(CURRENCY, '').trim(), unit: 'rm' }
  return trailingUnit(text) ?? { value: text, unit: '' }
}

/**
 * Separates a trailing (or leading RM) unit from a final answer when the part expects `unit`.
 * `12 cm` -> `{ value: '12', unit: 'cm' }`; `25%` with unit `%` -> `{ value: '25', unit: '%' }`.
 */
export function splitUnit(raw: string, expected?: string): { value: string; unit: string } {
  const text = raw.trim()
  if (!expected) return { value: text, unit: '' }
  const exp = normaliseUnit(expected)
  if (exp === '%' && text.endsWith('%')) return { value: text.slice(0, -1).trim(), unit: '%' }
  if (CURRENCY.test(text) && exp === 'rm') {
    return { value: text.replace(CURRENCY, '').trim(), unit: 'rm' }
  }
  return trailingUnit(text) ?? { value: text, unit: '' }
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
  // Fractions: operands are a number, a letter or one bracketed group (the keyboard inserts `()/()`).
  const operand = '(\\d+(?:\\.\\d+)?|[a-zA-Z]|\\([^()]*\\))'
  const unwrap = (x: string): string => (x.startsWith('(') ? x.slice(1, -1) : x)
  s = s.replace(
    new RegExp(`${operand}\\s*\\/\\s*${operand}(?![\\w^])`, 'g'),
    (_m, a: string, b: string) => `\\frac{${unwrap(a)}}{${unwrap(b)}}`,
  )
  s = s.replace(/\^\s*\(([^()]*)\)/g, '^{$1}').replace(/\^\s*(-?\d+|[a-zA-Z])/g, '^{$1}')
  s = s
    .replace(/\*|×/g, '\\times ')
    .replace(/÷/g, '\\div ')
    .replace(/≤/g, '\\le ')
    .replace(/≥/g, '\\ge ')
    .replace(/±/g, '\\pm ')
    .replace(/π/g, '\\pi ')
    .replace(/\bpi\b/g, '\\pi ')
  return s.replace(/\s{2,}/g, ' ').trim()
}

const SIMPLE = /^[A-Za-z0-9.]+$/
const wrap = (x: string): string => (SIMPLE.test(x) ? x : `(${x})`)

/**
 * The reverse, for showing a stored LaTeX answer in the friendly text box: students never see LaTeX
 * source. `\frac{1}{2}` -> `1/2`, `x^{2}` -> `x^2`, `\sqrt{3}` -> `√3`, `\times` -> `×`.
 */
export function latexToFriendly(latex: string): string {
  let s = latex
  for (let i = 0; i < 4; i++) {
    s = s.replace(
      /\\frac\{([^{}]*)\}\{([^{}]*)\}/g,
      (_m, a: string, b: string) => `${wrap(a)}/${wrap(b)}`,
    )
  }
  s = s
    .replace(/\\sqrt\{([^{}]*)\}/g, (_m, a: string) => (SIMPLE.test(a) ? `√${a}` : `√(${a})`))
    .replace(/\^\{([^{}]*)\}/g, (_m, a: string) =>
      SIMPLE.test(a) || /^-\d+$/.test(a) ? `^${a}` : `^(${a})`,
    )
    .replace(/\\left|\\right/g, '')
    .replace(/\\(times|cdot)\s?/g, '×')
    .replace(/\\div\s?/g, '÷')
    .replace(/\\pi\s?/g, 'π')
    .replace(/\\pm\s?/g, '±')
    .replace(/\\(le|leq)\s?/g, '≤')
    .replace(/\\(ge|geq)\s?/g, '≥')
    .replace(/\\%/g, '%')
    .replace(/\\,|\\ /g, ' ')
  return s
}
