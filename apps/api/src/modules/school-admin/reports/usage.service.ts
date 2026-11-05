import { Inject, Injectable } from '@nestjs/common'
import type { SchoolAdminUsage } from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { K_COHORT } from '../school-admin.constants'
import { SchoolPopulation } from './population'
import { accuracyOf, modeLabelOf, participationOf, USAGE_LABELS, usagePeriodOf, usageWindow } from './windows'

/**
 * S1 usage (mock `usage`): pupils, teachers, participation, sessions, answers and accuracy of the school over `today`, `7days` or
 * `30days`, plus the sessions per mode. Pupils (XS-1), teachers (XS-3), active pupils (XS-2), answers (XS-4) and accuracy (XS-5,
 * pooled over the same answer rows, all modes) come from `XsQueries` through `SchoolPopulation`; the session count and the per-mode
 * rows are session reads (completed non-test sessions of the XS-1 pupils). The accuracy is shown only when at least `K_COHORT`
 * pupils answered (DOC DEFECT 3 keeps this suppression); a mode row keeps its session count but hides its accuracy under the same rule.
 */
@Injectable()
export class UsageService {
  constructor(
    @Inject(SchoolPopulation) private readonly population: SchoolPopulation,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async usage(schoolId: string, rawPeriod: string | undefined): Promise<SchoolAdminUsage> {
    const now = this.clock.now().getTime()
    const period = usagePeriodOf(rawPeriod)
    const window = usageWindow(period, now)
    const school = await this.population.school(schoolId)
    const [pupils, teachers] = await Promise.all([this.population.pupils(schoolId), this.population.teachers(schoolId)])
    const [rows, totals, active] = await Promise.all([
      this.population.sessions(
        pupils.map((p) => p.id),
        window.from,
        window.to,
      ),
      this.population.answerTotals(schoolId, window.from, window.to),
      this.population.activeCount(schoolId, window.from, window.to),
    ])

    const byMode = new Map<string, { sessions: number; correct: number; questions: number; users: Set<string> }>()
    let sessions = 0
    for (const r of rows) {
      sessions += r.sessions
      const label = modeLabelOf(r.mode)
      const m = byMode.get(label) ?? { sessions: 0, correct: 0, questions: 0, users: new Set<string>() }
      m.sessions += r.sessions
      m.correct += r.correct
      m.questions += r.questions
      if (r.questions > 0) m.users.add(r.userId)
      byMode.set(label, m)
    }

    return {
      school,
      period,
      label: USAGE_LABELS[period],
      tiles: {
        pupils: pupils.length,
        teachers: teachers.length,
        activePupils: active,
        participationPct: participationOf(active, pupils.length),
        sessions,
        answers: totals.answered,
        accuracy: active >= K_COHORT ? totals.accuracy : null,
      },
      modes: [...byMode.entries()]
        .map(([label, m]) => ({
          label,
          sessions: m.sessions,
          accuracy: m.users.size >= K_COHORT ? accuracyOf(m.correct, m.questions) : null,
        }))
        .sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label, 'ms', { sensitivity: 'base' })),
    }
  }
}
