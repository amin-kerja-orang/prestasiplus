/**
 * Auto AR (HC-3, S10-T02 Build c): AR = round(correct / attempts * 100), a whole number, over the pupil's rows of the single
 * answer store for the config's subject and calendar year (MYT), EVERY mode. One `answerFacts` call per (subject, year) group.
 * The same AR is compared with every checkpoint; stored actuals are ignored in an Auto config.
 */
import { round } from '../domain/rules'
import type { PerformancePorts } from '../ports'
import type { HeadcountConfigRecord } from './headcount.repository'
import type { HeadcountMarks } from './headcount.rules'

/** [1 Jan year, 1 Jan year + 1) in Asia/Kuala_Lumpur. */
export const yearWindow = (year: number): { from: Date; to: Date } => ({
  from: new Date(`${String(year)}-01-01T00:00:00+08:00`),
  to: new Date(`${String(year + 1)}-01-01T00:00:00+08:00`),
})

/** Config id -> pupil id -> Auto AR (null with no attempts). Only Auto configs are present. */
export async function autoArOf(
  ports: PerformancePorts,
  configs: readonly Pick<HeadcountConfigRecord, 'id' | 'subjectId' | 'academicYear' | 'mode'>[],
  rosterOf: (configId: string) => readonly string[],
): Promise<Map<string, Map<string, number | null>>> {
  const out = new Map<string, Map<string, number | null>>()
  const groups = new Map<string, { subjectId: string; year: number; configs: string[]; users: Set<string> }>()
  for (const c of configs) {
    if (c.mode !== 'auto') continue
    const key = `${c.subjectId}:${String(c.academicYear)}`
    const g = groups.get(key) ?? { subjectId: c.subjectId, year: c.academicYear, configs: [], users: new Set<string>() }
    g.configs.push(c.id)
    for (const u of rosterOf(c.id)) g.users.add(u)
    groups.set(key, g)
  }
  for (const g of groups.values()) {
    const totals = new Map<string, { attempts: number; correct: number }>()
    if (g.users.size > 0) {
      const rows = await ports.answerFacts.answerFacts({ userIds: [...g.users], subjectId: g.subjectId, ...yearWindow(g.year) })
      for (const r of rows) {
        const t = totals.get(r.userId) ?? { attempts: 0, correct: 0 }
        t.attempts += r.attempts
        t.correct += r.correct
        totals.set(r.userId, t)
      }
    }
    for (const id of g.configs) {
      const byUser = new Map<string, number | null>()
      for (const u of rosterOf(id)) {
        const t = totals.get(u)
        byUser.set(u, t === undefined || t.attempts === 0 ? null : round((t.correct / t.attempts) * 100, 0))
      }
      out.set(id, byUser)
    }
  }
  return out
}

/** The marks of an Auto pupil: the same AR at every checkpoint, stored actuals ignored. */
export const withAutoAr = (m: HeadcountMarks, ar: number | null): HeadcountMarks => ({ ...m, actuals: m.actuals.map(() => ar) })
