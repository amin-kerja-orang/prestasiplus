/**
 * Terbit pass (T-B10-4, design 10.5, OC-6): after the papers are loaded as `draft`, the V2-published ones go through the REAL gate,
 * `BuilderService.publish` (the same service the Studio calls), as a migration actor (an Admin Pusat user, audited). A paper that passes
 * becomes `published` (placements pinned by the service); one that fails stays `draft` and its BM gate lines are returned for the report
 * (`papers-terbit-<run>.csv`, ids and lines only). No SQL shortcut: nothing is published that the gate would refuse.
 *
 * Legacy publication rule (V2 parity, design 10.5a): V2 `exam_papers` has NO blueprint reference, so a loaded paper has no Kontrak and the plain gate
 * refuses it with the overridable line "no Kontrak" (or "Kontrak not Disahkan"). Pupils could take these papers in V2, so the pass calls the
 * gate with the SAME audited override the Studio offers an admin (`override: true` with a reason; audit action `bijak.paper.published_override`,
 * `LEGACY_PUBLISH_REASON`). That override lifts only the Kontrak lines; every hard blocker (a question pupils cannot be served, a split group,
 * marks and counts of the paper itself) still refuses, so such a paper stays `draft` and is listed. A new paper made in V3 never takes this
 * path: the normal Terbit still needs a Disahkan Kontrak.
 *
 * Papers held at load (`exam_paper_holds`: `group_split`, `kertas_unknown`) are not offered to the gate.
 * The publisher is injected: `terbit-nest.ts` builds it from a Nest application context; a test can build it from a testing module.
 */
import type pg from 'pg'

import type { LegacySource } from '../../kit/types'

export interface PublishOutcome {
  ok: boolean
  errors: readonly string[]
  /** The Kontrak lines the audited override lifted (a legacy publication); absent or empty when the plain gate passed. */
  overridden?: readonly string[]
}

/** The reason written to the audit row of every legacy publication (the gate needs at least 5 characters). */
export const LEGACY_PUBLISH_REASON = 'Diterbitkan dalam V2 (migrasi): V2 tiada rujukan kontrak blueprint pada kertas.'

/** The body of the gate call of this pass: the audited override with the legacy reason. With nothing to override it is a plain Terbit. */
export const LEGACY_PUBLISH_BODY = { override: true, reason: LEGACY_PUBLISH_REASON } as const

/** Calls the Studio's Terbit for one V3 paper id. May throw (an ApiError); a throw is reported as a failure line. */
export type PaperPublisher = (paperId: string) => Promise<PublishOutcome>

export interface TerbitRow {
  v2Id: string
  paperId: string
  outcome: 'published' | 'failed' | 'held'
  /** True when the paper was published through the audited override (the gate said "no Kontrak" / "not Disahkan"). */
  legacy: boolean
  lines: string[]
}

export interface TerbitReport {
  considered: number
  published: number
  /** Of `published`, those that went through the audited legacy override. */
  legacy: number
  failed: number
  held: number
  rows: TerbitRow[]
}

/** The V2-published papers that are loaded and still `draft`, with their hold reasons (empty when none). */
export async function terbitCandidates(pool: Pick<pg.Pool, 'query'>, source: LegacySource): Promise<{ v2Id: string; paperId: string; holds: string[] }[]> {
  const res = await pool.query<{ v2_id: string; paper_id: string; holds: string | null }>(
    `SELECT m.legacy_id AS v2_id, m.new_id AS paper_id, h.new_id AS holds
       FROM etl_id_map m
       JOIN papers p ON p.id = m.new_id::bigint AND p.status = 'draft'
       JOIN archive_cloud.exam_papers ep ON ep.id::text = m.legacy_id
       JOIN staging_cloud.paper_statuses ps ON ps.id = ep.status_id AND lower(btrim(ps.slug)) = 'published'
       LEFT JOIN etl_id_map h ON h.legacy_source = m.legacy_source AND h.entity = 'exam_paper_holds' AND h.legacy_id = m.legacy_id
      WHERE m.legacy_source = $1 AND m.entity = 'exam_papers'
      ORDER BY m.new_id::bigint`,
    [source],
  )
  return res.rows.map((r) => ({ v2Id: r.v2_id, paperId: r.paper_id, holds: r.holds === null ? [] : r.holds.split(',') }))
}

export async function runTerbitPass(pool: Pick<pg.Pool, 'query'>, source: LegacySource, publish: PaperPublisher): Promise<TerbitReport> {
  const candidates = await terbitCandidates(pool, source)
  const report: TerbitReport = { considered: candidates.length, published: 0, legacy: 0, failed: 0, held: 0, rows: [] }
  for (const c of candidates) {
    if (c.holds.length > 0) {
      report.held += 1
      report.rows.push({ v2Id: c.v2Id, paperId: c.paperId, outcome: 'held', legacy: false, lines: c.holds })
      continue
    }
    try {
      const out = await publish(c.paperId)
      if (out.ok) {
        report.published += 1
        const legacy = (out.overridden?.length ?? 0) > 0
        if (legacy) report.legacy += 1
        report.rows.push({ v2Id: c.v2Id, paperId: c.paperId, outcome: 'published', legacy, lines: [...(out.overridden ?? [])] })
      } else {
        report.failed += 1
        report.rows.push({ v2Id: c.v2Id, paperId: c.paperId, outcome: 'failed', legacy: false, lines: [...out.errors] })
      }
    } catch (e) {
      report.failed += 1
      const code = e instanceof Error ? e.name : 'error'
      report.rows.push({ v2Id: c.v2Id, paperId: c.paperId, outcome: 'failed', legacy: false, lines: [`publish threw ${code}`] })
    }
  }
  return report
}

/** CSV of the Terbit report: ids, outcome and the gate's BM lines (never a question text beyond the gate's own lines). */
export function terbitCsv(report: TerbitReport): string {
  const q = (v: string): string => `"${v.replace(/"/g, '""')}"`
  const lines = ['v2_paper_id,v3_paper_id,outcome,legacy,lines']
  for (const r of report.rows) lines.push([r.v2Id, r.paperId, r.outcome, r.legacy ? 'yes' : 'no', q(r.lines.join(' | '))].join(','))
  return `${lines.join('\n')}\n`
}
