import { SERVABILITY_ACTIVITIES, type ServabilityReport } from '@pp/contract'

/**
 * R1-T45 / AC-05.3: what `Terbitkan` does with a servability report (v2-admin-student-pipeline US-05, "approval proceeds unless it is
 * unservable everywhere, then refused, like the .cloud PublishValidator"). PURE.
 *
 * "Unservable everywhere" is read on the report of the question AFTER it became live. One reason is not a defect of the question:
 * `not_on_published_paper` (Simulasi): placing the question on a paper is the step after Terbitkan, so a question the Bijak bridge would
 * serve once placed counts as servable there. Every other reason, on every activity, makes the question unservable everywhere.
 *
 * COPY: the refusal sentence below and the field line `"{label}: {reason}"` are [PROPOSED] (not V2). The V2/.cloud heading is "Soalan belum boleh
 * diterbitkan — sila betulkan isu di bawah." (cloud-student-mechanism.md:343, design S1.3 state 3); the sentence here is kept because it names the
 * cause (nothing pupil-facing can show the question), and is listed in docs/ops/r1-release-input-team-a.md (T45 row) for sign-off.
 */
export const APPROVAL_UNSERVABLE_MESSAGE = 'Soalan ini tidak boleh dipaparkan di mana-mana aktiviti murid, jadi belum boleh diterbitkan.'

const placementOnly = (activity: string, code: string): boolean => activity === 'simulasi_paper' && code === 'not_on_published_paper'

/**
 * True when no activity serves the question and none would once the question is placed on a published paper. An unserved activity always carries a
 * reason; if one ever came with none, `[].every(...)` is true, so the second clause is false and the activity does not count as refusing (no separate
 * `reasons.length` test is needed).
 */
export function unservableEverywhere(report: ServabilityReport): boolean {
  return report.activities.every((a) => !a.served && !a.reasons.every((r) => placementOnly(a.activity, r.code)))
}

/** The `fields` of the 422: one BM sentence per activity (its first reason), keyed `servability.<activity>`, in the contract order. */
export function approvalRefusalFields(report: ServabilityReport): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const activity of SERVABILITY_ACTIVITIES) {
    const result = report.activities.find((a) => a.activity === activity)
    const first = result?.reasons[0]
    if (result && first) fields[`servability.${activity}`] = `${result.label}: ${first.message}`
  }
  return fields
}
