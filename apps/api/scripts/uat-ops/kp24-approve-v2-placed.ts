/**
 * KP-24 (PO decision, 12 Nov): "V2 questions placed in V2-published papers are AUTO-APPROVED; inactive questions STAY inactive."
 * It overrides KP-14's "no V2 status change" for this case only. Goal: the Bijak student hub (`GET /api/bijak/papers`) lists a V2-published
 * paper only when every placed question is served (a live version with status `approved`, `be09-question-source.ts` getMany;
 * `placesUnservable` in `modules/bijak/papers/ports.ts`). This script makes the version a V2 paper PINNED the live, approved version.
 *
 * Selection (all must hold):
 *  - the question is placed on a paper with kind = 'pilihan', surface = 'simulasi', status = 'published' that is V2-origin
 *    (`etl_id_map`: legacy_source 'cloud', entity 'exam_papers', new_id = paper id);
 *  - the question is V2-origin (`questions.legacy_source = 'cloud'`, or an `etl_id_map` cloud row, entity 'questions' or 'exam_questions',
 *    new_id = question id);
 *  - `questions.live_version_no IS NULL`, or the live version's status is not 'approved'.
 * Skipped as well: a pin whose archive_reason is source_takedown / withdrawn / regrouped (superseded or none stay in scope), a pin whose
 * source paper has a takedown (`source_papers.takedown_at`, the test of learner-visibility.ts), and a question with ANOTHER approved version
 * (uq_question_versions_one_approved would abort the transaction). The apply transaction sets lock_timeout 10s and statement_timeout 120s.
 * Acted on only when also: the question is active, every V2-published placement pins the SAME version, and that version row exists.
 * Reported and skipped: an inactive question (`is_active` is never changed, and the question is left exactly as it is), a question whose
 * placements pin different versions, a pin with no version row. Nothing else is touched.
 *
 * Write per selected question, in ONE transaction, after locking the question rows (what `QuestionsService.setStatus(.., 'approved')` does,
 * `questions.service.ts`): the pinned version gets status 'approved', archive_reason NULL, published_at = now() when NULL (an existing
 * stamp is kept), last_editor 'person', updated_at = now(); `questions.live_version_no` = that version, updated_at = now(); one
 * `question_status_events` row (from the version's previous status to 'approved', no actor user, role 'system', reason 'KP-24', request id
 * 'kp24-approve-v2-placed'), and one `audit_events` row (action 'question.approved.kp24', target question, no actor user, detail
 * {kp:'KP-24', paperIds, versionNo, previousStatus}). Content, text, options, tags, is_active and every other row are not rewritten.
 *
 * NOT reproduced (the approve path does them in Nest code that needs Prisma): the approve gate (`GATES.approve`: tag, keys, marks, DSKP ...),
 * `assertServableSomewhere` (served-lock), `refreshStimulusFlag` (stimulus_flag is recomputed on every version write already, so a loaded
 * version carries it; the dry run counts selected versions that carry an OPEN stimulus_missing / figure_only flag: they stay unserved),
 * `reports.markFixedFor`, the `overview` cache invalidation (restart the API, or wait for its TTL, before checking the hub) and
 * `releaseImageHold` (reactivates a question, which would change is_active; PO: stay inactive).
 *
 * DRY RUN IS THE DEFAULT (read-only transaction): it prints the selected questions by previous status and is_active, the versions it would
 * approve, the papers that would become listable for a grade-11 pupil and the papers that stay hidden, and why. `--apply` writes, prints the
 * same plus the rows written, and re-reads the papers to verify the prediction. A second `--apply` selects 0 and writes 0 rows.
 * Output is counts only (no ids, no question text); the report goes to `.evidence/uat-ops/kp24-approve-v2-placed-<time>.txt`.
 *
 * Run on UAT (the lead runs it after review and PO approval; the connection string comes from the environment, never from this file).
 * In the migrate image, the way `deploy/vps/rebuild-db.sh` `uat_op` runs a `.ts` script (reports land in `$out_dir/uat-ops`):
 *   pp_compose run --rm --no-deps -T -v "$out_dir:/app/.evidence" migrate npm exec -w @pp/api -- tsx scripts/uat-ops/kp24-approve-v2-placed.ts           # dry run
 *   pp_compose run --rm --no-deps -T -v "$out_dir:/app/.evidence" migrate npm exec -w @pp/api -- tsx scripts/uat-ops/kp24-approve-v2-placed.ts --apply   # write
 * (the release image tag, e.g. PP_IMAGE_TAG, must contain this file). From a checkout with a DATABASE_URL:
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/kp24-approve-v2-placed.ts [--apply]
 *
 * Exit code: 0 done, 1 a FAIL line (the verification after --apply disagreed with the prediction), 2 usage or environment error.
 */
import type pg from 'pg'

import { exitCodeOf, isMain, line, openDb, parseUatArgs, scrubSecrets, UsageError, writeReport, type CheckLine, type UatArgsSpec } from './lib'

export const SPEC: UatArgsSpec = { name: 'kp24-approve-v2-placed', allowApply: true }
export const AUDIT_ACTION = 'question.approved.kp24'
export const REQUEST_ID = 'kp24-approve-v2-placed'
export const GRADE_11_SCOPES: readonly (string | null)[] = [null, 't5', 't4_t5']

type Queryable = Pick<pg.Client, 'query'>

const V2_PAPERS_CTE = `
  v2_papers AS (
    SELECT p.id, p.level_scope
      FROM papers p
     WHERE p.kind = 'pilihan' AND p.surface = 'simulasi' AND p.status = 'published'
       AND p.id::text IN (SELECT m.new_id FROM etl_id_map m WHERE m.legacy_source = 'cloud' AND m.entity = 'exam_papers')
  )`

const V2_QUESTION_PREDICATE = `
  (q.legacy_source = 'cloud'
   OR q.id::text IN (SELECT m.new_id FROM etl_id_map m WHERE m.legacy_source = 'cloud' AND m.entity IN ('questions', 'exam_questions')))`

/** The questions the rule selects (before the active / pin checks), with what the checks need. */
export const CANDIDATES_SQL = `
  WITH ${V2_PAPERS_CTE},
  placed AS (
    SELECT pl.question_id, pl.pinned_version_no, s.paper_id
      FROM paper_placements pl
      JOIN paper_sections s ON s.id = pl.paper_section_id
      JOIN v2_papers vp ON vp.id = s.paper_id
  ),
  per_q AS (
    SELECT question_id,
           array_agg(DISTINCT pinned_version_no ORDER BY pinned_version_no) AS pins,
           array_agg(DISTINCT paper_id ORDER BY paper_id) AS paper_ids
      FROM placed GROUP BY question_id
  )
  SELECT q.id::text AS question_id,
         q.is_active,
         q.live_version_no,
         lv.status AS live_status,
         pq.pins,
         pq.paper_ids::text[] AS paper_ids,
         pv.status AS pinned_status,
         (pv.id IS NOT NULL) AS pinned_exists,
         (pv.stimulus_flag IN ('stimulus_missing', 'figure_only') AND pv.flag_dismissed_at IS NULL) AS open_flag,
         pv.archive_reason AS pinned_archive_reason,
         -- the test of learner-visibility.ts NOT_SOURCE_TAKEN_DOWN_SQL, negated
         EXISTS (SELECT 1 FROM source_papers tsp WHERE tsp.id = pv.source_paper_id AND tsp.takedown_at IS NOT NULL) AS taken_down,
         -- uq_question_versions_one_approved: only one approved version per question
         EXISTS (SELECT 1 FROM question_versions o WHERE o.question_id = q.id AND o.status = 'approved' AND o.version_no <> pq.pins[1]) AS other_approved
    FROM per_q pq
    JOIN questions q ON q.id = pq.question_id
    LEFT JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.live_version_no
    LEFT JOIN question_versions pv ON pv.question_id = q.id AND pv.version_no = pq.pins[1]
   WHERE ${V2_QUESTION_PREDICATE}
     AND (q.live_version_no IS NULL OR lv.status IS DISTINCT FROM 'approved')
   ORDER BY q.id`

/** Every placement of a V2-published paper with the state of its question's live version. */
export const PLACEMENTS_SQL = `
  WITH ${V2_PAPERS_CTE}
  SELECT vp.id::text AS paper_id, vp.level_scope, pl.question_id::text AS question_id, q.is_active, lv.status AS live_status
    FROM v2_papers vp
    JOIN paper_sections s ON s.paper_id = vp.id
    JOIN paper_placements pl ON pl.paper_section_id = s.id
    JOIN questions q ON q.id = pl.question_id
    LEFT JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.live_version_no`

export interface CandidateRow {
  question_id: string
  is_active: boolean
  live_version_no: number | null
  live_status: string | null
  pins: number[]
  paper_ids: string[]
  pinned_status: string | null
  pinned_exists: boolean
  open_flag: boolean | null
  pinned_archive_reason: string | null
  taken_down: boolean
  other_approved: boolean
}

export interface PlacementRow {
  paper_id: string
  level_scope: string | null
  question_id: string
  is_active: boolean
  live_status: string | null
}

export type Outcome = 'approve' | 'inactive' | 'multi_pin' | 'pin_missing' | 'withdrawn' | 'other_approved'

/** Archive reasons that mean the version was taken down on purpose: never re-approved. 'superseded' (or none) stays in scope. */
export const BLOCKED_ARCHIVE_REASONS: readonly string[] = ['source_takedown', 'withdrawn', 'regrouped']

export interface Classified extends CandidateRow {
  outcome: Outcome
  versionNo: number | null
}

export function classify(c: CandidateRow): Classified {
  const pins = c.pins.map(Number)
  if (!c.is_active) return { ...c, pins, outcome: 'inactive', versionNo: null }
  if (pins.length !== 1) return { ...c, pins, outcome: 'multi_pin', versionNo: null }
  if (!c.pinned_exists) return { ...c, pins, outcome: 'pin_missing', versionNo: null }
  if (c.taken_down || (c.pinned_archive_reason !== null && BLOCKED_ARCHIVE_REASONS.includes(c.pinned_archive_reason))) return { ...c, pins, outcome: 'withdrawn', versionNo: null }
  if (c.other_approved) return { ...c, pins, outcome: 'other_approved', versionNo: null }
  return { ...c, pins, outcome: 'approve', versionNo: pins[0] as number }
}

export interface PaperSummary {
  papers: number
  /** Listable now / after the change, over all V2-published papers, and for a grade-11 pupil (level_scope NULL, t5, t4_t5). */
  listableBefore: number
  listableAfter: number
  listableBefore11: number
  listableAfter11: number
  /** Hidden before and listable after (all / grade 11). */
  newlyListable: number
  newlyListable11: number
  /** Papers still hidden after the change, by why (first reason that applies). */
  stillHidden: { inactivePlacement: number; skippedQuestion: number; otherNotApproved: number }
  /** Papers hidden only by the level scope for a grade-11 pupil (listable otherwise). */
  scopedOut11: number
}

/** Pure: which papers a pupil would see before and after approving `approveIds`. */
export function summarisePapers(rows: readonly PlacementRow[], approveIds: ReadonlySet<string>, skippedIds: ReadonlySet<string>): PaperSummary {
  const byPaper = new Map<string, PlacementRow[]>()
  for (const r of rows) (byPaper.get(r.paper_id) ?? byPaper.set(r.paper_id, []).get(r.paper_id)!).push(r)
  const out: PaperSummary = {
    papers: byPaper.size,
    listableBefore: 0,
    listableAfter: 0,
    listableBefore11: 0,
    listableAfter11: 0,
    newlyListable: 0,
    newlyListable11: 0,
    stillHidden: { inactivePlacement: 0, skippedQuestion: 0, otherNotApproved: 0 },
    scopedOut11: 0,
  }
  for (const placements of byPaper.values()) {
    const scope = placements[0]?.level_scope ?? null
    const in11 = GRADE_11_SCOPES.includes(scope)
    const servedBefore = (r: PlacementRow): boolean => r.is_active && r.live_status === 'approved'
    const servedAfter = (r: PlacementRow): boolean => r.is_active && (r.live_status === 'approved' || approveIds.has(r.question_id))
    const before = placements.every(servedBefore)
    const after = placements.every(servedAfter)
    if (before) out.listableBefore += 1
    if (after) out.listableAfter += 1
    if (before && in11) out.listableBefore11 += 1
    if (after && in11) out.listableAfter11 += 1
    if (after && !before) out.newlyListable += 1
    if (after && !before && in11) out.newlyListable11 += 1
    if (after && !in11) out.scopedOut11 += 1
    if (!after) {
      if (placements.some((r) => !r.is_active)) out.stillHidden.inactivePlacement += 1
      else if (placements.some((r) => !servedAfter(r) && skippedIds.has(r.question_id))) out.stillHidden.skippedQuestion += 1
      else out.stillHidden.otherNotApproved += 1
    }
  }
  return out
}

export interface Written {
  versions: number
  questions: number
  statusEvents: number
  auditEvents: number
}

export interface Report {
  mode: 'dry-run' | 'apply'
  selected: number
  /** Selected questions by previous (pinned version) status and is_active, e.g. `draft/active`. */
  byStatusActive: Record<string, number>
  /** Selected questions by pinned status x archive_reason (e.g. `archived/superseded`, `draft/-`). */
  byArchiveReason: Record<string, number>
  outcomes: Record<Outcome, number>
  /** Of the `approve` questions: pinned version is not the latest, and an open stimulus flag keeps the question unserved. */
  pinnedNotLatest: number
  openFlag: number
  versionsToApprove: number
  papers: PaperSummary
  written: Written
  /** After --apply: the papers re-read from the database (null in a dry run). */
  verified: PaperSummary | null
}

const bump = (m: Record<string, number>, k: string): void => {
  m[k] = (m[k] ?? 0) + 1
}

export async function candidatesOf(client: Queryable): Promise<Classified[]> {
  const { rows } = await client.query<CandidateRow>(CANDIDATES_SQL)
  return rows.map(classify)
}

async function placementsOf(client: Queryable): Promise<PlacementRow[]> {
  return (await client.query<PlacementRow>(PLACEMENTS_SQL)).rows
}

async function latestMismatch(client: Queryable, approve: readonly Classified[]): Promise<number> {
  if (approve.length === 0) return 0
  const ids = approve.map((c) => c.question_id)
  const { rows } = await client.query<{ question_id: string; latest_version_no: number }>(
    `SELECT id::text AS question_id, latest_version_no FROM questions WHERE id = ANY($1::bigint[])`,
    [ids],
  )
  const latest = new Map(rows.map((r) => [r.question_id, r.latest_version_no]))
  return approve.filter((c) => latest.get(c.question_id) !== c.versionNo).length
}

async function buildReport(client: Queryable, mode: Report['mode'], candidates: readonly Classified[]): Promise<Report> {
  const byStatusActive: Record<string, number> = {}
  const byArchiveReason: Record<string, number> = {}
  const outcomes: Record<Outcome, number> = { approve: 0, inactive: 0, multi_pin: 0, pin_missing: 0, withdrawn: 0, other_approved: 0 }
  for (const c of candidates) {
    bump(byArchiveReason, `${c.pinned_status ?? 'no-version'}/${c.pinned_archive_reason ?? '-'}${c.taken_down ? '+takedown' : ''}`)
    bump(byStatusActive, `${c.pinned_status ?? 'no-version'}/${c.is_active ? 'active' : 'inactive'}`)
    outcomes[c.outcome] += 1
  }
  const approve = candidates.filter((c) => c.outcome === 'approve')
  const approveIds = new Set(approve.map((c) => c.question_id))
  const skippedIds = new Set(candidates.filter((c) => c.outcome !== 'approve').map((c) => c.question_id))
  return {
    mode,
    selected: candidates.length,
    byStatusActive,
    byArchiveReason,
    outcomes,
    pinnedNotLatest: await latestMismatch(client, approve),
    openFlag: approve.filter((c) => c.open_flag === true).length,
    versionsToApprove: approve.length,
    papers: summarisePapers(await placementsOf(client), approveIds, skippedIds),
    written: { versions: 0, questions: 0, statusEvents: 0, auditEvents: 0 },
    verified: null,
  }
}

/** Dry run: one read-only transaction; nothing is written. */
export async function dryRun(client: Queryable): Promise<Report> {
  await client.query('BEGIN READ ONLY')
  try {
    return await buildReport(client, 'dry-run', await candidatesOf(client))
  } finally {
    await client.query('ROLLBACK')
  }
}

const APPROVE_VERSIONS_SQL = `
  UPDATE question_versions v
     SET status = 'approved', archive_reason = NULL, published_at = COALESCE(v.published_at, now()), last_editor = 'person', updated_at = now()
    FROM unnest($1::bigint[], $2::int[]) AS t(question_id, version_no)
   WHERE v.question_id = t.question_id AND v.version_no = t.version_no
  RETURNING v.id`

const SET_LIVE_SQL = `
  UPDATE questions q SET live_version_no = t.version_no, updated_at = now()
    FROM unnest($1::bigint[], $2::int[]) AS t(question_id, version_no)
   WHERE q.id = t.question_id
  RETURNING q.id`

const STATUS_EVENTS_SQL = `
  INSERT INTO question_status_events (question_id, version_no, from_status, to_status, actor_user_id, actor_role, reason, request_id)
  SELECT t.question_id, t.version_no, t.previous_status, 'approved', NULL, 'system', 'KP-24', '${REQUEST_ID}'
    FROM unnest($1::bigint[], $2::int[], $3::text[]) AS t(question_id, version_no, previous_status)
  RETURNING id`

const AUDIT_SQL = `
  INSERT INTO audit_events (actor_user_id, actor_role, action, target_type, target_id, request_id, detail)
  SELECT NULL, 'system', '${AUDIT_ACTION}', 'question', t.question_id::text, '${REQUEST_ID}', t.detail::jsonb
    FROM unnest($1::bigint[], $2::text[]) AS t(question_id, detail)
  RETURNING id`

/**
 * Apply: ONE transaction. The candidates are read, the question rows locked (ordered, like `repo.lock`), and the candidates read again on the
 * locked rows, so a change made in between is honoured. Throws (rolls back) on any error or when a statement writes a different row count.
 */
export async function apply(client: Queryable): Promise<Report> {
  await client.query('BEGIN')
  try {
    await client.query(`SET LOCAL lock_timeout = '10s'`)
    await client.query(`SET LOCAL statement_timeout = '120s'`)
    const first = await candidatesOf(client)
    if (first.length > 0) {
      await client.query(`SELECT id FROM questions WHERE id = ANY($1::bigint[]) ORDER BY id FOR UPDATE`, [first.map((c) => c.question_id)])
    }
    const candidates = await candidatesOf(client)
    const report = await buildReport(client, 'apply', candidates)
    const approve = candidates.filter((c) => c.outcome === 'approve')
    if (approve.length > 0) {
      const qids = approve.map((c) => c.question_id)
      const vnos = approve.map((c) => c.versionNo as number)
      const previous = approve.map((c) => c.pinned_status ?? 'draft')
      const details = approve.map((c) => JSON.stringify({ kp: 'KP-24', paperIds: c.paper_ids, versionNo: c.versionNo, previousStatus: c.pinned_status, previousArchiveReason: c.pinned_archive_reason }))
      const expectN = (what: string, got: number): void => {
        if (got !== approve.length) throw new Error(`${what}: wrote ${String(got)} rows, expected ${String(approve.length)}; rolled back`)
      }
      const versions = (await client.query(APPROVE_VERSIONS_SQL, [qids, vnos])).rowCount ?? 0
      expectN('question_versions', versions)
      const questions = (await client.query(SET_LIVE_SQL, [qids, vnos])).rowCount ?? 0
      expectN('questions', questions)
      const statusEvents = (await client.query(STATUS_EVENTS_SQL, [qids, vnos, previous])).rowCount ?? 0
      expectN('question_status_events', statusEvents)
      const auditEvents = (await client.query(AUDIT_SQL, [qids, details])).rowCount ?? 0
      expectN('audit_events', auditEvents)
      report.written = { versions, questions, statusEvents, auditEvents }
    }
    report.verified = summarisePapers(await placementsOf(client), new Set(), new Set(candidates.filter((c) => c.outcome !== 'approve').map((c) => c.question_id)))
    await client.query('COMMIT')
    return report
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  }
}

export function formatReport(r: Report, target = ''): string[] {
  const apply = r.mode === 'apply'
  const p = r.papers
  const out = [
    `kp24-approve-v2-placed mode=${r.mode.toUpperCase()}${target === '' ? '' : ` db=${target}`}`,
    `questions selected (V2 question on a V2-published pilihan simulasi paper, no approved live version): ${String(r.selected)}`,
    `  by pinned-version status / is_active: ${Object.entries(r.byStatusActive).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${String(v)}`).join(' ') || '-'}`,
    `  ${apply ? 'approved' : 'to approve'}: ${String(r.outcomes.approve)}; skipped inactive (stay as they are): ${String(r.outcomes.inactive)}; skipped different pins: ${String(r.outcomes.multi_pin)}; skipped pin without a version row: ${String(r.outcomes.pin_missing)}; skipped withdrawn / source takedown / regrouped pin: ${String(r.outcomes.withdrawn)}; skipped because another version is approved: ${String(r.outcomes.other_approved)}`,
    `  by pinned status / archive_reason: ${Object.entries(r.byArchiveReason).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${String(v)}`).join(' ') || '-'}`,
    `versions ${apply ? 'approved' : 'to approve'}: ${String(r.versionsToApprove)} (pinned version is not the latest: ${String(r.pinnedNotLatest)}; carrying an open stimulus flag, so still unserved: ${String(r.openFlag)})`,
    `V2-published pilihan simulasi papers: ${String(p.papers)}`,
    `  listable for any pupil, before -> after: ${String(p.listableBefore)} -> ${String(p.listableAfter)}; newly listable (UPPER BOUND: the bridge mapper can still refuse a question, e.g. missing answer key or picture): ${String(p.newlyListable)}`,
    `  grade 11 (level_scope NULL, t5, t4_t5), before -> after: ${String(p.listableBefore11)} -> ${String(p.listableAfter11)}; newly listable (upper bound): ${String(p.newlyListable11)}; fully approved but out of scope for grade 11: ${String(p.scopedOut11)}`,
    `  still hidden: ${String(p.stillHidden.inactivePlacement + p.stillHidden.skippedQuestion + p.stillHidden.otherNotApproved)} (inactive placement: ${String(p.stillHidden.inactivePlacement)}; skipped question: ${String(p.stillHidden.skippedQuestion)}; other question not approved: ${String(p.stillHidden.otherNotApproved)})`,
  ]
  if (apply) {
    out.push(
      `rows written: question_versions=${String(r.written.versions)} questions=${String(r.written.questions)} question_status_events=${String(r.written.statusEvents)} audit_events=${String(r.written.auditEvents)}`,
    )
    if (r.verified) out.push(`verified after write: listable ${String(r.verified.listableAfter)}, grade 11 ${String(r.verified.listableAfter11)}`)
  } else out.push('dry run: nothing was changed. Run with --apply after the report is approved.')
  return out
}

export function reportLines(r: Report): CheckLine[] {
  const lines = formatReport(r).map((text) => line('INFO', text))
  if (r.verified && (r.verified.listableAfter !== r.papers.listableAfter || r.verified.listableAfter11 !== r.papers.listableAfter11)) {
    lines.push(line('FAIL', `verification differs from the prediction: listable ${String(r.verified.listableAfter)} vs ${String(r.papers.listableAfter)}, grade 11 ${String(r.verified.listableAfter11)} vs ${String(r.papers.listableAfter11)}`))
  }
  return lines
}

/** Host and database only (never the user or password). */
const targetOf = (url: string): string => {
  try {
    const u = new URL(url)
    return `${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`
  } catch {
    return '(unparsed)'
  }
}

async function main(): Promise<number> {
  const started = new Date()
  let db: Awaited<ReturnType<typeof openDb>> | undefined
  try {
    const args = parseUatArgs(process.argv.slice(2), SPEC)
    db = await openDb()
    const report = args.apply ? await apply(db.client) : await db.readOnly((c) => dryRunInside(c))
    for (const text of formatReport(report, targetOf(process.env.DATABASE_URL ?? ''))) console.log(text)
    const lines = reportLines(report)
    for (const l of lines.filter((x) => x.status === 'FAIL')) console.log(`${l.status} ${l.text}`)
    console.log(`report written: ${writeReport('kp24-approve-v2-placed', lines, { now: started })}`)
    return exitCodeOf(lines)
  } catch (e) {
    console.error(scrubSecrets(e instanceof Error ? e.message : String(e)))
    return e instanceof UsageError ? 2 : 1
  } finally {
    await db?.close().catch(() => undefined)
  }
}

/** The dry-run read inside a transaction the caller (`UatDb.readOnly`) already opened read-only. */
async function dryRunInside(client: Queryable): Promise<Report> {
  return buildReport(client, 'dry-run', await candidatesOf(client))
}

if (isMain(import.meta.url)) {
  void main().then((code) => process.exit(code))
}
