/**
 * Section solver (architecture 5.5, ADR-0022): bounded exact branch and bound over question TYPES
 * `(unit signature, tp, marks, kbat)`, with forward checking, line-by-line placement and a seeded value
 * order. Stimulus groups are placed first (their members land on consecutive slots), singles are filled
 * after. The search is complete inside its node budget: `infeasible` is a proof (within the type model),
 * `limit` means the budget or the clock ran out.
 *
 * No failed-state memo: picks inside a line are made in a fixed (type, group) order and the next line
 * is a function of the state, so a state is never reached twice; a sound memo would only add cost.
 */
import {
  creditOf,
  groupSpecs,
  lineSpec,
  type GroupSpec,
  type Item,
  type LineSpec,
  type Relax,
  type SectionPool,
} from './pool'
import { mulberry32 } from './blueprint'
import { offeredMarks, type StandardSection, type UnitKey } from './standard-model'

export const SOLVER_VERSION = 'std-1'

/* ----------------------------------------------------------------------------- budget */

export const LIMIT = Symbol('generate-limit')

export class Meter {
  nodes = 0
  constructor(
    public cap: number,
    private readonly paper: { nodes: number; cap: number; timedOut?: boolean },
    private readonly clock: () => number,
    private readonly deadline: number,
    private readonly parent: Meter | null = null,
  ) {}

  tick(): void {
    this.nodes++
    this.paper.nodes++
    for (let m = this.parent; m; m = m.parent) m.nodes++
    if (this.nodes > this.cap || this.paper.nodes > this.paper.cap) throw LIMIT
    if ((this.nodes & 511) === 1 && this.clock() > this.deadline) {
      this.paper.timedOut = true
      throw LIMIT
    }
  }

  /** True when a cap of this meter, of an ancestor, of the paper or the clock is exhausted (not only a soft slice cap). */
  hardHit(): boolean {
    if (this.paper.nodes > this.paper.cap || this.clock() > this.deadline) return true
    if (this.nodes <= this.cap) return false
    return !this.parent || this.parent.nodes > this.parent.cap
  }

  /** A meter for part of the work: counts into this one, shares the paper counter and the clock. */
  slice(cap: number): Meter {
    return new Meter(Math.max(0, Math.min(cap, this.cap - this.nodes)), this.paper, this.clock, this.deadline, this)
  }
}

export interface Budget {
  /** Nodes per section [Default 150,000]. */
  section: number
  /** Nodes per paper attempt [Default 600,000]. */
  paper: number
  /** Wall-clock safety cap in ms [Default 2,000]. */
  timeMs: number
}

export const DEFAULT_BUDGET: Budget = { section: 150_000, paper: 600_000, timeMs: 2_000 }

/* ------------------------------------------------------------------------------ problem */

export interface QType {
  idx: number
  tp: number
  marks: number
  kbat: number
  /** [line, amount, line, amount, ...] */
  credit: number[]
  keys: UnitKey[]
  members: Item[]
  avail: number
  compat: boolean[]
}

export interface StimCandidate {
  /** A single multi-unit question handled like a unit placed up front (few of them), not as a type. */
  multi?: boolean
  item: Item
  credit: number[]
  marks: number
  kbat: number
}

export interface SectionProblem {
  section: StandardSection
  groups: GroupSpec[]
  lines: LineSpec
  types: QType[]
  stim: StimCandidate[]
  slots: number
  offered: number
  /** KBAT target or null when free. */
  kbat: number | null
  rFree: boolean
  tema: boolean
  /** Profile with more than one slot group: stimulus start slots matter. */
  fixedStarts: boolean
}

const MAX_MULTI_ITEMS = 40

const sumCredit = (parts: number[][]): number[] => {
  const m = new Map<number, number>()
  for (const c of parts) for (let i = 0; i < c.length; i += 2) m.set(c[i]!, (m.get(c[i]!) ?? 0) + c[i + 1]!)
  return [...m.entries()].sort((a, b) => a[0] - b[0]).flat()
}

export function buildProblem(section: StandardSection, pool: SectionPool, relax: Relax = null): SectionProblem {
  const groups = groupSpecs(section, relax)
  const lines = lineSpec(section, relax)
  const tema = section.profile?.kind === 'tema'
  const byKey = new Map<string, QType>()
  const types: QType[] = []
  const stim: StimCandidate[] = []
  // Multi-unit questions (credit on several quota lines) are few; deciding them first keeps every line
  // bound exact for the remaining single-line questions.
  let multiCount = 0
  for (const item of pool.items) if (item.size === 1 && creditOf(item.members[0]!, lines).length > 2) multiCount++
  for (const item of pool.items) {
    if (item.size > 1) {
      stim.push({
        item,
        credit: sumCredit(item.members.map((d) => creditOf(d, lines))),
        marks: item.marks,
        kbat: item.kbat,
      })
      continue
    }
    const d = item.members[0]!
    if (d.tp === null) continue
    const credit = creditOf(d, lines)
    if (credit.length === 0) continue
    if (credit.length > 2 && multiCount <= MAX_MULTI_ITEMS) {
      stim.push({ multi: true, item, credit, marks: item.marks, kbat: item.kbat })
      continue
    }
    const keys = Object.keys(d.unitMarks)
    const key = `${credit.join(',')}|${tema ? keys.join(',') : ''}|${d.tp}|${d.marks}|${d.kbatMarks}`
    let t = byKey.get(key)
    if (!t) {
      t = {
        idx: types.length,
        tp: d.tp,
        marks: d.marks,
        kbat: d.kbatMarks,
        credit,
        keys,
        members: [],
        avail: 0,
        compat: [],
      }
      byKey.set(key, t)
      types.push(t)
    }
    t.members.push(item)
    t.avail++
  }
  for (const t of types)
    t.compat = groups.map(
      (g) =>
        t.tp >= g.tpMin &&
        t.tp <= g.tpMax &&
        (g.counts === null || (g.counts[t.tp] ?? 0) > 0) &&
        t.marks >= g.mMin &&
        t.marks <= g.mMax &&
        (g.units === null || t.keys.every((k) => g.units!.has(k))),
    )
  return {
    section,
    groups,
    lines,
    types,
    stim,
    slots: section.questionCount,
    offered: offeredMarks(section),
    kbat: relax === 'kbat' ? null : section.kbatMarks,
    rFree: relax === 'marks',
    tema,
    fixedStarts: groups.length > 1,
  }
}

/* ------------------------------------------------------------------------------ solution */

export interface SectionSolution {
  problem: SectionProblem
  /** Placed singles: counts per (type, group). */
  picks: { type: number; group: number; count: number }[]
  /** Placed stimulus units with their first slot (1-based; free to move inside one group, see arrange). */
  stim: { cand: StimCandidate; start: number }[]
}

export type SolveResult = { status: 'ok'; solution: SectionSolution } | { status: 'infeasible' } | { status: 'limit' }

export function shuffleInPlace<T>(a: T[], rnd: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/* -------------------------------------------------------------------------------- search */

class Search {
  readonly G: number
  readonly L: number
  readonly slotsRem: Int32Array
  readonly tpRem: Int32Array
  readonly lineRem: Int32Array
  readonly used: Int32Array
  readonly supLine: Int32Array
  readonly supG: Int32Array
  readonly supGT: Int32Array
  readonly typesOfLine: number[][]
  readonly lineReach: Uint8Array[]
  private readonly maxCredit: number[]
  /** nk[l][a]: bitmask of the non-KBAT mark sums a set of questions of line l with credit sum `a` can have. */
  private readonly nk: Int32Array[] | null = null
  private readonly nkD: number = 0
  private readonly nkMask: number = 0
  private readonly singleCredit: boolean
  /** Extra line touches still available from multi-unit questions (each adds credit-lines - 1). */
  private multiLeft = 0
  /** Cheapest / dearest question marks per slot group over the placeable single types. */
  private readonly gMarksMin: number[] = []
  private readonly gMarksMax: number[] = []
  readonly freeSlot: boolean[]
  private readonly reach: Uint8Array | null
  private readonly rDim: number
  private readonly kDim: number
  private readonly kFree: boolean
  private readonly rFree: boolean
  R: number
  K: number
  totalSlots: number
  unsat = 0
  private readonly stack: number[] = []
  private placed: { cand: StimCandidate; start: number }[] = []

  constructor(
    private readonly P: SectionProblem,
    private readonly rnd: () => number,
    private readonly meter: Meter,
  ) {
    this.G = P.groups.length
    this.L = P.lines.keys.length
    this.slotsRem = Int32Array.from(P.groups.map((g) => g.size))
    this.tpRem = new Int32Array(this.G * 7)
    P.groups.forEach((g, gi) => {
      if (g.counts) for (let tp = 1; tp <= 6; tp++) this.tpRem[gi * 7 + tp] = g.counts[tp] ?? 0
    })
    this.lineRem = Int32Array.from(P.lines.values)
    this.used = new Int32Array(P.types.length)
    this.supLine = new Int32Array(this.L)
    this.supG = new Int32Array(this.G)
    this.supGT = new Int32Array(this.G * 7)
    for (const t of P.types) {
      for (let i = 0; i < t.credit.length; i += 2) this.supLine[t.credit[i]!]! += t.avail * t.credit[i + 1]!
      t.compat.forEach((c, g) => {
        if (!c) return
        this.supG[g]! += t.avail
        this.supGT[g * 7 + t.tp]! += t.avail
      })
    }
    this.R = P.offered
    this.K = P.kbat ?? 0
    this.rFree = P.rFree
    this.kFree = P.kbat === null
    this.totalSlots = P.slots
    this.freeSlot = new Array<boolean>(P.slots + 2).fill(true)
    for (let l = 0; l < this.L; l++) if (this.lineRem[l]! > 0) this.unsat++
    this.rDim = this.rFree ? 1 : P.offered + 1
    this.kDim = this.kFree ? 1 : (P.kbat ?? 0) + 1
    this.reach = this.buildReach()
    this.lineReach = this.buildLineReach()
    this.maxCredit = new Array<number>(this.L).fill(1)
    this.singleCredit = P.types.every((t) => t.credit.length === 2)
    for (let g = 0; g < this.G; g++) {
      let lo = Number.POSITIVE_INFINITY
      let hi = 0
      for (const t of P.types)
        if (t.compat[g]) {
          lo = Math.min(lo, t.marks)
          hi = Math.max(hi, t.marks)
        }
      // No single fits the group: leave it open (only stimulus units can fill it); the supply check decides.
      this.gMarksMin.push(Number.isFinite(lo) ? lo : 0)
      this.gMarksMax.push(Number.isFinite(lo) ? hi : 1e9)
    }
    for (const t of P.types) if (t.compat.some(Boolean) && t.credit.length > 2) this.multiLeft += t.avail * (t.credit.length / 2 - 1)
    const D0 = P.kbat === null || P.rFree ? -1 : P.offered - P.kbat
    if (
      D0 >= 0 &&
      D0 <= 30 &&
      P.lines.basis === 'marks' &&
      !P.lines.pseudo
    ) {
      this.nkD = D0
      this.nkMask = D0 >= 30 ? 0x7fffffff : (1 << (D0 + 1)) - 1
      const tables: Int32Array[] = []
      for (let l = 0; l < this.L; l++) {
        const top = P.lines.values[l] ?? 0
        const pairs = new Set<number>()
        // A line also credited by a multi-unit question is left loose (any non-KBAT sum): the bound stays sound.
        const loose = P.types.some((t) => t.compat.some(Boolean) && t.credit.length > 2 && t.credit.some((x, i) => i % 2 === 0 && x === l))
        for (const t of P.types)
          if (t.compat.some(Boolean) && t.credit.length === 2 && t.credit[0] === l && t.marks - t.kbat <= D0) pairs.add(t.credit[1]! * 1000 + (t.marks - t.kbat))
        const tab = new Int32Array(top + 1)
        tab[0] = 1
        for (let a = 1; a <= top; a++) {
          let bits = 0
          for (const p of pairs) {
            const c = Math.floor(p / 1000)
            const n = p % 1000
            if (c <= a) bits |= (tab[a - c]! << n) & this.nkMask
          }
          tab[a] = loose ? this.nkMask : bits
        }
        tables.push(tab)
      }
      this.nk = tables
    }
    for (const t of P.types)
      if (t.compat.some(Boolean))
        for (let i = 0; i < t.credit.length; i += 2)
          this.maxCredit[t.credit[i]!] = Math.max(this.maxCredit[t.credit[i]!]!, t.credit[i + 1]!)
    // Types of each line in a seeded order.
    this.typesOfLine = Array.from({ length: this.L }, () => [])
    for (const t of P.types)
      if (t.compat.some(Boolean)) for (let i = 0; i < t.credit.length; i += 2) this.typesOfLine[t.credit[i]!]!.push(t.idx)
    for (const list of this.typesOfLine) shuffleInPlace(list, rnd)
  }

  /** reach[c][r][k]: can c more questions add up to r marks and k KBAT marks (relaxation: any type, any group). */
  private buildReach(): Uint8Array | null {
    const P = this.P
    const cMax = P.slots
    const { rDim, kDim } = this
    if ((cMax + 1) * rDim * kDim > 8_000_000) return null
    const reach = new Uint8Array((cMax + 1) * rDim * kDim)
    const pairs = new Map<number, [number, number]>()
    for (const t of P.types)
      if (t.compat.some(Boolean)) {
        const m = this.rFree ? 0 : t.marks
        const k = this.kFree ? 0 : t.kbat
        pairs.set(m * 100003 + k, [m, k])
      }
    const list = [...pairs.values()]
    reach[0] = 1
    for (let c = 0; c < cMax; c++) {
      const base = c * rDim * kDim
      const next = (c + 1) * rDim * kDim
      for (let r = 0; r < rDim; r++)
        for (let k = 0; k < kDim; k++) {
          if (!reach[base + r * kDim + k]) continue
          for (const [m, kk] of list) {
            const r2 = r + m
            const k2 = k + kk
            if (r2 < rDim && k2 < kDim) reach[next + r2 * kDim + k2] = 1
          }
        }
    }
    return reach
  }

  /** lineReach[l][v]: v is a sum of credits of types of line l (unbounded). */
  private buildLineReach(): Uint8Array[] {
    const out: Uint8Array[] = []
    for (let l = 0; l < this.L; l++) {
      const top = this.P.lines.values[l] ?? 0
      const amounts = new Set<number>()
      for (const t of this.P.types) {
        if (!t.compat.some(Boolean)) continue
        for (let i = 0; i < t.credit.length; i += 2) if (t.credit[i] === l) amounts.add(t.credit[i + 1]!)
      }
      const r = new Uint8Array(top + 1)
      r[0] = 1
      for (let v = 1; v <= top; v++) for (const a of amounts) if (a <= v && r[v - a]) { r[v] = 1; break }
      out.push(r)
    }
    return out
  }

  private reachOk(c: number, r: number, k: number): boolean {
    if (c < 0) return false
    if (!this.reach) return true
    const rr = this.rFree ? 0 : r
    const kk = this.kFree ? 0 : k
    if (rr < 0 || kk < 0 || rr >= this.rDim || kk >= this.kDim) return false
    return this.reach[(c * this.rDim + rr) * this.kDim + kk] === 1
  }

  /* ------------------------------------------------------------------ state changes */

  private pickLine(): number {
    let best = -1
    let bestSlack = Number.POSITIVE_INFINITY
    for (let l = 0; l < this.L; l++) {
      if (this.lineRem[l]! <= 0) continue
      const slack = this.supLine[l]! - this.lineRem[l]!
      if (slack < bestSlack) {
        bestSlack = slack
        best = l
      }
    }
    return best
  }

  private bound(): boolean {
    if (this.totalSlots <= 0) return false
    if (!this.reachOk(this.totalSlots, this.R, this.K)) return false
    let need = 0
    for (let l = 0; l < this.L; l++) {
      const rem = this.lineRem[l]!
      if (rem <= 0) continue
      if (rem > this.supLine[l]! || !this.lineReach[l]![rem]) return false
      need += Math.ceil(rem / this.maxCredit[l]!)
    }
    // When every question credits one line, each open line still needs at least ceil(rem / biggest credit) questions.
    if (need > this.totalSlots + this.multiLeft) return false
    // Tight KBAT in a marks-basis section: the non-KBAT marks of the open lines must add up to the open deficit.
    if (this.nk) {
      const mask = this.nkMask
      let cur = 1
      for (let l = 0; l < this.L; l++) {
        const rem = this.lineRem[l]!
        if (rem <= 0) continue
        const row = this.nk[l]![rem]!
        let next = 0
        for (let m = 0; m <= this.nkD; m++) if ((row >>> m) & 1) next |= (cur << m) & mask
        cur = next
        if (cur === 0) return false
      }
      if (!((cur >>> (this.R - this.K)) & 1)) return false
    }
    if (!this.rFree) {
      // Per-slot-group marks interval: the remaining marks must fit between the cheapest and dearest fill.
      let lo = 0
      let hi = 0
      for (let g = 0; g < this.G; g++) {
        const r = this.slotsRem[g]!
        lo += r * this.gMarksMin[g]!
        hi += r * this.gMarksMax[g]!
      }
      if (this.R < lo || this.R > hi) return false
    }
    for (let g = 0; g < this.G; g++) {
      const need = this.slotsRem[g]!
      if (need <= 0) continue
      if (this.supG[g]! < need) return false
      if (this.P.groups[g]!.counts)
        for (let tp = 1; tp <= 6; tp++) {
          const want = this.tpRem[g * 7 + tp]!
          if (want > 0 && this.supGT[g * 7 + tp]! < want) return false
        }
    }
    return true
  }

  private creditFits(credit: number[]): boolean {
    for (let i = 0; i < credit.length; i += 2) if (credit[i + 1]! > this.lineRem[credit[i]!]!) return false
    return true
  }

  private place(t: QType, g: number): void {
    this.slotsRem[g]!--
    this.totalSlots--
    if (this.P.groups[g]!.counts) this.tpRem[g * 7 + t.tp]!--
    for (let i = 0; i < t.credit.length; i += 2) {
      const l = t.credit[i]!
      const a = t.credit[i + 1]!
      const was = this.lineRem[l]!
      this.lineRem[l] = was - a
      if (was > 0 && was - a === 0) this.unsat--
      this.supLine[l]! -= a
    }
    this.R -= t.marks
    this.K -= t.kbat
    this.used[t.idx]!++
    if (t.credit.length > 2) this.multiLeft -= t.credit.length / 2 - 1
    for (let g2 = 0; g2 < this.G; g2++)
      if (t.compat[g2]) {
        this.supG[g2]!--
        this.supGT[g2 * 7 + t.tp]!--
      }
    this.stack.push(t.idx, g)
  }

  private unplace(t: QType, g: number): void {
    this.stack.length -= 2
    this.slotsRem[g]!++
    this.totalSlots++
    if (this.P.groups[g]!.counts) this.tpRem[g * 7 + t.tp]!++
    for (let i = 0; i < t.credit.length; i += 2) {
      const l = t.credit[i]!
      const a = t.credit[i + 1]!
      const was = this.lineRem[l]!
      this.lineRem[l] = was + a
      if (was === 0 && a > 0) this.unsat++
      this.supLine[l]! += a
    }
    this.R += t.marks
    this.K += t.kbat
    this.used[t.idx]!--
    if (t.credit.length > 2) this.multiLeft += t.credit.length / 2 - 1
    for (let g2 = 0; g2 < this.G; g2++)
      if (t.compat[g2]) {
        this.supG[g2]!++
        this.supGT[g2 * 7 + t.tp]!++
      }
  }

  /* --------------------------------------------------------------------------- singles */

  private dfs(cl: number, ti: number, gi: number): boolean {
    this.meter.tick()
    if (this.unsat === 0)
      return this.totalSlots === 0 && (this.rFree || this.R === 0) && (this.kFree || this.K === 0)
    if (!this.bound()) return false
    if (this.lineRem[cl]! <= 0) {
      cl = this.pickLine()
      ti = 0
      gi = 0
    }
    const list = this.typesOfLine[cl]!
    const types = this.P.types
    for (let a = ti; a < list.length; a++) {
      const t = types[list[a]!]!
      if (this.used[t.idx]! >= t.avail) continue
      if (!this.creditFits(t.credit)) continue
      if (!this.rFree && t.marks > this.R) continue
      if (!this.kFree && t.kbat > this.K) continue
      if (!this.kFree && !this.rFree && t.marks - t.kbat > this.R - this.K) continue
      for (let g = a === ti ? gi : 0; g < this.G; g++) {
        if (!t.compat[g] || this.slotsRem[g]! <= 0) continue
        if (this.P.groups[g]!.counts && this.tpRem[g * 7 + t.tp]! <= 0) continue
        this.place(t, g)
        if (this.dfs(cl, a, g)) return true
        this.unplace(t, g)
      }
    }
    return false
  }

  runSingles(): boolean {
    if (this.unsat === 0) return this.totalSlots === 0 && (this.rFree || this.R === 0) && (this.kFree || this.K === 0)
    return this.dfs(this.pickLine(), 0, 0)
  }

  /* --------------------------------------------------------------------------- stimulus */

  private groupOfSlot(slot: number): number {
    const gs = this.P.groups
    for (let i = 0; i < gs.length; i++) if (slot >= gs[i]!.from && slot <= gs[i]!.to) return i
    return -1
  }

  /**
   * Feasible start slots for a stimulus unit in the current state. Never truncated. With one slot group the
   * lowest start is canonical (left-packing keeps the free slots contiguous). With several groups, starts that
   * consume the same groups are interchangeable only for the LAST unit of a plan (nothing else needs contiguous
   * free slots afterwards); earlier units keep every start, because where they sit changes how the free slots
   * fragment.
   */
  private starts(c: StimCandidate, last: boolean): number[] {
    const k = c.item.size
    if (!this.creditFits(c.credit)) return []
    if (!this.rFree && c.marks > this.R) return []
    if (!this.kFree && c.kbat > this.K) return []
    const out: number[] = []
    const sigs = new Set<string>()
    for (let s = 1; s + k - 1 <= this.P.slots; s++) {
      let ok = true
      const tally = new Map<number, number>()
      let sig = ''
      for (let i = 0; i < k && ok; i++) {
        const slot = s + i
        const g = this.groupOfSlot(slot)
        const d = c.item.members[i]!
        const grp = this.P.groups[g]
        if (!this.freeSlot[slot] || !grp || d.tp === null) {
          ok = false
          break
        }
        if (d.tp < grp.tpMin || d.tp > grp.tpMax || d.marks < grp.mMin || d.marks > grp.mMax) ok = false
        else if (grp.units && !Object.keys(d.unitMarks).every((u) => grp.units!.has(u))) ok = false
        else if (grp.counts) {
          const key = g * 7 + d.tp
          const used = (tally.get(key) ?? 0) + 1
          tally.set(key, used)
          if (used > this.tpRem[key]!) ok = false
        }
        sig += `${g},`
      }
      if (!ok) continue
      if (!this.P.fixedStarts) {
        out.push(s)
        break
      }
      if (last) {
        if (sigs.has(sig)) continue
        sigs.add(sig)
      }
      out.push(s)
    }
    return out
  }

  private applyStim(c: StimCandidate, start: number): void {
    const k = c.item.size
    for (let i = 0; i < k; i++) {
      const slot = start + i
      const g = this.groupOfSlot(slot)
      const d = c.item.members[i]!
      this.freeSlot[slot] = false
      this.slotsRem[g]!--
      this.totalSlots--
      if (this.P.groups[g]!.counts) this.tpRem[g * 7 + (d.tp ?? 0)]!--
    }
    for (let i = 0; i < c.credit.length; i += 2) {
      const l = c.credit[i]!
      const a = c.credit[i + 1]!
      const was = this.lineRem[l]!
      this.lineRem[l] = was - a
      if (was > 0 && was - a === 0) this.unsat--
    }
    this.R -= c.marks
    this.K -= c.kbat
    this.placed.push({ cand: c, start })
  }

  private undoStim(): void {
    const { cand: c, start } = this.placed.pop()!
    const k = c.item.size
    for (let i = 0; i < k; i++) {
      const slot = start + i
      const g = this.groupOfSlot(slot)
      const d = c.item.members[i]!
      this.freeSlot[slot] = true
      this.slotsRem[g]!++
      this.totalSlots++
      if (this.P.groups[g]!.counts) this.tpRem[g * 7 + (d.tp ?? 0)]!++
    }
    for (let i = 0; i < c.credit.length; i += 2) {
      const l = c.credit[i]!
      const a = c.credit[i + 1]!
      const was = this.lineRem[l]!
      this.lineRem[l] = was + a
      if (was === 0 && a > 0) this.unsat++
    }
    this.R += c.marks
    this.K += c.kbat
  }

  private groupMarkSums: Uint8Array[][] | null = null

  /**
   * Exact per-slot-group marks check, run once per stimulus plan (not per node): can the open slots of every
   * group be filled so that the remaining marks come out exactly (any availability, any line)?
   */
  private groupMarksOk(): boolean {
    if (this.rFree || this.R < 0) return this.R >= 0 || this.rFree
    const top = this.R
    const cap = this.P.offered
    if (!this.groupMarkSums) {
      this.groupMarkSums = this.P.groups.map((grp, g) => {
        const marks = [...new Set(this.P.types.filter((t) => t.compat[g]).map((t) => t.marks))]
        const tables: Uint8Array[] = [new Uint8Array(cap + 1)]
        tables[0]![0] = 1
        for (let r = 1; r <= grp.size; r++) {
          const next = new Uint8Array(cap + 1)
          const prev = tables[r - 1]!
          for (let v = 0; v <= cap; v++) if (prev[v]) for (const m of marks) if (v + m <= cap) next[v + m] = 1
          tables.push(next)
        }
        return tables
      })
    }
    let cur = new Uint8Array(top + 1)
    cur[0] = 1
    for (let g = 0; g < this.G; g++) {
      const r = this.slotsRem[g]!
      if (r === 0) continue
      const sums = this.groupMarkSums[g]![r]!
      // Groups with no single type can only be filled by stimulus units: leave them out of the check.
      if (!this.P.types.some((t) => t.compat[g])) return true
      const next = new Uint8Array(top + 1)
      for (let a = 0; a <= top; a++) if (cur[a]) for (let b = 0; a + b <= top; b++) if (sums[b]) next[a + b] = 1
      cur = next
    }
    return cur[top] === 1
  }

  /** Tries every plan of exactly `size` stimulus units (in a seeded order); true when singles then succeed. */
  private plans(order: StimCandidate[], from: number, size: number): boolean {
    this.meter.tick()
    if (size === 0) return this.groupMarksOk() && this.runSingles()
    for (let i = from; i < order.length; i++) {
      const c = order[i]!
      for (const s of shuffleInPlace(this.starts(c, size === 1), this.rnd)) {
        this.applyStim(c, s)
        if (this.plans(order, i + 1, size - 1)) return true
        this.undoStim()
      }
    }
    return false
  }

  get stimPlaced(): { cand: StimCandidate; start: number }[] {
    return this.placed
  }

  get singles(): number[] {
    return this.stack
  }

  private order: StimCandidate[] | null = null

  /** Tries the plans of exactly `size` stimulus units, then the singles. */
  runPlan(size: number): boolean {
    if (!this.order) {
      const all = shuffleInPlace([...this.P.stim], this.rnd)
      this.order = [...all.filter((c) => c.multi), ...all.filter((c) => !c.multi)]
    }
    return this.plans(this.order, 0, size)
  }

  /** Full run: plan sizes 0, 1, 2, ... until one yields a paper. */
  run(): boolean {
    if (this.P.stim.length === 0) return this.runSingles()
    const maxS = Math.min(this.P.stim.length, this.P.slots)
    for (let s = 0; s <= maxS; s++) if (this.runPlan(s)) return true
    return false
  }
}

const RESTART_CAPS = [2000, 4000, 8000, 16000, 32000]

/** Solves one section; deterministic for a given problem, seed and budget. */
export function solveSection(problem: SectionProblem, seed: number, meter: Meter): SolveResult {
  const rnd = mulberry32(seed)
  try {
    let search: Search | null = null
    // Soft preference: sometimes try a plan with one stimulus unit first, on a small slice of the budget.
    if (problem.stim.length > 0 && rnd() < 0.5) {
      const soft = meter.slice(Math.max(2000, Math.floor(meter.cap * 0.05)))
      try {
        const s = new Search(problem, rnd, soft)
        if (s.runPlan(1)) search = s
      } catch (e) {
        if (e !== LIMIT || soft.hardHit()) throw e
      }
    }
    // Restarts with growing caps cut off heavy-tailed searches; a run that finishes without hitting its cap
    // has explored the whole tree, so its failure is a proof of infeasibility.
    for (const cap of RESTART_CAPS) {
      if (search || meter.cap - meter.nodes <= cap * 2) break
      const soft = meter.slice(cap)
      try {
        const s = new Search(problem, rnd, soft)
        if (!s.run()) return { status: 'infeasible' }
        search = s
      } catch (e) {
        if (e !== LIMIT || soft.hardHit()) throw e
      }
    }
    if (!search) {
      search = new Search(problem, rnd, meter)
      if (!search.run()) return { status: 'infeasible' }
    }
    const counts = new Map<number, number>()
    const st = search.singles
    for (let i = 0; i < st.length; i += 2) {
      const key = st[i]! * 1000 + st[i + 1]!
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const picks = [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([key, count]) => ({ type: Math.floor(key / 1000), group: key % 1000, count }))
    return {
      status: 'ok',
      solution: { problem, picks, stim: search.stimPlaced.map((p) => ({ cand: p.cand, start: p.start })) },
    }
  } catch (e) {
    if (e === LIMIT) return { status: 'limit' }
    throw e
  }
}
