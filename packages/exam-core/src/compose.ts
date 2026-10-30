/**
 * `composeStandardPaper` (architecture 5.2, 5.6, 5.7, 5.9): the generator of a paper that follows an exam
 * standard exactly, and `previewStandard`, the verdict of the "Pratonton kolam" screen from the same code.
 *
 * Attempts: the caller's seed in tightness order (unseen questions preferred), up to 2 restarts with another
 * section order and seed, then the REFERENCE attempt (seed 0, canonical section order, no unseen
 * preference). The preview runs only the reference attempt, so "Boleh dijana" guarantees that a generation
 * on the same pool succeeds at the latest in the reference attempt. Every produced paper is checked by the
 * independent oracle `verifyComposition` before it is returned.
 */
import { mulberry32 } from './blueprint'
import { excludedReport, type ExcludedReport, type QuestionFacts } from './eligibility'
import { arrangeSection } from './arrange'
import { buildSectionPool, makePoolContext, type PoolContext, type Relax } from './pool'
import { precheckPool, precheckSection, type SectionPrecheck } from './precheck'
import type { StandardShortage } from './shortage'
import {
  buildProblem,
  DEFAULT_BUDGET,
  Meter,
  shuffleInPlace,
  SOLVER_VERSION,
  solveSection,
  type Budget,
} from './solver'
import type { StandardBlueprint, StandardSection } from './standard-model'
import { validateBlueprint, type BlueprintWarning } from './validate'
import { buildStandardReport, verifyComposition, type ComposedSection, type StandardReport, type Violation } from './verify'

export { SOLVER_VERSION }

export interface ComposeOptions {
  /** Seed of the first attempt (the API derives it with `generationSeed`). */
  seed: number
  /** Question ids the caller has already been served (soft preference for unseen ones). */
  seen?: ReadonlySet<string>
  budget?: Partial<Budget>
  /** Millisecond clock; only used for the safety cap, never for a decision (determinism). */
  clock?: () => number
  /** Run only the reference attempt. */
  referenceOnly?: boolean
}

export type AttemptKind = 'seed' | 'restart' | 'reference'

export type ComposeOutcome =
  | { ok: true; sections: ComposedSection[]; report: StandardReport; attempt: AttemptKind; nodes: number }
  | { ok: false; reason: 'shortage'; shortages: StandardShortage[]; prechecks: SectionPrecheck[]; nodes: number }
  | { ok: false; reason: 'limit'; limitSections: { section?: string }[]; nodes: number }
  | { ok: false; reason: 'violation'; violations: Violation[]; seed: number; nodes: number }

const MAX_RESTARTS = 2

function mix(a: number, b: number): number {
  return (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0
}

const defaultClock = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()

type Failure =
  | { kind: 'shortage'; shortage: StandardShortage }
  | { kind: 'limit'; section: string }

type AttemptResult = { ok: true; ids: Map<number, string[]> } | ({ ok: false } & Failure)

interface Run {
  ctx: PoolContext
  bp: StandardBlueprint
  budget: Budget
  seen: ReadonlySet<string>
  clock: () => number
}

/** Probe (5.7): which constraint family blocks a section that passed every pre-check but has no solution. */
function probe(run: Run, s: StandardSection, used: ReadonlySet<string>, meter: Meter): StandardShortage | 'limit' {
  const base: StandardShortage = {
    section: s.label,
    kind: 'combination',
    need: s.questionCount,
    have: 0,
  }
  const families: Exclude<Relax, null>[] = []
  if (s.kbatMarks !== null && s.kbatMarks !== undefined) families.push('kbat')
  if (s.profile) families.push('tp')
  families.push('marks')
  if (s.quota) families.push('quota')
  let sawLimit = false
  for (const family of families) {
    const pool = buildSectionPool(run.ctx, s, { used, seen: run.seen, ignoreQuota: family === 'quota' })
    const slice = meter.slice(Math.max(1000, Math.floor(run.budget.section * 0.1)))
    const r = solveSection(buildProblem(s, pool, family), 0x51ed, slice)
    if (r.status === 'ok') return { ...base, have: pool.eligibleQuestions, blocking: family }
    if (r.status === 'limit') sawLimit = true
  }
  // A probe that ran out of budget proves nothing: say `limit`, never a fabricated combination.
  if (sawLimit) return 'limit'
  // Proven infeasible under every single relaxation: name the first applicable family.
  const pool = buildSectionPool(run.ctx, s, { used, seen: run.seen })
  return { ...base, have: pool.eligibleQuestions, blocking: families[0] ?? 'marks' }
}

/** Earlier section that used the most questions this section could have used (names the overlap). */
function culprit(run: Run, s: StandardSection, solved: Map<number, string[]>): string {
  const pool = buildSectionPool(run.ctx, s, {})
  const mine = new Set(pool.items.flatMap((i) => i.ids))
  let best: { label: string; n: number } | null = null
  for (const [pos, ids] of solved) {
    const n = ids.filter((id) => mine.has(id)).length
    const other = run.bp.sections.find((x) => x.position === pos)
    if (other && (best === null || n > best.n)) best = { label: other.label, n }
  }
  return best?.label ?? 'bahagian lain'
}

function attempt(
  run: Run,
  order: StandardSection[],
  attemptSeed: number,
  prefs: 'none' | 'soft' | 'strict',
  paper: { nodes: number; cap: number; timedOut?: boolean },
  deadline: number,
): AttemptResult {
  const used = new Set<string>()
  const solved = new Map<number, string[]>()
  for (const s of order) {
    const seed = mix(attemptSeed, s.position)
    const sectionMeter = new Meter(run.budget.section, paper, run.clock, deadline)
    let chosen: ReturnType<typeof solveSection> | null = null

    if (prefs === 'strict') {
      const p = buildSectionPool(run.ctx, s, { used, seen: run.seen, unseenOnly: true })
      if (p.eligibleQuestions < s.questionCount || precheckPool(s, p.items, p.eligibleQuestions, p.modeExcluded).failures.length > 0)
        return { ok: false, kind: 'shortage', shortage: { section: s.label, kind: 'count', need: s.questionCount, have: p.eligibleQuestions } }
      const r = solveSection(buildProblem(s, p), seed, sectionMeter)
      if (r.status === 'limit') return { ok: false, kind: 'limit', section: s.label }
      if (r.status !== 'ok') return { ok: false, kind: 'shortage', shortage: { section: s.label, kind: 'count', need: s.questionCount, have: p.eligibleQuestions } }
      chosen = r
    }
    if (!chosen && prefs === 'soft' && run.seen.size > 0) {
      const p1 = buildSectionPool(run.ctx, s, { used, seen: run.seen, unseenOnly: true })
      if (p1.eligibleQuestions >= s.questionCount && precheckPool(s, p1.items, p1.eligibleQuestions, p1.modeExcluded).failures.length === 0) {
        const slice = sectionMeter.slice(Math.floor(run.budget.section * 0.4))
        const r = solveSection(buildProblem(s, p1), seed, slice)
        if (r.status === 'ok') chosen = r
        else if (r.status === 'limit' && slice.hardHit()) return { ok: false, kind: 'limit', section: s.label }
      }
    }
    if (!chosen) {
      const pool = buildSectionPool(run.ctx, s, { used, seen: run.seen })
      const pre = precheckPool(s, pool.items, pool.eligibleQuestions, pool.modeExcluded)
      if (pre.failures.length > 0) {
        // It passed on the undepleted pool, so an earlier section used what it needs.
        return {
          ok: false,
          kind: 'shortage',
          shortage: { section: s.label, kind: 'overlap', need: s.questionCount, have: pool.eligibleQuestions, otherSection: culprit(run, s, solved) },
        }
      }
      const r = solveSection(buildProblem(s, pool), mix(seed, 1), sectionMeter)
      if (r.status === 'limit') return { ok: false, kind: 'limit', section: s.label }
      if (r.status === 'infeasible') {
        const alone = used.size === 0 ? null : solveSection(buildProblem(s, buildSectionPool(run.ctx, s, { seen: run.seen })), 0x51ed, sectionMeter.slice(Math.floor(run.budget.section * 0.1)))
        if (alone?.status === 'ok')
          return { ok: false, kind: 'shortage', shortage: { section: s.label, kind: 'overlap', need: s.questionCount, have: pool.eligibleQuestions, otherSection: culprit(run, s, solved) } }
        const p = probe(run, s, used, sectionMeter)
        if (p === 'limit') return { ok: false, kind: 'limit', section: s.label }
        return { ok: false, kind: 'shortage', shortage: p }
      }
      chosen = r
    }
    if (chosen.status !== 'ok') return { ok: false, kind: 'limit', section: s.label }
    const ids = arrangeSection(chosen.solution, mulberry32(mix(seed, 2)))
    for (const id of ids) used.add(id)
    solved.set(s.position, ids)
  }
  return { ok: true, ids: solved }
}

/** Sections sorted by tightness: smallest minimum slack first, ties by position. */
function tightnessOrder(sections: StandardSection[], pre: Map<number, SectionPrecheck>): StandardSection[] {
  return [...sections].sort((a, b) => (pre.get(a.position)?.minSlack ?? 0) - (pre.get(b.position)?.minSlack ?? 0) || a.position - b.position)
}

export function composeStandardPaper(
  bp: StandardBlueprint,
  candidates: readonly QuestionFacts[],
  opts: ComposeOptions,
): ComposeOutcome {
  const ctx = makePoolContext(candidates)
  const budget: Budget = { ...DEFAULT_BUDGET, ...opts.budget }
  const clock = opts.clock ?? defaultClock
  const seen = opts.seen ?? new Set<string>()
  const sections = [...bp.sections].sort((a, b) => a.position - b.position)
  const run: Run = { ctx, bp, budget, seen, clock }

  // 1. Necessary conditions on the undepleted pool; the first failing line of every failing section.
  const prechecks = sections.map((s) => precheckSection(ctx, s))
  const failing = prechecks.filter((p) => p.failures.length > 0)
  if (failing.length > 0)
    return { ok: false, reason: 'shortage', shortages: failing.map((p) => p.failures[0]!), prechecks, nodes: 0 }
  const preByPos = new Map(prechecks.map((p) => [p.position, p]))

  // 2. Attempts.
  const plan: { kind: AttemptKind; seed: number; order: StandardSection[]; prefs: 'none' | 'soft' | 'strict' }[] = []
  if (!opts.referenceOnly) {
    const orders = [tightnessOrder(sections, preByPos)]
    for (let r = 1; r <= MAX_RESTARTS; r++) orders.push(shuffleInPlace([...sections], mulberry32(mix(opts.seed, 100 + r))))
    const seeds = [opts.seed, mix(opts.seed, 1), mix(opts.seed, 2)]
    // Strict (all unseen) first on every order, so an all-unseen paper is found whenever one exists.
    if (seen.size > 0 && candidates.some((f) => seen.has(f.id)))
      orders.forEach((order, i) => plan.push({ kind: i === 0 ? 'seed' : 'restart', seed: seeds[i]!, order, prefs: 'strict' }))
    orders.forEach((order, i) => plan.push({ kind: i === 0 ? 'seed' : 'restart', seed: seeds[i]!, order, prefs: 'soft' }))
  }
  plan.push({ kind: 'reference', seed: 0, order: sections, prefs: 'none' })

  const start = clock()
  const earlyPaper: { nodes: number; cap: number; timedOut?: boolean } = { nodes: 0, cap: Math.floor(budget.paper / 2) }
  const refPaper: { nodes: number; cap: number; timedOut?: boolean } = { nodes: 0, cap: budget.paper }
  let nodes = 0
  let last: AttemptResult | null = null
  for (const step of plan) {
    const ref = step.kind === 'reference'
    const paper = ref ? refPaper : earlyPaper
    const deadline = ref ? clock() + budget.timeMs : start + budget.timeMs * 0.6
    const result = attempt(run, step.order, step.seed, step.prefs, paper, deadline)
    nodes = earlyPaper.nodes + refPaper.nodes
    last = result
    // The clock never changes a produced paper: a timeout stops everything instead of falling back.
    if (!result.ok && result.kind === 'limit' && paper.timedOut) break
    if (!result.ok) continue
    const composed: ComposedSection[] = sections.map((s) => ({ position: s.position, questionIds: result.ids.get(s.position)! }))
    const violations = verifyComposition(bp, composed, ctx.byId)
    if (violations.length > 0) return { ok: false, reason: 'violation', violations, seed: step.seed, nodes }
    const report = buildStandardReport(bp, composed, ctx.byId, { seed: opts.seed, solverVersion: SOLVER_VERSION })
    return { ok: true, sections: composed, report, attempt: step.kind, nodes }
  }
  if (last && !last.ok && last.kind === 'limit') return { ok: false, reason: 'limit', limitSections: [{ section: last.section }], nodes }
  if (last && !last.ok && last.kind === 'shortage')
    return { ok: false, reason: 'shortage', shortages: [last.shortage], prechecks, nodes }
  return { ok: false, reason: 'limit', limitSections: [{}], nodes }
}

/* --------------------------------------------------------------------------------- preview */

export interface StandardPreview {
  verdict: 'boleh' | 'tidak_boleh' | 'tidak_pasti'
  firstFailure: StandardShortage | null
  sections: SectionPrecheck[]
  excluded: ExcludedReport
  warnings: BlueprintWarning[]
}

/** "Pratonton kolam": pre-check tables plus the verdict of the reference attempt (same code as generation). */
export function previewStandard(
  bp: StandardBlueprint,
  candidates: readonly QuestionFacts[],
  opts: Pick<ComposeOptions, 'budget' | 'clock'> = {},
): StandardPreview {
  const ctx = makePoolContext(candidates)
  const sections = [...bp.sections].sort((a, b) => a.position - b.position).map((s) => precheckSection(ctx, s))
  const excluded = excludedReport(candidates)
  const warnings = validateBlueprint(bp).warnings
  const outcome = composeStandardPaper(bp, candidates, { seed: 0, referenceOnly: true, ...opts })
  if (outcome.ok) return { verdict: 'boleh', firstFailure: null, sections, excluded, warnings }
  if (outcome.reason === 'shortage')
    return { verdict: 'tidak_boleh', firstFailure: outcome.shortages[0] ?? null, sections, excluded, warnings }
  return { verdict: 'tidak_pasti', firstFailure: null, sections, excluded, warnings }
}
