/**
 * Orchestration of the K1 draft script (slug `bijak-k1-papers`): plan from the stock, then (with --apply) create the
 * blueprints and DRAFT papers. It talks to the API only through the `Gateway` port, so the plan, the idempotence and the
 * output are unit-tested with an in-memory gateway (`gateway.ts` is the service-layer implementation).
 *
 * Output is aggregates only: counts per subject and level. Never a question text, a question id, a user, an e-mail.
 * Nothing here publishes: a paper is created as a draft and filled; Admin Pusat publishes after the human review.
 */
import { blueprintBody, K1_TARGETS, KERTAS, paperTitle, type K1Target } from './targets'
import { selectPapers, type Candidate } from './select'

export interface BlueprintInfo {
  /** Database source: `verified`, `spec` or `draft`. */
  source: string
  code: string
  sections: { ruleType: string; questionCount: number; markBudget: number | null }[]
}

export interface ExistingPaper {
  id: string
  title: string
  /** Database status: draft, ready, published, withdrawn. */
  status: string
  /** All placed question ids (decimal strings). */
  questionIds: string[]
}

/** An error of the script itself: its message is a fixed sentence without data and may be printed. */
export class ScriptError extends Error {}

export type BlueprintBody = ReturnType<typeof blueprintBody>

/** What the script needs from the API (service layer). */
export interface Gateway {
  /** The subject (BM name) or null when the curriculum has no such subject. */
  subject(code: string): Promise<{ name: string } | null>
  /** Eligible migrated MCQs of the subject, unordered. */
  eligible(code: string): Promise<Candidate[]>
  /** The active blueprint of the subject and kertas, or null. */
  blueprint(code: string, kertas: number): Promise<BlueprintInfo | null>
  /** Creates the blueprint (version 1), or adds a new version when `replace` (retires the active one). */
  writeBlueprint(body: BlueprintBody, replace: boolean): Promise<void>
  /** Curated papers of the subject and kertas, any status. */
  papers(code: string, kertas: number): Promise<ExistingPaper[]>
  /** Creates an empty draft from the active blueprint; answers the paper id and its section ids in order. */
  createPaper(code: string, kertas: number, title: string): Promise<{ id: string; sectionIds: string[] }>
  /** Sets the full ordered question list of one section of a draft. */
  fillSection(paperId: string, sectionId: string, questionIds: string[]): Promise<void>
  /** Section ids of an existing paper, in order. */
  sectionIds(paperId: string): Promise<string[]>
  /** How many of these drafts pass the publish check right now (the check the publish button runs). Null when not available. */
  draftsPassingCheck(paperIds: string[]): Promise<number | null>
}

export interface RunOptions {
  apply: boolean
  /** Papers per subject, 1 or 2. */
  sets: number
  /** Bijak subject codes to handle. */
  subjects: readonly string[]
  /** Paper code for Sains when neither the repo nor an existing blueprint gives one. */
  snCode?: string | undefined
  /** Add a new blueprint version when the active one does not fit (never over a Disahkan one). */
  replaceBlueprints: boolean
  /** Admin Pusat user id to attribute the audit rows to (default: the lowest-id active one). Used by the CLI, not by the plan. */
  actorId?: string | undefined
}

type BlueprintAction = 'keep' | 'create' | 'replace'
type PaperAction = 'create' | 'fill' | 'exists' | 'blocked'

export interface PaperPlan {
  n: number
  title: string
  ids: string[]
  action: PaperAction
  reason?: string
  /** Existing paper to resume or keep. */
  existingId?: string
}

export interface TargetPlan {
  subject: string
  name: string
  /** `ready`, `skipped` (nothing to do for a stated reason) or `blocked` (needs a human decision). */
  state: 'ready' | 'skipped' | 'blocked'
  reason?: string
  code: string | null
  stock: number
  stockByStratum: Record<string, number>
  pickedByStratum: Record<string, number>
  duplicatesDropped: number
  requestedSets: number
  builtSets: number
  blueprint: BlueprintAction
  body?: BlueprintBody
  papers: PaperPlan[]
}

const fits = (bp: BlueprintInfo, count: number): boolean =>
  (bp.source === 'spec' || bp.source === 'verified') &&
  bp.sections.length === 1 &&
  bp.sections[0]?.ruleType === 'all' &&
  bp.sections[0].questionCount === count &&
  (bp.sections[0].markBudget ?? bp.sections[0].questionCount) === count

/** Plans one subject. Pure given what the gateway returned. */
export function planTarget(
  t: K1Target,
  input: { name: string; candidates: Candidate[]; blueprint: BlueprintInfo | null; existing: ExistingPaper[] },
  opts: Pick<RunOptions, 'sets' | 'snCode' | 'replaceBlueprints'>,
): TargetPlan {
  const picked = selectPapers({ candidates: input.candidates, perPaper: t.count, sets: opts.sets, quota: t.quota })
  const base: TargetPlan = {
    subject: t.subject,
    name: input.name,
    state: 'ready',
    code: input.blueprint?.code ?? t.code ?? opts.snCode ?? null,
    stock: picked.stock,
    stockByStratum: picked.stockByStratum,
    pickedByStratum: picked.pickedByStratum,
    duplicatesDropped: picked.duplicatesDropped,
    requestedSets: opts.sets,
    builtSets: picked.papers.length,
    blueprint: 'keep',
    papers: [],
  }

  if (picked.papers.length === 0) {
    return { ...base, state: 'skipped', reason: `eligible stock ${String(picked.stock)} is below one paper (${String(t.count)})` }
  }

  // The blueprint decides whether a paper can be created at all.
  let blueprint: BlueprintAction = 'keep'
  const bp = input.blueprint
  if (bp === null) {
    const code = t.code ?? opts.snCode ?? null
    if (code === null) return { ...base, state: 'blocked', reason: 'no paper code known for this subject (pass --sn-code for Sains)' }
    blueprint = 'create'
  } else if (!fits(bp, t.count)) {
    if (bp.source === 'verified') return { ...base, state: 'blocked', reason: 'the active blueprint is Disahkan and does not match the K1 shape; not touched' }
    if (!opts.replaceBlueprints) return { ...base, state: 'blocked', reason: 'the active blueprint does not match the K1 shape (one section, all, 40 questions); use --replace-blueprints to add a new version' }
    blueprint = 'replace'
  }
  const code = bp?.code ?? t.code ?? opts.snCode ?? null
  if (code === null) return { ...base, state: 'blocked', reason: 'no paper code known for this subject' }
  const withBp: TargetPlan = { ...base, code, blueprint, ...(blueprint === 'keep' ? {} : { body: blueprintBody(t, blueprint === 'replace' ? (t.code ?? code) : code) }) }

  // Papers. A paper is "already there" by its stable title, or by holding exactly the planned questions (a renamed draft).
  const existingByTitle = new Map(input.existing.map((p) => [p.title, p]))
  const sameSet = (a: string[], b: string[]): boolean => a.length === b.length && a.every((id) => b.includes(id))
  const papers: PaperPlan[] = picked.papers.map((qs, i) => {
    const n = i + 1
    const title = paperTitle(input.name, n)
    const ids = qs.map((q) => q.id)
    const found = existingByTitle.get(title) ?? input.existing.find((p) => sameSet(p.questionIds, ids))
    if (found) {
      if (found.status === 'draft' && found.questionIds.length === 0) return { n, title, ids, action: 'fill', existingId: found.id }
      return { n, title, ids, action: 'exists', existingId: found.id }
    }
    return { n, title, ids, action: 'create' }
  })
  // A new paper must not share a question with a paper that already exists (the "Kertas 2 uses nothing of Kertas 1" rule).
  const taken = new Set(input.existing.filter((p) => papers.some((x) => x.existingId === p.id)).flatMap((p) => p.questionIds))
  for (const p of papers) {
    if (p.action === 'create' || p.action === 'fill') {
      if (p.ids.some((id) => taken.has(id))) {
        p.action = 'blocked'
        p.reason = 'would share a question with an earlier draft'
      } else for (const id of p.ids) taken.add(id)
    }
  }
  return { ...withBp, papers }
}

export interface RunSummary {
  exit: 0 | 1 | 3
  blueprintsCreated: number
  papersCreated: number
  papersFilled: number
  papersExisting: number
  blocked: number
  failures: number
  plans: TargetPlan[]
}

const stratumText = (r: Record<string, number>): string =>
  Object.keys(r)
    .sort()
    .map((k) => `${k} ${String(r[k])}`)
    .join(', ')

function describe(plan: TargetPlan, apply: boolean, t: K1Target): string[] {
  const head = `${plan.subject} kertas ${String(KERTAS)}${plan.code ? ` (${plan.code})` : ''}`
  const lines = [head]
  lines.push(`  eligible stock: ${String(plan.stock)} (${stratumText(plan.stockByStratum)}); duplicates dropped: ${String(plan.duplicatesDropped)}`)
  if (plan.state !== 'ready') lines.push(`  ${plan.state.toUpperCase()}: ${plan.reason ?? ''}`)
  if (plan.state === 'blocked') return lines
  lines.push(
    `  blueprint: ${plan.blueprint === 'keep' ? 'keep the active one' : plan.blueprint === 'create' ? `${apply ? 'create' : 'would create'} Spec, ${String(t.count)} questions, ${String(t.durationMin)} min` : `${apply ? 'add' : 'would add'} a new Spec version (the active one does not fit)`}`,
  )
  if (plan.papers.length > 0) {
    lines.push(`  papers: ${String(plan.builtSets)} of ${String(plan.requestedSets)} requested; picked ${String(plan.papers.length * t.count)} (${stratumText(plan.pickedByStratum)})`)
    const count = (a: PaperAction): number => plan.papers.filter((p) => p.action === a).length
    const verb = apply ? 'create' : 'would create'
    lines.push(`  ${verb} ${String(count('create'))}, ${apply ? 'fill' : 'would fill'} ${String(count('fill'))} empty, already there ${String(count('exists'))}, blocked ${String(count('blocked'))}`)
  }
  return lines
}

export async function runK1Drafts(gw: Gateway, opts: RunOptions, out: (line: string) => void): Promise<RunSummary> {
  const summary: RunSummary = { exit: 0, blueprintsCreated: 0, papersCreated: 0, papersFilled: 0, papersExisting: 0, blocked: 0, failures: 0, plans: [] }
  out(`bijak-k1-drafts: ${opts.apply ? 'APPLY (drafts only, nothing is published)' : 'DRY-RUN (nothing is written; add --apply to create the drafts)'}`)
  const createdIds: string[] = []

  for (const t of K1_TARGETS.filter((x) => opts.subjects.includes(x.subject))) {
    const subject = await gw.subject(t.subject)
    if (!subject) {
      out(`${t.subject} kertas ${String(KERTAS)}\n  BLOCKED: the subject is not in the curriculum`)
      summary.blocked++
      continue
    }
    const plan = planTarget(
      t,
      {
        name: subject.name,
        candidates: await gw.eligible(t.subject),
        blueprint: await gw.blueprint(t.subject, KERTAS),
        existing: await gw.papers(t.subject, KERTAS),
      },
      opts,
    )
    summary.plans.push(plan)
    for (const line of describe(plan, opts.apply, t)) out(line)
    summary.blocked += (plan.state === 'blocked' ? 1 : 0) + plan.papers.filter((p) => p.action === 'blocked').length
    summary.papersExisting += plan.papers.filter((p) => p.action === 'exists').length
    if (!opts.apply || plan.state !== 'ready') continue

    try {
      if (plan.blueprint !== 'keep' && plan.body) {
        await gw.writeBlueprint(plan.body, plan.blueprint === 'replace')
        summary.blueprintsCreated++
      }
      for (const p of plan.papers) {
        if (p.action !== 'create' && p.action !== 'fill') continue
        try {
          let id = p.existingId
          let sectionIds: string[]
          if (p.action === 'create') {
            const made = await gw.createPaper(t.subject, KERTAS, p.title)
            id = made.id
            sectionIds = made.sectionIds
            summary.papersCreated++
          } else {
            sectionIds = await gw.sectionIds(id as string)
            summary.papersFilled++
          }
          const section = sectionIds[0]
          if (!id || !section || sectionIds.length !== 1) throw new ScriptError('the draft does not have the one K1 section')
          await gw.fillSection(id, section, p.ids)
          createdIds.push(id)
        } catch (e) {
          summary.failures++
          out(`  FAILED paper ${String(p.n)}: ${errorText(e)}`)
        }
      }
    } catch (e) {
      summary.failures++
      out(`  FAILED blueprint: ${errorText(e)}`)
    }
  }

  if (opts.apply && createdIds.length > 0) {
    const ok = await gw.draftsPassingCheck(createdIds)
    out(`publish check on the drafts written now: ${ok === null ? 'not available' : `${String(ok)} of ${String(createdIds.length)} pass`}`)
  }
  out(
    `${opts.apply ? 'done' : 'would do'}: blueprints ${String(summary.blueprintsCreated)}, papers created ${String(summary.papersCreated)}, resumed ${String(summary.papersFilled)}, already there ${String(summary.papersExisting)}, blocked ${String(summary.blocked)}, failed ${String(summary.failures)}`,
  )
  if (!opts.apply) {
    const would = summary.plans.reduce(
      (n, p) => n + p.papers.filter((x) => x.action === 'create' || x.action === 'fill').length,
      0,
    )
    out(`dry-run total: ${String(would)} paper(s) would be written; no blueprint or paper was touched`)
  }
  summary.exit = summary.failures > 0 ? 1 : summary.blocked > 0 ? 3 : 0
  return summary
}

/** An error as a short line: the API error code and its static message, or the error name. Never a stack, never data. */
export function errorText(e: unknown): string {
  if (typeof e !== 'object' || e === null) return 'unknown error'
  if (e instanceof ScriptError) return e.message
  const { code, getStatus } = e as { code?: unknown; getStatus?: unknown }
  const message = e instanceof Error ? e.message : ''
  // An API error (HttpException with a code) has a static, data-free message; anything else (a database error can carry
  // query values) is reduced to its code or name.
  if (typeof code === 'string' && typeof getStatus === 'function') return `${code}${message ? ` ${message.slice(0, 160)}` : ''}`
  if (typeof code === 'string') return code.slice(0, 40)
  return e instanceof Error ? e.name.slice(0, 40) : 'unknown error'
}
