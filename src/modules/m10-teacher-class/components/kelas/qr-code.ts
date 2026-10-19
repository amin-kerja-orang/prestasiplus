/**
 * Minimal QR Code encoder (ISO/IEC 18004) for the S4 quick-QR modal (FR-M10-30): byte mode,
 * error-correction level M, versions 1 to 10 (up to 213 bytes), mask chosen by the standard
 * penalty rules. Live draws the code with QRCode.js at runtime; this renders the same kind of
 * matrix from the class join URL, with no extra dependency. It is functional rendering of the join
 * data, not a generated media file (D22).
 *
 * `encodeQr(text)` returns the module matrix (`true` = dark). It throws `RangeError` when the
 * text does not fit version 10.
 */

/** Data codewords, EC codewords per block and block count per version, level M (index = version). */
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26] as const
const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5] as const

/** Alignment pattern centres per version. */
const ALIGNMENT: readonly (readonly number[])[] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
]

export const QR_MAX_VERSION = 10

const sizeOf = (version: number): number => version * 4 + 17

/** All codewords of a version (data + EC), after removing the function modules. */
function rawCodewords(version: number): number {
  let bits = (16 * version + 128) * version + 64
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2
    bits -= (25 * align - 10) * align - 55
    if (version >= 7) bits -= 36
  }
  return Math.floor(bits / 8)
}

const dataCodewords = (version: number): number =>
  rawCodewords(version) - (ECC_PER_BLOCK[version] ?? 0) * (NUM_BLOCKS[version] ?? 0)

/** The byte capacity of a version at level M. */
export function qrCapacity(version: number): number {
  const overhead = version >= 10 ? 20 : 12
  return Math.floor((dataCodewords(version) * 8 - overhead) / 8)
}

// --- Reed-Solomon over GF(256), polynomial 0x11D ----------------------------------------------

function gfMultiply(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}

function rsDivisor(degree: number): number[] {
  const result: number[] = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j] ?? 0, root)
      if (j + 1 < result.length) result[j] = (result[j] ?? 0) ^ (result[j + 1] ?? 0)
    }
    root = gfMultiply(root, 0x02)
  }
  return result
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result: number[] = new Array<number>(divisor.length).fill(0)
  for (const b of data) {
    const factor = b ^ (result.shift() ?? 0)
    result.push(0)
    divisor.forEach((coef, i) => {
      result[i] = (result[i] ?? 0) ^ gfMultiply(coef, factor)
    })
  }
  return result
}

// --- data bits -------------------------------------------------------------------------------

function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text))
}

function pushBits(bits: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1)
}

function dataBits(bytes: readonly number[], version: number): number[] {
  const bits: number[] = []
  pushBits(bits, 0b0100, 4) // byte mode
  pushBits(bits, bytes.length, version >= 10 ? 16 : 8)
  for (const b of bytes) pushBits(bits, b, 8)
  const capacityBits = dataCodewords(version) * 8
  pushBits(bits, 0, Math.min(4, capacityBits - bits.length))
  pushBits(bits, 0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) pushBits(bits, pad, 8)
  return bits
}

function toCodewords(bits: readonly number[]): number[] {
  const out: number[] = new Array<number>(bits.length / 8).fill(0)
  bits.forEach((bit, i) => {
    out[i >>> 3] = (out[i >>> 3] ?? 0) | (bit << (7 - (i & 7)))
  })
  return out
}

/** Splits into blocks, appends the EC codewords and interleaves (ISO 18004 §7.6). */
function interleave(data: readonly number[], version: number): number[] {
  const numBlocks = NUM_BLOCKS[version] ?? 1
  const eccLen = ECC_PER_BLOCK[version] ?? 10
  const raw = rawCodewords(version)
  const numShort = numBlocks - (raw % numBlocks)
  const shortLen = Math.floor(raw / numBlocks)
  const divisor = rsDivisor(eccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1))
    k += dat.length
    const ecc = rsRemainder(dat, divisor)
    if (i < numShort) dat.push(0) // placeholder, skipped when interleaving
    blocks.push(dat.concat(ecc))
  }
  const result: number[] = []
  for (let i = 0; i < (blocks[0]?.length ?? 0); i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) result.push(block[i] ?? 0)
    })
  }
  return result
}

// --- matrix ----------------------------------------------------------------------------------

class Matrix {
  readonly size: number
  readonly modules: boolean[][]
  readonly isFunction: boolean[][]

  constructor(readonly version: number) {
    this.size = sizeOf(version)
    this.modules = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    )
    this.isFunction = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    )
  }

  set(x: number, y: number, dark: boolean, isFn = true): void {
    const row = this.modules[y]
    const fn = this.isFunction[y]
    if (!row || !fn) return
    row[x] = dark
    if (isFn) fn[x] = true
  }

  get(x: number, y: number): boolean {
    return this.modules[y]?.[x] ?? false
  }

  drawFunctionPatterns(): void {
    const { size } = this
    for (let i = 0; i < size; i++) {
      this.set(6, i, i % 2 === 0)
      this.set(i, 6, i % 2 === 0)
    }
    this.drawFinder(3, 3)
    this.drawFinder(size - 4, 3)
    this.drawFinder(3, size - 4)
    const positions = ALIGNMENT[this.version] ?? []
    const last = positions.length - 1
    positions.forEach((cy, i) => {
      positions.forEach((cx, j) => {
        const corner = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)
        if (!corner) this.drawAlignment(cx, cy)
      })
    })
    this.drawFormat(0) // reserve the area
    this.drawVersion()
  }

  private drawFinder(cx: number, cy: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        const x = cx + dx
        const y = cy + dy
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
          this.set(x, y, dist !== 2 && dist !== 4)
        }
      }
    }
  }

  private drawAlignment(cx: number, cy: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
      }
    }
  }

  /** Level M has format bits `00`; `mask` is 0..7 (ISO 18004 §7.9). */
  drawFormat(mask: number): void {
    const data = mask // (M = 0b00) << 3 | mask
    let rem = data
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412
    const bit = (i: number): boolean => ((bits >>> i) & 1) !== 0
    const { size } = this
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(i))
    this.set(8, 7, bit(6))
    this.set(8, 8, bit(7))
    this.set(7, 8, bit(8))
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) this.set(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) this.set(8, size - 15 + i, bit(i))
    this.set(8, size - 8, true) // the always-dark module
  }

  private drawVersion(): void {
    if (this.version < 7) return
    let rem = this.version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (this.version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0
      const a = this.size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      this.set(a, b, dark)
      this.set(b, a, dark)
    }
  }

  drawCodewords(codewords: readonly number[]): void {
    let i = 0
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j
          const upward = ((right + 1) & 2) === 0
          const y = upward ? this.size - 1 - vert : vert
          if (!this.isFunction[y]?.[x] && i < codewords.length * 8) {
            const bit = (((codewords[i >>> 3] ?? 0) >>> (7 - (i & 7))) & 1) !== 0
            this.set(x, y, bit, false)
            i++
          }
        }
      }
    }
  }

  applyMask(mask: number): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.isFunction[y]?.[x]) continue
        let invert: boolean
        switch (mask) {
          case 0:
            invert = (x + y) % 2 === 0
            break
          case 1:
            invert = y % 2 === 0
            break
          case 2:
            invert = x % 3 === 0
            break
          case 3:
            invert = (x + y) % 3 === 0
            break
          case 4:
            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
            break
          case 5:
            invert = ((x * y) % 2) + ((x * y) % 3) === 0
            break
          case 6:
            invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
            break
          default:
            invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
        }
        if (invert) this.set(x, y, !this.get(x, y), false)
      }
    }
  }

  /** ISO 18004 §7.8.3 penalty score (lower is better). */
  penalty(): number {
    const { size } = this
    let result = 0
    const runPenalty = (line: boolean[]): number => {
      let score = 0
      let run = 1
      for (let i = 1; i <= line.length; i++) {
        if (i < line.length && line[i] === line[i - 1]) run++
        else {
          if (run >= 5) score += 3 + (run - 5)
          run = 1
        }
      }
      // finder-like 1:1:3:1:1 with 4 light modules either side
      for (let i = 0; i + 11 <= line.length; i++) {
        const w = line.slice(i, i + 11).map((v) => (v ? 1 : 0))
        const a = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]
        const b = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]
        if (w.every((v, k) => v === a[k]) || w.every((v, k) => v === b[k])) score += 40
      }
      return score
    }
    for (let y = 0; y < size; y++) result += runPenalty(this.modules[y] ?? [])
    for (let x = 0; x < size; x++) result += runPenalty(this.modules.map((row) => row[x] ?? false))
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = this.get(x, y)
        if (c === this.get(x + 1, y) && c === this.get(x, y + 1) && c === this.get(x + 1, y + 1)) {
          result += 3
        }
      }
    }
    let dark = 0
    for (const row of this.modules) for (const v of row) if (v) dark++
    const total = size * size
    result += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10
    return result
  }
}

/**
 * Encodes `text` (UTF-8, byte mode, level M) and returns the module matrix, `true` = dark. The
 * smallest version that fits is used; the quiet zone is left to the caller.
 */
export function encodeQr(text: string): boolean[][] {
  const bytes = utf8(text)
  let version = 1
  while (version <= QR_MAX_VERSION && qrCapacity(version) < bytes.length) version++
  if (version > QR_MAX_VERSION) throw new RangeError('QR text too long')

  const codewords = interleave(toCodewords(dataBits(bytes, version)), version)
  const matrix = new Matrix(version)
  matrix.drawFunctionPatterns()
  matrix.drawCodewords(codewords)

  let best = 0
  let bestScore = Number.POSITIVE_INFINITY
  for (let mask = 0; mask < 8; mask++) {
    matrix.applyMask(mask)
    matrix.drawFormat(mask)
    const score = matrix.penalty()
    if (score < bestScore) {
      best = mask
      bestScore = score
    }
    matrix.applyMask(mask) // XOR undoes it
  }
  matrix.applyMask(best)
  matrix.drawFormat(best)
  return matrix.modules.map((row) => [...row])
}
