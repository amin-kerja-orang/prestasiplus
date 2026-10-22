/**
 * Content of the PoC question pool (demo blocker found by the full-demo walkthrough, PR #88): published single-part
 * MCQs per subject and Tingkatan so the battle arena, the games and the practice and SPM draws have enough questions.
 *
 * Every item is generic, curriculum-plausible content written for this seed: computed exercises (the key is computed,
 * so it is correct by construction) and small fact tables (term -> meaning, event -> year, word -> antonym) turned into
 * questions in both directions. No exam paper text, no .cloud bank content, no person names. Pure functions of the
 * level: no randomness, no clock, so the pool is identical on every run.
 */

export type PoolSubject = 'BM' | 'BI' | 'MATH' | 'SCI' | 'SEJ' | 'PI' | 'PM' | 'ADDMATH' | 'PHY' | 'PSV'
export type PoolLevel = 'T4' | 'T5'

export interface PoolItem {
  /** Full question text in Bahasa Melayu (English for BI); stored as the stem AND the part prompt. */
  text: string
  /** Exactly four distinct options, in display order A to D. */
  options: [string, string, string, string]
  /** Index (0..3) of the correct option. */
  correct: 0 | 1 | 2 | 3
}

/** Subjects of the pool, in seed order: the subjects that carry a DSKP tag (unit and SP) at both Tingkatan 4 and 5. */
export const POOL_SUBJECTS: readonly PoolSubject[] = ['BM', 'BI', 'MATH', 'SCI', 'SEJ', 'PI', 'PM', 'ADDMATH', 'PHY', 'PSV']
export const POOL_LEVELS: readonly PoolLevel[] = ['T4', 'T5']

/**
 * Questions per subject and level. The largest consumer minimum at one level is a practice session of 20 (count
 * options 5/10/15/20); battle draws 10, Jutawan 15. 24 per level gives 48 SPM-pool MCQs per subject, above the SPM
 * mock paper 1 (30 items) and the default Latih Tubi / Tracking A set (40).
 */
export const POOL_PER_LEVEL = 24

// --------------------------------------------------------------------------------------------------------------------
// Builders
// --------------------------------------------------------------------------------------------------------------------

/** Places `right` at position `slot` among three wrong options; throws when the four are not distinct. */
export function item(text: string, right: string, wrong: readonly [string, string, string], slot: number): PoolItem {
  const options = [...wrong]
  const at = ((slot % 4) + 4) % 4
  options.splice(at, 0, right)
  if (new Set(options).size !== 4) throw new Error(`question pool: options are not distinct for "${text}": ${options.join(' | ')}`)
  return { text, options: options as PoolItem['options'], correct: at as PoolItem['correct'] }
}

/** Three wrong values for row `i` of a column: rows i+1, i+2, i+3 (mod n). The column values must be distinct. */
function others(values: readonly string[], i: number): [string, string, string] {
  const n = values.length
  return [values[(i + 1) % n] as string, values[(i + 2) % n] as string, values[(i + 3) % n] as string]
}

/**
 * Both directions of a one-to-one table: `forward(a)` asks for b, `backward(b)` asks for a. Wrong options come from
 * the other rows of the same column, so every question has exactly one correct option.
 */
export function table(
  rows: readonly (readonly [string, string])[],
  forward: (a: string) => string,
  backward: (b: string) => string,
  slot0 = 0,
  /** How a first-column value reads as an OPTION of a backward question (e.g. capitalised); questions use it raw. */
  asOption: (a: string) => string = (a) => a,
): PoolItem[] {
  const as = rows.map((r) => asOption(r[0]))
  const bs = rows.map((r) => r[1])
  if (new Set(as).size !== rows.length || new Set(bs).size !== rows.length) throw new Error('question pool: table is not one-to-one')
  const out: PoolItem[] = []
  rows.forEach(([a, b], i) => out.push(item(forward(a), b, others(bs, i), slot0 + i)))
  rows.forEach(([, b], i) => out.push(item(backward(b), as[i] as string, others(as, i), slot0 + i + 2)))
  return out
}

/** One direction of a table (the answer column may repeat; wrong options are the given fixed set minus the answer). */
export function oneWay(rows: readonly (readonly [string, string])[], ask: (a: string) => string, choices: readonly string[], slot0 = 0): PoolItem[] {
  return rows.map(([a, b], i) => {
    const wrong = choices.filter((c) => c !== b).slice(0, 3) as [string, string, string]
    return item(ask(a), b, wrong, slot0 + i)
  })
}

/** Rounded to 2 decimal places, so a computed distractor never renders as a long binary fraction. */
const round2 = (n: number): number => Math.round(n * 100) / 100
const num = (n: number): string => String(n).replace('-', '−')
/** A numeric question: the answer and three distinct wrong values (computed slips), formatted with `fmt`. */
export function numeric(text: string, right: number, wrong: readonly number[], slot: number, fmt: (n: number) => string = num): PoolItem {
  // Every value is rounded to 2 decimal places BEFORE the distinctness check and the formatter.
  const key = round2(right)
  const picked: number[] = []
  for (const w of [...wrong, right + 1, right - 1, right + 2, right * 2, right + 10].map(round2)) {
    if (w !== key && !picked.includes(w)) picked.push(w)
    if (picked.length === 3) break
  }
  return item(text, fmt(key), picked.map(fmt) as [string, string, string], slot)
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))
const frac = (p: number, q: number): string => {
  const g = gcd(p, q)
  return q / g === 1 ? String(p / g) : `${p / g}/${q / g}`
}
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1))
const nPr = (n: number, r: number): number => factorial(n) / factorial(n - r)
const nCr = (n: number, r: number): number => nPr(n, r) / factorial(r)

// --------------------------------------------------------------------------------------------------------------------
// Matematik
// --------------------------------------------------------------------------------------------------------------------

function mathT4(): PoolItem[] {
  const out: PoolItem[] = []
  // Asas nombor: base ten to base two.
  for (const [i, n] of [5, 9, 12, 19].entries()) {
    const bin = (k: number) => k.toString(2)
    out.push(item(`Tukarkan ${n} kepada nombor dalam asas dua.`, `${bin(n)}₂`, [`${bin(n + 1)}₂`, `${bin(n - 1)}₂`, `${bin(n + 2)}₂`], i))
  }
  // Persamaan kuadratik: roots of (x − a)(x − b) = 0.
  for (const [i, [a, b]] of ([[1, 4], [2, 5], [3, 6], [2, 7]] as const).entries()) {
    out.push(item(
      `Punca-punca bagi persamaan kuadratik x² − ${a + b}x + ${a * b} = 0 ialah`,
      `x = ${a} dan x = ${b}`,
      [`x = −${a} dan x = −${b}`, `x = ${a + 1} dan x = ${b - 1}`, `x = ${a} dan x = −${b}`],
      i + 1,
    ))
  }
  // Operasi set: n(A ∪ B) = n(A) + n(B) − n(A ∩ B).
  for (const [i, [a, b, c]] of ([[12, 9, 4], [15, 10, 6], [20, 14, 8], [18, 11, 5]] as const).entries()) {
    out.push(numeric(`Diberi n(A) = ${a}, n(B) = ${b} dan n(A ∩ B) = ${c}. Cari n(A ∪ B).`, a + b - c, [a + b, a + b + c, a - c], i + 2))
  }
  // Kebarangkalian: a bag of red and blue marbles.
  for (const [i, [r, bl]] of ([[3, 5], [4, 6], [2, 8], [5, 7]] as const).entries()) {
    out.push(item(
      `Sebuah beg mengandungi ${r} biji guli merah dan ${bl} biji guli biru. Sebiji guli dipilih secara rawak. Cari kebarangkalian guli merah dipilih.`,
      frac(r, r + bl),
      [frac(bl, r + bl), frac(r, bl), frac(1, r + bl)],
      i + 3,
    ))
  }
  // Sukatan serakan: range.
  for (const [i, data] of ([[4, 9, 2, 7, 5], [12, 8, 15, 10, 6], [21, 17, 25, 30, 19], [3, 11, 8, 14, 6]] as const).entries()) {
    const max = Math.max(...data)
    const min = Math.min(...data)
    out.push(numeric(`Cari julat bagi set data berikut: ${data.join(', ')}.`, max - min, [max, max + min, min], i))
  }
  // Matematik pengguna: simple interest I = Prt.
  for (const [i, [p, r, t]] of ([[1000, 5, 2], [2000, 4, 3], [5000, 3, 2], [1500, 6, 4]] as const).entries()) {
    const interest = (p * r * t) / 100
    out.push(numeric(
      `Sejumlah RM${p} disimpan dengan kadar faedah mudah ${r}% setahun selama ${t} tahun. Hitung faedah yang diperoleh, dalam RM.`,
      interest,
      [(p * r) / 100, interest + p, (p * r * (t + 1)) / 100],
      i + 1,
      (n) => `RM${n}`,
    ))
  }
  return out
}

function mathT5(): PoolItem[] {
  const out: PoolItem[] = []
  // Ubahan langsung: y = kx.
  for (const [i, [x1, y1, x2]] of ([[2, 6, 5], [3, 12, 7], [4, 10, 6], [5, 15, 8]] as const).entries()) {
    const k = y1 / x1
    out.push(numeric(`Diberi y berubah secara langsung dengan x dan y = ${y1} apabila x = ${x1}. Cari nilai y apabila x = ${x2}.`, k * x2, [y1 + x2, k * x2 + k, x2 * x1], i))
  }
  // Ubahan songsang: y = k/x.
  for (const [i, [x1, y1, x2]] of ([[2, 12, 4], [3, 8, 6], [4, 9, 12], [5, 6, 10]] as const).entries()) {
    const k = x1 * y1
    out.push(numeric(`Diberi y berubah secara songsang dengan x dan y = ${y1} apabila x = ${x1}. Cari nilai y apabila x = ${x2}.`, k / x2, [(y1 * x2) / x1, k, k / x2 + x1], i + 1))
  }
  // Matriks: determinant of a 2 × 2 matrix.
  for (const [i, [a, b, c, d]] of ([[3, 2, 1, 4], [5, 1, 2, 3], [4, 3, 2, 5], [6, 2, 3, 4]] as const).entries()) {
    out.push(numeric(`Cari penentu bagi matriks (${a} ${b}; ${c} ${d}), iaitu baris pertama ${a}, ${b} dan baris kedua ${c}, ${d}.`, a * d - b * c, [a * d + b * c, a * b - c * d, a + d], i + 2))
  }
  // Matriks: an element of the sum of two matrices.
  for (const [i, [a, b, p, q]] of ([[2, 5, 3, 1], [4, 1, 2, 6], [7, 3, 1, 4], [5, 2, 6, 3]] as const).entries()) {
    out.push(numeric(`Diberi P = (${a} ${b}) dan Q = (${p} ${q}), iaitu matriks 1 × 2. Cari unsur kedua bagi P + Q.`, b + q, [a + p, b * q, b - q], i + 3))
  }
  // Nisbah trigonometri: special angles.
  const trig: [string, string][] = [['sin 30°', '1/2'], ['cos 60°', '1/2'], ['tan 45°', '1'], ['sin 90°', '1'], ['cos 90°', '0'], ['sin 60°', '√3/2']]
  const trigChoices = ['1/2', '1', '0', '√3/2', '√2/2']
  trig.forEach(([e, v], i) => out.push(item(`Nilai bagi ${e} ialah`, v, trigChoices.filter((c) => c !== v).slice(0, 3) as [string, string, string], i)))
  // Sukatan kecenderungan memusat: mean.
  for (const [i, data] of ([[4, 6, 8, 10], [3, 5, 7, 9, 11]] as const).entries()) {
    const sum = data.reduce((s, x) => s + x, 0)
    out.push(numeric(`Cari min bagi set data berikut: ${data.join(', ')}.`, sum / data.length, [sum, sum / data.length + 1, Math.max(...data)], i + 2))
  }
  return out
}

// --------------------------------------------------------------------------------------------------------------------
// Matematik Tambahan
// --------------------------------------------------------------------------------------------------------------------

function addmathT4(): PoolItem[] {
  const out: PoolItem[] = []
  // Fungsi gubahan: fg(x) at a point.
  for (const [i, [a, b, c, d, x]] of ([[2, 1, 3, 0, 1], [3, -1, 1, 2, 2], [1, 4, 2, 1, 3], [2, 3, 1, -1, 4]] as const).entries()) {
    const g = c * x + d
    const fg = a * g + b
    const sign = (n: number) => (n < 0 ? ` − ${-n}` : n === 0 ? '' : ` + ${n}`)
    out.push(numeric(`Diberi f(x) = ${a === 1 ? '' : a}x${sign(b)} dan g(x) = ${c === 1 ? '' : c}x${sign(d)}. Cari nilai fg(${x}).`, fg, [c * (a * x + b) + d, a * x + b + g, g], i))
  }
  // Logaritma.
  for (const [i, [base, k]] of ([[2, 5], [3, 4], [5, 3], [10, 3]] as const).entries()) {
    const sub = String(base).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)] as string)
    out.push(numeric(`Nilai bagi log${base === 10 ? '' : sub} ${base ** k} ialah`, k, [k + 1, k - 1, base], i + 1))
  }
  // Indeks: 2^a × 2^b.
  for (const [i, [a, b]] of ([[3, 4], [5, 2], [6, 3], [4, 4]] as const).entries()) {
    out.push(item(`Ringkaskan 2^${a} × 2^${b}.`, `2^${a + b}`, [`2^${a * b}`, `4^${a + b}`, `2^${a + b + 1}`], i + 2))
  }
  // Janjang aritmetik: T_n = a + (n − 1)d.
  for (const [i, [a, d, n]] of ([[3, 4, 10], [5, 3, 12], [2, 6, 8], [7, 5, 9]] as const).entries()) {
    const t = a + (n - 1) * d
    out.push(numeric(`Sebutan pertama suatu janjang aritmetik ialah ${a} dan beza sepunyanya ialah ${d}. Cari sebutan ke-${n}.`, t, [a + n * d, a * n, n * d], i + 3))
  }
  // Janjang geometri: T_n = a r^(n − 1).
  for (const [i, [a, r, n]] of ([[2, 3, 4], [3, 2, 5], [1, 4, 4], [5, 2, 4]] as const).entries()) {
    const t = a * r ** (n - 1)
    out.push(numeric(`Sebutan pertama suatu janjang geometri ialah ${a} dan nisbah sepunyanya ialah ${r}. Cari sebutan ke-${n}.`, t, [a * r ** n, a * r * (n - 1), t / r], i))
  }
  // Geometri koordinat: distance between two points (Pythagorean triples).
  for (const [i, [x1, y1, dx, dy]] of ([[1, 2, 3, 4], [2, 1, 6, 8], [0, 3, 5, 12], [1, 1, 8, 6]] as const).entries()) {
    const d = Math.sqrt(dx * dx + dy * dy)
    out.push(numeric(`Cari jarak di antara titik (${x1}, ${y1}) dengan titik (${x1 + dx}, ${y1 + dy}).`, d, [dx + dy, d + 1, Math.abs(dy - dx)], i + 1, (n) => `${n} unit`))
  }
  return out
}

function addmathT5(): PoolItem[] {
  const out: PoolItem[] = []
  const pow = (k: number) => (k === 1 ? 'x' : `x^${k}`)
  // Pembezaan: d/dx (a x^n).
  for (const [i, [a, n]] of ([[3, 4], [5, 3], [2, 5], [4, 2]] as const).entries()) {
    out.push(item(`Bezakan ${a}${pow(n)} terhadap x.`, `${a * n}${pow(n - 1)}`, [`${a}${pow(n - 1)}`, `${a * n}${pow(n)}`, `${a * (n + 1)}${pow(n + 1)}`], i))
  }
  // Pengamiran: ∫ a x^n dx.
  for (const [i, [a, n]] of ([[6, 2], [8, 3], [10, 4], [12, 2]] as const).entries()) {
    const c = a / (n + 1)
    out.push(item(`Cari ∫ ${a}x^${n} dx.`, `${c}x^${n + 1} + c`, [`${a * n}${pow(n - 1)} + c`, `${a}x^${n + 1} + c`, `${c}${pow(n)} + c`], i + 1))
  }
  // Pilih atur.
  for (const [i, [n, r]] of ([[5, 2], [6, 3], [7, 2], [4, 3]] as const).entries()) {
    out.push(numeric(`Cari bilangan cara untuk menyusun ${r} daripada ${n} buah buku yang berlainan dalam satu baris.`, nPr(n, r), [nCr(n, r), n * r, nPr(n, r) + n], i + 2))
  }
  // Gabungan.
  for (const [i, [n, r]] of ([[6, 2], [7, 3], [8, 2], [5, 3]] as const).entries()) {
    out.push(numeric(`Cari bilangan cara untuk memilih ${r} orang murid daripada ${n} orang murid.`, nCr(n, r), [nPr(n, r), n * r, nCr(n, r) + n], i + 3))
  }
  // Sukatan membulat: arc length s = rθ.
  for (const [i, [r, theta]] of ([[5, 2], [8, 1.5], [6, 0.5], [10, 1.2]] as const).entries()) {
    const s = r * theta
    out.push(numeric(`Sebuah bulatan berjejari ${r} cm. Cari panjang lengkok yang mencangkum sudut ${theta} radian di pusat.`, s, [r + theta, (r * r * theta) / 2, 2 * r * theta], i, (n) => `${n} cm`))
  }
  // Pembezaan: gradient of y = x² + kx at x = a.
  for (const [i, [k, a]] of ([[3, 2], [5, 1], [-2, 4], [4, 3]] as const).entries()) {
    const term = k < 0 ? `− ${-k}x` : `+ ${k}x`
    out.push(numeric(`Cari kecerunan tangen kepada lengkung y = x² ${term} pada titik x = ${a}.`, 2 * a + k, [a * a + k * a, 2 * a, a + k], i + 1))
  }
  return out
}

// --------------------------------------------------------------------------------------------------------------------
// Fizik and Sains (computations take g = 10 m s⁻², stated in the question)
// --------------------------------------------------------------------------------------------------------------------

function phyT4(): PoolItem[] {
  const out: PoolItem[] = []
  for (const [i, [s, t]] of ([[100, 20], [240, 30], [150, 25], [360, 40]] as const).entries()) {
    out.push(numeric(`Sebuah troli bergerak sejauh ${s} m dalam masa ${t} s. Hitung laju purata troli itu.`, s / t, [s - t, s / t + 1, s / t + 2], i, (n) => `${n} m s⁻¹`))
  }
  for (const [i, [u, v, t]] of ([[0, 20, 4], [5, 25, 5], [10, 40, 5], [2, 18, 8]] as const).entries()) {
    const a = (v - u) / t
    out.push(numeric(`Halaju sebuah kereta bertambah daripada ${u} m s⁻¹ kepada ${v} m s⁻¹ dalam masa ${t} s. Hitung pecutan kereta itu.`, a, [v / t, (v + u) / t, a * 2], i + 1, (n) => `${n} m s⁻²`))
  }
  for (const [i, [m, a]] of ([[2, 3], [5, 4], [10, 2], [8, 5]] as const).entries()) {
    out.push(numeric(`Hitung daya paduan yang diperlukan untuk memecutkan jisim ${m} kg dengan pecutan ${a} m s⁻².`, m * a, [m + a, m * a + m, m * a * 2], i + 2, (n) => `${n} N`))
  }
  for (const [i, m] of [3, 5, 12, 0.5].entries()) {
    out.push(numeric(`Hitung berat sebuah objek berjisim ${m} kg. (Ambil g = 10 m s⁻²)`, m * 10, [m, m * 9, m + 10], i + 3, (n) => `${n} N`))
  }
  for (const [i, [m, v]] of ([[2, 5], [4, 3], [0.5, 20], [6, 4]] as const).entries()) {
    out.push(numeric(`Hitung momentum sebuah objek berjisim ${m} kg yang bergerak dengan halaju ${v} m s⁻¹.`, m * v, [m + v, (m * v * v) / 2, m * v * 2], i, (n) => `${n} kg m s⁻¹`))
  }
  for (const [i, [m, c, dt]] of ([[2, 4200, 10], [1, 900, 20], [0.5, 4200, 40], [3, 400, 5]] as const).entries()) {
    out.push(numeric(`Hitung tenaga haba yang diperlukan untuk menaikkan suhu ${m} kg bahan dengan muatan haba tentu ${c} J kg⁻¹ °C⁻¹ sebanyak ${dt} °C.`, m * c * dt, [c * dt, m * c, m * c * dt * 2], i + 1, (n) => `${n} J`))
  }
  return out
}

function phyT5(): PoolItem[] {
  const out: PoolItem[] = []
  for (const [i, [f, a]] of ([[200, 4], [500, 2], [90, 3], [1200, 0.5]] as const).entries()) {
    out.push(numeric(`Satu daya ${f} N bertindak secara normal ke atas permukaan seluas ${a} m². Hitung tekanan yang dihasilkan.`, f / a, [f * a, f - a, f / a / 2], i, (n) => `${n} Pa`))
  }
  for (const [i, [v, cur]] of ([[12, 3], [6, 2], [9, 0.5], [24, 4]] as const).entries()) {
    out.push(numeric(`Beza keupayaan ${v} V merentasi sebuah perintang menghasilkan arus ${cur} A. Hitung rintangan perintang itu.`, v / cur, [v * cur, v - cur, v / cur + 1], i + 1, (n) => `${n} Ω`))
  }
  for (const [i, [v, cur]] of ([[240, 2], [12, 5], [6, 0.5], [230, 4]] as const).entries()) {
    out.push(numeric(`Sebuah alat elektrik disambungkan kepada bekalan ${v} V dan arus ${cur} A mengalir melaluinya. Hitung kuasa alat itu.`, v * cur, [v / cur, v + cur, v * cur * 2], i + 2, (n) => `${n} W`))
  }
  for (const [i, [h, rho]] of ([[2, 1000], [5, 1000], [3, 800], [0.5, 13600]] as const).entries()) {
    out.push(numeric(`Hitung tekanan cecair pada kedalaman ${h} m dalam cecair berketumpatan ${rho} kg m⁻³. (Ambil g = 10 m s⁻²)`, h * rho * 10, [h * rho, h * 10, h * rho * 100], i + 3, (n) => `${n} Pa`))
  }
  for (const [i, [r1, r2]] of ([[4, 6], [10, 5], [3, 9], [8, 12]] as const).entries()) {
    out.push(numeric(`Dua perintang ${r1} Ω dan ${r2} Ω disambungkan secara bersiri. Hitung rintangan berkesan.`, r1 + r2, [(r1 * r2) / (r1 + r2), r1 * r2, Math.abs(r2 - r1)], i, (n) => `${n} Ω`))
  }
  for (const [i, [p, t]] of ([[100, 60], [60, 120], [1000, 30], [500, 10]] as const).entries()) {
    out.push(numeric(`Sebuah alat berkuasa ${p} W digunakan selama ${t} s. Hitung tenaga elektrik yang digunakan.`, p * t, [p + t, p * t * 2, (p * t) / 10], i + 1, (n) => `${n} J`))
  }
  return out
}

function sciT4(): PoolItem[] {
  const out: PoolItem[] = []
  const units: [string, string][] = [
    ['daya', 'newton (N)'], ['tenaga', 'joule (J)'], ['kuasa', 'watt (W)'], ['tekanan', 'pascal (Pa)'], ['jisim', 'kilogram (kg)'],
    ['panjang', 'meter (m)'], ['masa', 'saat (s)'], ['suhu', 'kelvin (K)'], ['arus elektrik', 'ampere (A)'],
  ]
  out.push(...table(units, (q) => `Apakah unit SI bagi ${q}?`, (u) => `Unit ${u} ialah unit SI bagi kuantiti`))
  for (const [i, [m, v]] of ([[200, 50], [540, 200], [90, 30]] as const).entries()) {
    out.push(numeric(`Sebuah objek berjisim ${m} g mempunyai isi padu ${v} cm³. Hitung ketumpatan objek itu.`, m / v, [m * v, m - v, m / v + 1], i, (n) => `${n} g cm⁻³`))
  }
  for (const [i, [f, s]] of ([[20, 5], [50, 4], [15, 10]] as const).entries()) {
    out.push(numeric(`Satu daya ${f} N menolak sebuah kotak sejauh ${s} m pada arah daya itu. Hitung kerja yang dilakukan.`, f * s, [f + s, f / s, f * s * 2], i + 1, (n) => `${n} J`))
  }
  return out
}

function sciT5(): PoolItem[] {
  const out: PoolItem[] = []
  const symbols: [string, string][] = [
    ['natrium', 'Na'], ['kalium', 'K'], ['ferum', 'Fe'], ['kuprum', 'Cu'], ['argentum', 'Ag'], ['aurum', 'Au'],
    ['plumbum', 'Pb'], ['stanum', 'Sn'], ['merkuri', 'Hg'], ['zink', 'Zn'], ['kalsium', 'Ca'], ['magnesium', 'Mg'],
  ]
  out.push(...table(symbols, (e) => `Apakah simbol bagi unsur ${e}?`, (s) => `Simbol ${s} mewakili unsur`))
  return out
}

// --------------------------------------------------------------------------------------------------------------------
// Bahasa Melayu and English
// --------------------------------------------------------------------------------------------------------------------

function bmT4(): PoolItem[] {
  const antonyms: [string, string][] = [
    ['tinggi', 'rendah'], ['tua', 'muda'], ['besar', 'kecil'], ['cepat', 'lambat'], ['kaya', 'miskin'], ['rajin', 'malas'],
    ['terang', 'gelap'], ['panas', 'sejuk'], ['mudah', 'sukar'], ['luas', 'sempit'], ['tebal', 'nipis'], ['berat', 'ringan'],
  ]
  return table(antonyms, (a) => `Apakah antonim bagi perkataan '${a}'?`, (b) => `Perkataan '${b}' ialah antonim bagi perkataan`)
}

function bmT5(): PoolItem[] {
  const synonyms: [string, string][] = [
    ['bijak', 'pandai'], ['cantik', 'jelita'], ['gembira', 'riang'], ['sedih', 'pilu'], ['marah', 'berang'], ['takut', 'gentar'],
    ['cepat', 'pantas'], ['kuat', 'gagah'], ['letih', 'penat'], ['sukar', 'payah'], ['hadiah', 'ganjaran'], ['rumah', 'kediaman'],
  ]
  return table(synonyms, (a) => `Apakah sinonim bagi perkataan '${a}'?`, (b) => `Perkataan '${b}' ialah sinonim bagi perkataan`)
}

function biT4(): PoolItem[] {
  const verbs: [string, string][] = [
    ['go', 'went'], ['eat', 'ate'], ['write', 'wrote'], ['see', 'saw'], ['take', 'took'], ['give', 'gave'],
    ['run', 'ran'], ['swim', 'swam'], ['drink', 'drank'], ['sing', 'sang'], ['buy', 'bought'], ['teach', 'taught'],
  ]
  return table(verbs, (v) => `What is the past tense of the verb '${v}'?`, (p) => `'${p}' is the past tense of which verb?`)
}

function biT5(): PoolItem[] {
  const antonyms: [string, string][] = [
    ['increase', 'decrease'], ['accept', 'reject'], ['victory', 'defeat'], ['arrive', 'depart'], ['permanent', 'temporary'],
    ['maximum', 'minimum'], ['include', 'exclude'], ['rare', 'common'], ['success', 'failure'], ['export', 'import'],
    ['polite', 'rude'], ['ancient', 'modern'],
  ]
  return table(antonyms, (a) => `What is the antonym of '${a}'?`, (b) => `'${b}' is the antonym of`)
}

// --------------------------------------------------------------------------------------------------------------------
// Sejarah (events and years; no person names)
// --------------------------------------------------------------------------------------------------------------------

const sejYear = (clause: string) => `Pada tahun berapakah ${clause}?`
const sejEvent = (year: string) => `Peristiwa manakah yang berlaku pada tahun ${year}?`
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function sejT4(): PoolItem[] {
  const events: [string, string][] = [
    ['British membuka Pulau Pinang', '1786'],
    ['Perjanjian Inggeris-Belanda ditandatangani', '1824'],
    ['Negeri-Negeri Selat dibentuk', '1826'],
    ['Perjanjian Pangkor ditandatangani', '1874'],
    ['Negeri-Negeri Melayu Bersekutu dibentuk', '1896'],
    ['Perjanjian Bangkok ditandatangani antara British dengan Siam', '1909'],
    ['Perang Dunia Pertama meletus', '1914'],
    ['Perang Dunia Kedua meletus', '1939'],
    ['Jepun mula menduduki Tanah Melayu', '1941'],
    ['Jepun menyerah kalah dan Perang Dunia Kedua tamat', '1945'],
    ['Malayan Union diperkenalkan', '1946'],
    ['Persekutuan Tanah Melayu ditubuhkan', '1948'],
  ]
  return table(events, sejYear, sejEvent, 0, capitalise)
}

function sejT5(): PoolItem[] {
  const events: [string, string][] = [
    ['Melaka jatuh ke tangan Portugis', '1511'],
    ['Melaka jatuh ke tangan Belanda', '1641'],
    ['pilihan raya umum pertama Persekutuan Tanah Melayu diadakan', '1955'],
    ['Persekutuan Tanah Melayu mencapai kemerdekaan', '1957'],
    ['darurat ditamatkan secara rasmi', '1960'],
    ['Malaysia dibentuk', '1963'],
    ['Singapura keluar daripada Malaysia', '1965'],
    ['ASEAN ditubuhkan', '1967'],
    ['peristiwa 13 Mei berlaku', '1969'],
    ['Rukun Negara diisytiharkan', '1970'],
    ['Dasar Ekonomi Baru diperkenalkan', '1971'],
    ['Kuala Lumpur diisytiharkan sebagai Wilayah Persekutuan', '1974'],
  ]
  return table(events, sejYear, sejEvent, 0, capitalise)
}

// --------------------------------------------------------------------------------------------------------------------
// Pendidikan Islam (basic facts only)
// --------------------------------------------------------------------------------------------------------------------

function piT4(): PoolItem[] {
  const months: [string, string][] = [
    ['pertama', 'Muharam'], ['kedua', 'Safar'], ['ketiga', 'Rabiulawal'], ['keempat', 'Rabiulakhir'], ['kelima', 'Jamadilawal'],
    ['keenam', 'Jamadilakhir'], ['ketujuh', 'Rejab'], ['kelapan', 'Syaaban'], ['kesembilan', 'Ramadan'], ['kesepuluh', 'Syawal'],
    ['kesebelas', 'Zulkaedah'], ['kedua belas', 'Zulhijah'],
  ]
  return table(
    months,
    (n) => `Apakah nama bulan yang ${n} dalam kalendar Hijrah?`,
    (m) => `Bulan ${m} ialah bulan yang ke berapa dalam kalendar Hijrah?`,
  )
}

function piT5(): PoolItem[] {
  const out: PoolItem[] = []
  const rukunIman: [string, string][] = [
    ['pertama', 'Beriman kepada Allah'], ['kedua', 'Beriman kepada malaikat'], ['ketiga', 'Beriman kepada kitab-kitab'],
    ['keempat', 'Beriman kepada rasul-rasul'], ['kelima', 'Beriman kepada hari akhirat'], ['keenam', "Beriman kepada qada' dan qadar"],
  ]
  out.push(...table(rukunIman, (n) => `Apakah rukun iman yang ${n}?`, (r) => `'${r}' ialah rukun iman yang ke berapa?`))
  const rakaat: [string, string][] = [['Subuh', '2'], ['Zohor', '4'], ['Asar', '4'], ['Maghrib', '3'], ['Isyak', '4']]
  out.push(...oneWay(rakaat, (s) => `Berapakah bilangan rakaat solat fardu ${s}?`, ['2', '3', '4', '1'], 1))
  const facts: PoolItem[] = [
    numeric('Berapakah bilangan surah di dalam al-Quran?', 114, [112, 116, 110], 0),
    numeric('Berapakah bilangan juzuk di dalam al-Quran?', 30, [28, 32, 20], 1),
    numeric('Berapakah bilangan rukun iman?', 6, [5, 7, 4], 2),
    numeric('Berapakah bilangan rukun Islam?', 5, [6, 4, 7], 3),
    numeric('Berapakah bilangan solat fardu dalam sehari semalam?', 5, [3, 4, 6], 0),
    item('Umat Islam diwajibkan berpuasa sebulan pada bulan', 'Ramadan', ['Syawal', 'Rejab', 'Muharam'], 1),
    item('Hari Raya Aidilfitri disambut pada 1 haribulan', 'Syawal', ['Ramadan', 'Zulhijah', 'Muharam'], 2),
  ]
  out.push(...facts)
  return out
}

// --------------------------------------------------------------------------------------------------------------------
// Pendidikan Moral (values; no person names)
// --------------------------------------------------------------------------------------------------------------------

function pmT4(): PoolItem[] {
  const values: [string, string][] = [
    ['kejujuran', 'Bercakap benar dan tidak menipu dalam apa-apa keadaan'],
    ['kerajinan', 'Berusaha dengan tekun dan bersungguh-sungguh dalam melakukan sesuatu'],
    ['kerjasama', 'Bekerja bersama-sama untuk mencapai matlamat yang sama'],
    ['toleransi', 'Bertolak ansur dan menerima perbezaan orang lain'],
    ['berdikari', 'Melakukan sesuatu sendiri tanpa bergantung kepada orang lain'],
    ['kesyukuran', 'Berterima kasih atas nikmat dan bantuan yang diterima'],
    ['keberanian', 'Sanggup menghadapi cabaran dan risiko dengan yakin'],
    ['kesederhanaan', 'Tidak berlebih-lebihan dalam tindakan dan perbelanjaan'],
    ['bertanggungjawab', 'Melaksanakan tugas yang diamanahkan dengan sempurna'],
    ['keadilan', 'Memberikan layanan yang saksama kepada semua pihak'],
    ['patriotisme', 'Cinta dan taat setia kepada negara'],
    ['rasional', 'Berfikir berdasarkan alasan dan bukti yang munasabah'],
  ]
  return table(values, (v) => `Apakah maksud nilai ${v}?`, (d) => `${d}. Nilai ini ialah`)
}

function pmT5(): PoolItem[] {
  const scenes: [string, string][] = [
    ['kejujuran', 'Seorang murid memulangkan dompet yang dijumpainya kepada pemiliknya'],
    ['kerjasama', 'Penduduk kampung bergotong-royong membersihkan balai raya'],
    ['berdikari', 'Seorang murid asrama membasuh dan menggosok pakaiannya sendiri'],
    ['kesyukuran', 'Seorang murid mengucapkan terima kasih kepada gurunya selepas dibantu'],
    ['keberanian', 'Seorang pengawas menegur perbuatan buli walaupun berdepan risiko'],
    ['kesederhanaan', 'Seorang murid berbelanja mengikut keperluan dan tidak membazir'],
    ['bertanggungjawab', 'Ketua kelas memastikan kelas bersih sebelum pulang seperti yang diamanahkan'],
    ['patriotisme', 'Seorang murid mengibarkan Jalur Gemilang dengan bangga pada bulan kemerdekaan'],
    ['keadilan', 'Seorang guru membahagikan tugas sama rata kepada semua ahli kumpulan'],
    ['kerajinan', 'Seorang murid mengulang kaji pelajaran setiap malam dengan tekun'],
    ['baik hati', 'Seorang murid membantu warga emas melintas jalan tanpa mengharapkan balasan'],
    ['rasional', 'Seorang murid menyemak sumber dan bukti sebelum mempercayai sesuatu berita'],
  ]
  return table(
    scenes,
    (v) => `Situasi manakah yang menunjukkan nilai ${v}?`,
    (s) => `${s}. Nilai yang ditunjukkan ialah`,
  )
}

// --------------------------------------------------------------------------------------------------------------------
// Pendidikan Seni Visual
// --------------------------------------------------------------------------------------------------------------------

function psvT4(): PoolItem[] {
  const out: PoolItem[] = []
  const elements: [string, string][] = [
    ['garisan', 'Kesan tanda yang terhasil apabila satu titik digerakkan'],
    ['rupa', 'Kawasan dua dimensi yang mempunyai panjang dan lebar'],
    ['bentuk', 'Objek tiga dimensi yang mempunyai panjang, lebar dan tebal'],
    ['jalinan', 'Kesan sentuhan atau rasa pada permukaan sesuatu objek'],
    ['ruang', 'Kawasan atau jarak di sekeliling dan di antara objek'],
    ['warna', 'Kesan pantulan cahaya yang dapat dilihat oleh mata'],
    ['nilai', 'Darjah kecerahan dan kegelapan sesuatu warna atau ton'],
  ]
  out.push(...table(elements, (e) => `Apakah maksud unsur seni '${e}'?`, (d) => `${d}. Unsur seni ini ialah`))
  const mixes: [string, string][] = [['merah dan kuning', 'jingga'], ['kuning dan biru', 'hijau'], ['merah dan biru', 'ungu']]
  out.push(...oneWay(mixes, (m) => `Campuran warna ${m} menghasilkan warna`, ['jingga', 'hijau', 'ungu', 'coklat'], 1))
  const complements: [string, string][] = [['merah', 'hijau'], ['biru', 'jingga'], ['kuning', 'ungu']]
  out.push(...oneWay(complements, (c) => `Apakah warna pelengkap bagi warna ${c}?`, ['hijau', 'jingga', 'ungu', 'coklat'], 2))
  const primaryAsks = ['Antara berikut, yang manakah warna primer?', 'Warna manakah antara berikut tergolong dalam warna primer?', 'Pilih warna primer daripada senarai berikut.']
  for (const [i, p] of ['merah', 'kuning', 'biru'].entries()) {
    out.push(item(primaryAsks[i] as string, p, ['hijau', 'jingga', 'ungu'], i + 3))
  }
  out.push(item('Warna sekunder terhasil daripada campuran dua warna', 'primer', ['tertier', 'neutral', 'pelengkap'], 0))
  return out
}

function psvT5(): PoolItem[] {
  const out: PoolItem[] = []
  const principles: [string, string][] = [
    ['imbangan', 'Susunan unsur seni yang memberikan keseimbangan visual'],
    ['kontras', 'Perbezaan yang ketara antara unsur seni, contohnya warna gelap dengan cerah'],
    ['harmoni', 'Gabungan unsur seni yang serasi dan tidak bercanggah'],
    ['pergerakan', 'Kesan gerakan visual yang membawa mata ke seluruh karya'],
    ['penegasan', 'Bahagian yang menjadi tumpuan utama dalam sesebuah karya'],
    ['kepelbagaian', 'Penggunaan pelbagai unsur seni untuk mengelakkan kebosanan'],
    ['kesatuan', 'Hubungan antara unsur yang menjadikan karya kelihatan lengkap dan bersatu'],
    ['ritma dan pengulangan', 'Susunan unsur yang diulang secara tetap atau berselang-seli'],
  ]
  out.push(...table(principles, (p) => `Apakah maksud prinsip rekaan '${p}'?`, (d) => `${d}. Prinsip rekaan ini ialah`))
  const complements: [string, string][] = [['hijau', 'merah'], ['jingga', 'biru'], ['ungu', 'kuning']]
  out.push(...oneWay(complements, (c) => `Apakah warna pelengkap bagi warna ${c}?`, ['merah', 'biru', 'kuning', 'putih'], 1))
  const mixes: [string, string][] = [['jingga', 'merah dan kuning'], ['hijau', 'kuning dan biru'], ['ungu', 'merah dan biru']]
  out.push(...oneWay(mixes, (c) => `Warna ${c} terhasil daripada campuran warna`, ['merah dan kuning', 'kuning dan biru', 'merah dan biru', 'hitam dan putih'], 2))
  out.push(item('Antara berikut, yang manakah warna sejuk?', 'biru', ['merah', 'jingga', 'kuning'], 3))
  out.push(item('Antara berikut, yang manakah warna panas?', 'merah', ['biru', 'hijau', 'ungu'], 0))
  return out
}

// --------------------------------------------------------------------------------------------------------------------

const BANKS: Record<PoolSubject, Record<PoolLevel, () => PoolItem[]>> = {
  BM: { T4: bmT4, T5: bmT5 },
  BI: { T4: biT4, T5: biT5 },
  MATH: { T4: mathT4, T5: mathT5 },
  SCI: { T4: sciT4, T5: sciT5 },
  SEJ: { T4: sejT4, T5: sejT5 },
  PI: { T4: piT4, T5: piT5 },
  PM: { T4: pmT4, T5: pmT5 },
  ADDMATH: { T4: addmathT4, T5: addmathT5 },
  PHY: { T4: phyT4, T5: phyT5 },
  PSV: { T4: psvT4, T5: psvT5 },
}

/** Every item a bank defines for a subject and level (may exceed POOL_PER_LEVEL). */
export function poolBank(subject: PoolSubject, level: PoolLevel): PoolItem[] {
  return BANKS[subject][level]()
}

/** The POOL_PER_LEVEL items seeded for a subject and level, in seed order. */
export function poolItems(subject: PoolSubject, level: PoolLevel): PoolItem[] {
  const bank = poolBank(subject, level)
  if (bank.length < POOL_PER_LEVEL) throw new Error(`question pool: ${subject} ${level} defines ${bank.length} items, needs ${POOL_PER_LEVEL}`)
  return bank.slice(0, POOL_PER_LEVEL)
}

/** Natural key (`question_versions.number_label`) of item `index` (0-based); also used by the Darjah part (AZ-02). */
export const poolRef = (subject: string, level: string, index: number): string =>
  `SEED-POOL-${subject}-${level}-${String(index + 1).padStart(2, '0')}`
