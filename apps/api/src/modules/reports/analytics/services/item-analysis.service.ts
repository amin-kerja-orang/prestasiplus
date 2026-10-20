import { Inject, Injectable } from '@nestjs/common'

import { isIdString } from '../../../../db/ids'
import { ClassesRepository } from '../../../classes'
import { AnalyticsRepository } from '../analytics.repository'
import { bandOf, compareIds, percent, round1, round3, stripHtml } from '../domain/rules'
import type { ItemAnalysis } from '../types'
import type { Ctx } from './scope'
import { classOptions, ownClasses, populationOf } from './teacher-scope'

/**
 * S6 item analysis (SRS M11 section 6.4; BR-M11-28; M08 BR-M08-17 to 19). Scope: the answers of the S1 population to
 * the questions of the selected subject (all when none; a selected own class without an explicit subject uses its
 * own subject). p = correct / attempts per question; D = upper-group p minus lower-group p with a group of
 * round(27 percent x N), N = the pupils with at least one finished session in scope (computed from 4 pupils).
 */
@Injectable()
export class ItemAnalysisService {
  constructor(
    @Inject(AnalyticsRepository) private readonly repo: AnalyticsRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
  ) {}

  async analyse(ctx: Ctx, query: { subjectId?: string | undefined; classroomId?: string | undefined }): Promise<ItemAnalysis> {
    const own = await ownClasses(this.classes, ctx)
    const subjectList = (await this.repo.activeSubjects()).sort((a, b) => a.name.localeCompare(b.name, 'ms', { sensitivity: 'base' }))
    const options = { subjects: subjectList, classes: classOptions(own) }

    const { classroom, ids } = await populationOf(this.classes, ctx, own, query.classroomId, false)
    if (ids.length === 0) return { options, rows: [] }

    // A subject id that cannot be an id matches nothing (an unknown id gives no rows).
    const asked = query.subjectId !== undefined && query.subjectId !== '' ? query.subjectId : null
    if (asked !== null && !isIdString(asked)) return { options, rows: [] }
    const subjectId = asked ?? classroom?.subjectId ?? null

    const [tallies, totals, finished] = await Promise.all([
      this.repo.itemTallies(ids, subjectId),
      this.repo.memberTotals(ids, subjectId),
      this.repo.practisedAmong(ids, subjectId),
    ])

    // BR-M08-19 discrimination.
    const discrimination = new Map<string, number>()
    if (finished.size >= 4) {
      const pct = (id: string): number => {
        const m = totals.get(id)
        return m ? percent(m.c, m.n) : 0
      }
      const ranked = [...finished].sort((a, b) => pct(b) - pct(a) || compareIds(a, b))
      const g = Math.max(1, Math.round(0.27 * finished.size))
      const [upper, lower] = await Promise.all([this.repo.groupTallies(ranked.slice(0, g), subjectId), this.repo.groupTallies(ranked.slice(-g), subjectId)])
      for (const t of tallies) {
        const u = upper.get(t.questionId)
        const l = lower.get(t.questionId)
        if (!u || !l || u.n === 0 || l.n === 0) continue
        discrimination.set(t.questionId, round3(u.c / u.n - l.c / l.n))
      }
    }

    const stems = await this.repo.questionStems(tallies.map((t) => t.questionId))
    const subjectNames = await this.repo.subjectNames(
      tallies.flatMap((t) => {
        const s = t.subjectId ?? stems.get(t.questionId)?.subjectId ?? null
        return s === null ? [] : [s]
      }),
    )
    const rows = tallies
      .map((t) => {
        const stem = stems.get(t.questionId)
        const p = percent(t.correct, t.attempts)
        const sid = t.subjectId ?? stem?.subjectId ?? null
        return {
          raw: p,
          row: {
            questionId: t.questionId,
            textPlain: stem ? stripHtml(stem.stem) : '',
            subjectName: sid === null ? '' : (subjectNames.get(sid) ?? ''),
            attempts: t.attempts,
            pct: round1(p),
            band: bandOf(p),
            discrimination: discrimination.get(t.questionId) ?? null,
          },
        }
      })
      // INFERRED order (mock): % betul ascending, then question id.
      .sort((a, b) => a.raw - b.raw || compareIds(a.row.questionId, b.row.questionId))
      .map((x) => x.row)
    return { options, rows }
  }
}
