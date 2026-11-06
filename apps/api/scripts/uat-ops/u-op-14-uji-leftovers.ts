/**
 * U-OP-14 leftovers report for S4-T08 (PRD30 U-OP-14; ledger rules in `docs/plan/r1-ac-ledger.md`): lists what the QA / AC-CHAIN test runs
 * left on the target. READ-ONLY and report-only: it deletes nothing and has no `--apply`; the removal is the admins' work (ADM, OPS lists).
 *
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/u-op-14-uji-leftovers.ts
 *
 * Two parts, one PASS/FAIL line each:
 *  1. Records whose name/title starts with `UJI ` (the test-record prefix `UJI <team> <date>`): the Bab "UJI Rantaian" and its topics, papers,
 *     intake batches (source text / note), stimulus groups, question sets, classes, schools and users, plus every question that has a version
 *     in a `UJI ` Bab. Per source: the count and the row ids (first 20). Never a name, title, e-mail or question text.
 *  2. The known QA rows (questions 1272-1276, intake batches 1-2, papers 6-8) that are still present, by id. An id alone cannot tell a QA row
 *     from a real row, so the admin checks each before removal; the line is a FAIL because the card's done-when is "none remain".
 * PASS when nothing is found. Exit code 0 ok, 1 something was found, 2 usage or environment error.
 */
import type { Client } from 'pg'

import { exitCodeOf, formatLine, isMain, line, openDb, parseUatArgs, writeReport, type CheckLine, type UatArgsSpec } from './lib'

export const SPEC: UatArgsSpec = { name: 'u-op-14-uji-leftovers', allowApply: false }

/** The prefix of every test record (`docs/plan/r1-ac-ledger.md`). */
export const UJI_PREFIX = 'UJI '

/** Where a `UJI ` name can sit. Constants only: they are pasted into SQL, never taken from input. */
export const UJI_SOURCES = [
  { label: 'chapters (Bab)', table: 'chapters', column: 'name' },
  { label: 'topics (Topik)', table: 'topics', column: 'name' },
  { label: 'subtopics', table: 'subtopics', column: 'name' },
  { label: 'papers', table: 'papers', column: 'title' },
  { label: 'intake batches (source text)', table: 'intake_batches', column: 'source_text' },
  { label: 'intake batches (note)', table: 'intake_batches', column: 'note' },
  { label: 'stimulus groups', table: 'stimulus_groups', column: 'label' },
  { label: 'question sets', table: 'question_sets', column: 'title' },
  { label: 'classes', table: 'classrooms', column: 'name' },
  { label: 'schools', table: 'schools', column: 'name' },
  { label: 'users', table: 'users', column: 'name' },
] as const

/** The QA rows named by PRD30 U-OP-14 / plan section 7. */
export const QA_IDS = [
  { label: 'questions', table: 'questions', ids: [1272, 1273, 1274, 1275, 1276] },
  { label: 'intake batches', table: 'intake_batches', ids: [1, 2] },
  { label: 'papers', table: 'papers', ids: [6, 7, 8] },
] as const

export interface Found {
  label: string
  /** Row ids, ascending, as text. */
  ids: string[]
}

export const MAX_IDS_SHOWN = 20

const idList = (ids: readonly string[]): string => (ids.length > MAX_IDS_SHOWN ? `${ids.slice(0, MAX_IDS_SHOWN).join(', ')}, ... (+${String(ids.length - MAX_IDS_SHOWN)})` : ids.join(', '))

/** Pure: findings -> report lines. */
export function leftoverLines(uji: readonly Found[], qa: readonly Found[]): CheckLine[] {
  const out: CheckLine[] = []
  const ujiHits = uji.filter((f) => f.ids.length > 0)
  for (const f of uji) {
    if (f.ids.length > 0) out.push(line('INFO', `${f.label}: ${String(f.ids.length)} with the "${UJI_PREFIX.trim()}" prefix, ids ${idList(f.ids)}`))
  }
  out.push(
    ujiHits.length === 0
      ? line('PASS', `no record with the "${UJI_PREFIX.trim()}" prefix in ${String(uji.length)} places`)
      : line('FAIL', `${String(ujiHits.reduce((n, f) => n + f.ids.length, 0))} "${UJI_PREFIX.trim()}" records in ${String(ujiHits.length)} places (remove them in the admin UI, U-OP-14)`),
  )
  const qaHits = qa.filter((f) => f.ids.length > 0)
  for (const f of qa) {
    if (f.ids.length > 0) out.push(line('INFO', `QA ${f.label} still present, ids ${idList(f.ids)} (check each is test data before removal)`))
  }
  out.push(
    qaHits.length === 0
      ? line('PASS', 'none of the known QA rows (questions 1272-1276, batches 1-2, papers 6-8) is present')
      : line('FAIL', `${String(qaHits.reduce((n, f) => n + f.ids.length, 0))} known QA rows still present`),
  )
  return out
}

const idsOf = async (client: Client, sql: string, params: unknown[] = []): Promise<string[]> => (await client.query<{ id: string }>(sql, params)).rows.map((r) => r.id)

/** Reads the findings (call inside a read-only transaction). */
export async function collectLeftovers(client: Client): Promise<{ uji: Found[]; qa: Found[] }> {
  const uji: Found[] = []
  for (const s of UJI_SOURCES) {
    // Table and column come from the constants above; the prefix is a bound parameter. left()/= avoids LIKE wildcards.
    uji.push({ label: s.label, ids: await idsOf(client, `SELECT id::text AS id FROM ${s.table} WHERE left(${s.column}, ${String(UJI_PREFIX.length)}) = $1 ORDER BY id`, [UJI_PREFIX]) })
  }
  uji.push({
    label: 'questions with a version in a "UJI " Bab',
    ids: await idsOf(
      client,
      `SELECT DISTINCT v.question_id::text AS id FROM question_versions v JOIN chapters c ON c.id = v.chapter_id WHERE left(c.name, ${String(UJI_PREFIX.length)}) = $1 ORDER BY id`,
      [UJI_PREFIX],
    ),
  })
  const qa: Found[] = []
  for (const q of QA_IDS) {
    qa.push({ label: q.label, ids: await idsOf(client, `SELECT id::text AS id FROM ${q.table} WHERE id = ANY($1::bigint[]) ORDER BY id`, [q.ids]) })
  }
  return { uji, qa }
}

async function main(): Promise<number> {
  const started = new Date()
  let db: Awaited<ReturnType<typeof openDb>> | undefined
  try {
    parseUatArgs(process.argv.slice(2), SPEC)
    db = await openDb()
    const found = await db.readOnly((c) => collectLeftovers(c))
    const lines = leftoverLines(found.uji, found.qa)
    for (const l of lines) console.log(formatLine(l))
    console.log(`INFO report written: ${writeReport('u-op-14-uji-leftovers', lines, { now: started })}`)
    return exitCodeOf(lines)
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 2
  } finally {
    await db?.close()
  }
}

if (isMain(import.meta.url)) void main().then((code) => process.exit(code))
