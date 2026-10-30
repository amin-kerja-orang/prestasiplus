/**
 * Synthetic question pools (BJS-05). A pool is a PLANTED paper (one valid composition built from the
 * blueprint, so the instance is feasible by construction) plus a large random noise made of near misses,
 * out-of-quota units, defective questions and small stimulus groups. Fictitious data only.
 *
 * The planted paper is built from the blueprint, not from the solver, and is checked by the oracle
 * (`verifyComposition`) before it is used.
 */
import { mulberry32 } from '../../src/blueprint'
import type { FormOrigin, LeafFact, QuestionFacts, UnitFact } from '../../src/eligibility'
import type { StandardBlueprint, StandardSection, UnitKey } from '../../src/standard-model'
import { offeredMarks, perQuestionMarks, unitKeyOf } from '../../src/standard-model'
import { verifyComposition } from '../../src/verify'

interface Piece {
  key: UnitKey | 't1_t3'
  marks: number
  kbat: number
}

interface Planted {
  tp: number
  pieces: Piece[]
}

type Rnd = () => number
const int = (rnd: Rnd, lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))
const pick = <T>(rnd: Rnd, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!
function shuffle<T>(xs: T[], rnd: Rnd): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[xs[i], xs[j]] = [xs[j]!, xs[i]!]
  }
  return xs
}

const LEVEL_ORIGIN: Record<'T4' | 'T5', FormOrigin> = { T4: 't4', T5: 't5' }

export interface SyntheticPool {
  facts: QuestionFacts[]
  /** The planted composition, per section position (question ids in slot order). */
  planted: Map<number, string[]>
}

interface Slot {
  tpMin: number
  tpMax: number
  marksMin: number
  marksMax: number
  /** exact TP list for the group or null */
  tpList: number[] | null
}

function slotsOf(s: StandardSection, rnd: Rnd): Slot[] {
  const O = offeredMarks(s)
  const M = s.questionCount
  const fixed = perQuestionMarks(s)
  const groups = s.profile?.groups ?? [{ from: 1, to: M, tpMin: 1, tpMax: 6 }]
  const out: Slot[] = []
  for (const grp of groups) {
    const size = grp.to - grp.from + 1
    const counts = grp.tpCounts?.flatMap((c) => Array<number>(c.count).fill(c.tp)) ?? null
    const tpList = counts ? shuffle([...counts], rnd) : null
    for (let i = 0; i < size; i++)
      out.push({
        tpMin: grp.tpMin,
        tpMax: grp.tpMax,
        marksMin: fixed ?? grp.marksMin ?? Math.max(1, Math.floor(O / M / 2)),
        marksMax: fixed ?? grp.marksMax ?? Math.max(1, Math.ceil(O / M) * 2),
        tpList: tpList ? [tpList[i]!] : null,
      })
  }
  return out
}

/** One valid composition of a section, by construction. */
function plantSection(s: StandardSection, rnd: Rnd): Planted[] {
  const M = s.questionCount
  const O = offeredMarks(s)
  const slots = slotsOf(s, rnd)
  const lines = (s.quota?.lines ?? []).map((l) => ({ key: unitKeyOf(l.unit), value: l.value }))
  const basis = s.quota?.basis ?? 'questions'
  const placed: Piece[][] = slots.map(() => [])

  if (basis === 'questions') {
    const keys = shuffle(lines.flatMap((l) => Array<UnitKey>(l.value).fill(l.key)), rnd)
    if (keys.length === 0) for (let i = 0; i < M; i++) keys.push('u0')
    // marks per slot: lo + random distribution of the rest
    const marks = distribute(slots, O, rnd)
    keys.forEach((key, i) => placed[i]!.push({ key, marks: marks[i]!, kbat: 0 }))
  } else {
    plantMarksBasis(slots, lines, O, rnd, placed)
  }

  // KBAT: spread the exact total over the pieces (a piece may split into KBAT and non-KBAT leaves).
  let rem = s.kbatMarks ?? 0
  const all = shuffle(placed.flat(), rnd)
  for (const p of all) {
    if (rem <= 0) break
    const k = Math.min(rem, p.marks)
    p.kbat = k
    rem -= k
  }
  if (rem !== 0) throw new Error(`cannot plant KBAT ${s.kbatMarks} in section ${s.position}`)

  return slots.map((slot, i) => ({
    tp: slot.tpList ? slot.tpList[0]! : int(rnd, slot.tpMin, slot.tpMax),
    pieces: placed[i]!,
  }))
}

/** Slot marks inside the bands that add up to `total`. */
function distribute(slots: Slot[], total: number, rnd: Rnd): number[] {
  const m = slots.map((x) => x.marksMin)
  let rem = total - m.reduce((a, b) => a + b, 0)
  if (rem < 0) throw new Error('marks bands exceed the section marks')
  let guard = 0
  while (rem > 0) {
    const i = int(rnd, 0, slots.length - 1)
    if (m[i]! < slots[i]!.marksMax) {
      m[i]!++
      rem--
    }
    if (++guard > 100000) throw new Error('marks bands cannot reach the section marks')
  }
  return m
}

/** Marks-basis planting: whole lines as questions when the band allows it, the rest cut like a rope. */
function plantMarksBasis(
  slots: Slot[],
  lines: { key: UnitKey; value: number }[],
  O: number,
  rnd: Rnd,
  placed: Piece[][],
): void {
  for (let attempt = 0; attempt < 400; attempt++) {
    const open = lines.map((l) => ({ ...l }))
    const taken = new Array<boolean>(slots.length).fill(false)
    const result: Piece[][] = slots.map(() => [])
    for (const si of shuffle(slots.map((_, i) => i), rnd)) {
      const slot = slots[si]!
      const fit = open.filter((l) => l.value >= slot.marksMin && l.value <= slot.marksMax)
      if (fit.length === 0 || rnd() < 0.05) continue
      const l = pick(rnd, fit)
      result[si]!.push({ key: l.key, marks: l.value, kbat: 0 })
      taken[si] = true
      open.splice(open.indexOf(l), 1)
    }
    const freeIdx = slots.map((_, i) => i).filter((i) => !taken[i])
    const left = open.reduce((n, l) => n + l.value, 0)
    if (freeIdx.length === 0) {
      if (left === 0) {
        result.forEach((r, i) => placed[i]!.push(...r))
        return
      }
      continue
    }
    let marks: number[]
    try {
      marks = distribute(freeIdx.map((i) => slots[i]!), left, rnd)
    } catch {
      continue
    }
    // rope cut over the leftover lines
    const rope = shuffle([...open], rnd)
    let li = 0
    let used = 0
    freeIdx.forEach((si, k) => {
      let need = marks[k]!
      while (need > 0) {
        const l = rope[li]!
        const take = Math.min(need, l.value - used)
        result[si]!.push({ key: l.key, marks: take, kbat: 0 })
        need -= take
        used += take
        if (used === l.value) {
          li++
          used = 0
        }
      }
    })
    result.forEach((r, i) => placed[i]!.push(...r))
    return
  }
  throw new Error(`cannot plant marks-basis quota (O=${O})`)
}

/* ------------------------------------------------------------------------------ facts */

interface Maker {
  unitOf: (key: UnitKey | 't1_t3' | 'u0') => UnitFact | null
}

function leafOf(marks: number, tp: number, kbat: boolean, unit: UnitFact | null, rnd: Rnd, mcq: boolean): LeafFact {
  return {
    marks,
    mode: mcq ? 'mcq' : 'working',
    tp,
    kbat,
    hasKey: true,
    unit,
    formOrigin: unit ? LEVEL_ORIGIN[unit.level] : 't1_t3',
  }
}

function makeQuestion(
  id: string,
  pieces: Piece[],
  tp: number,
  maker: Maker,
  rnd: Rnd,
  extra: Partial<QuestionFacts> = {},
): QuestionFacts {
  const total = pieces.reduce((n, p) => n + p.marks, 0)
  const leaves: LeafFact[] = []
  let first = true
  for (const p of pieces) {
    const unit = maker.unitOf(p.key)
    const parts: [number, boolean][] = []
    if (p.kbat > 0) parts.push([p.kbat, true])
    if (p.marks - p.kbat > 0) parts.push([p.marks - p.kbat, false])
    for (const [m, k] of parts) {
      leaves.push(leafOf(m, first ? tp : int(rnd, Math.max(1, tp - 2), tp), k, unit, rnd, total === 1))
      first = false
    }
  }
  let big = pieces[0]!
  for (const p of pieces) if (p.marks > big.marks) big = p
  const primary = maker.unitOf(big.key)
  return {
    id,
    groupId: null,
    groupPosition: null,
    versionNo: 1,
    tagReview: false,
    unit: primary,
    formOrigin: primary ? LEVEL_ORIGIN[primary.level] : 't1_t3',
    pools: [],
    leaves,
    ...extra,
  }
}

/** Noise question resembling a slot of the section, with deliberate variation. */
function noiseQuestion(id: string, s: StandardSection, maker: Maker, allKeys: UnitKey[], rnd: Rnd, extra: Partial<QuestionFacts> = {}): QuestionFacts {
  const slots = slotsOf(s, rnd)
  const slot = pick(rnd, slots)
  const lines = s.quota?.lines ?? []
  const key: UnitKey | 't1_t3' = lines.length > 0 && rnd() < 0.85 ? unitKeyOf(pick(rnd, lines).unit) : pick(rnd, allKeys)
  const fixed = perQuestionMarks(s)
  const marks = fixed ?? (rnd() < 0.8 ? int(rnd, slot.marksMin, slot.marksMax) : int(rnd, 1, Math.max(2, slot.marksMax + 3)))
  const tp = rnd() < 0.85 ? int(rnd, slot.tpMin, slot.tpMax) : int(rnd, 1, 6)
  const kbat = rnd() < 0.5 ? 0 : rnd() < 0.5 ? marks : int(rnd, 0, marks)
  return makeQuestion(id, [{ key, marks, kbat }], tp, maker, rnd, extra)
}

export function syntheticPool(
  bp: StandardBlueprint,
  units: Map<UnitKey, UnitFact>,
  size: number,
  seed: number,
): SyntheticPool {
  const rnd = mulberry32(seed)
  const extraUnits: UnitFact[] = [
    { nodeId: 'X:T4:99.0', level: 'T4', code: '99.0' },
    { nodeId: 'X:T5:98.0', level: 'T5', code: '98.0' },
  ]
  const maker: Maker = {
    unitOf: (key) => {
      if (key === 't1_t3') return null
      if (key === 'u0') return { nodeId: 'U0', level: 'T4', code: '0.0' }
      return units.get(key) ?? extraUnits.find((u) => unitKeyOf({ kind: 'unit', nodeId: u.nodeId }) === key) ?? null
    },
  }
  const allKeys: UnitKey[] = [
    ...units.keys(),
    't1_t3',
    ...extraUnits.map((u) => unitKeyOf({ kind: 'unit', nodeId: u.nodeId })),
  ]
  const facts: QuestionFacts[] = []
  const planted = new Map<number, string[]>()
  let n = 0
  const sections = [...bp.sections].sort((a, b) => a.position - b.position)

  // Planted paper.
  for (const s of sections) {
    const plan = plantSection(s, rnd)
    const ids: string[] = []
    plan.forEach((p, i) => {
      const id = `P${s.position}-${i + 1}`
      facts.push(makeQuestion(id, p.pieces, p.tp, maker, rnd))
      ids.push(id)
    })
    planted.set(s.position, ids)
  }
  const bad = verifyComposition(
    bp,
    sections.map((s) => ({ position: s.position, questionIds: planted.get(s.position)! })),
    facts,
  )
  if (bad.length > 0) throw new Error(`planted paper violates the blueprint: ${JSON.stringify(bad.slice(0, 3))}`)

  // Noise.
  const weights = sections.map((s) => s.questionCount)
  const total = weights.reduce((a, b) => a + b, 0)
  const pickSection = () => {
    let r = rnd() * total
    for (let i = 0; i < sections.length; i++) {
      r -= weights[i]!
      if (r <= 0) return sections[i]!
    }
    return sections[0]!
  }
  while (facts.length < size) {
    const s = pickSection()
    const roll = rnd()
    const id = `N${n++}`
    if (roll < 0.04) {
      // defective: one of the five missing facts
      const f = noiseQuestion(id, s, maker, allKeys, rnd)
      const leaf = f.leaves[0]!
      const which = int(rnd, 0, 4)
      if (which === 0) {
        f.unit = null
        f.formOrigin = 't4'
        f.leaves = f.leaves.map((l) => ({ ...l, unit: null, formOrigin: 't4' }))
      } else if (which === 1) f.leaves = [{ ...leaf, tp: null }, ...f.leaves.slice(1)]
      else if (which === 2) f.tagReview = true
      else if (which === 3) f.leaves = [{ ...leaf, marks: null }, ...f.leaves.slice(1)]
      else f.leaves = [{ ...leaf, hasKey: false }, ...f.leaves.slice(1)]
      facts.push(f)
    } else if (roll < 0.1) {
      // small stimulus group of a shared unit
      const k = int(rnd, 2, 3)
      const gid = `SG${n}`
      const base = noiseQuestion('tmp', s, maker, allKeys, rnd)
      for (let i = 0; i < k; i++) {
        const member = noiseQuestion(`${id}-${i + 1}`, s, maker, allKeys, rnd, { groupId: gid, groupPosition: i + 1, groupSize: k })
        if (rnd() < 0.7) {
          member.unit = base.unit
          member.formOrigin = base.formOrigin
          member.leaves = member.leaves.map((l) => ({ ...l, unit: base.unit, formOrigin: base.formOrigin }))
        }
        facts.push(member)
      }
    } else {
      facts.push(noiseQuestion(id, s, maker, allKeys, rnd))
    }
  }
  return { facts, planted }
}
