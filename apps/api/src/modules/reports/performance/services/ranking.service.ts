import { Inject, Injectable } from '@nestjs/common'

import { RANKING_MIN_ANSWERS, RANKING_ROW_CAP } from '../domain/constants'
import { canSeeName, displayName, scopeVisible } from '../domain/privacy'
import { levelCodeOf, parseScope, rankingAccuracy, rankingTitle, type RankingScope } from '../domain/ranking'
import { resolveNameScope } from './name-scope'
import { DIRECTORY_PORT, PerformancePorts, type DirectoryPort, type PracticeScopeQuery } from '../ports'
import type { Ctx, PerformanceRanking } from './types'

export interface RankingQueryInput {
  scope?: string
  subjectId?: string
  tingkatan?: string
  negeri?: string
}

/**
 * Ranking table (S19). Source: `PracticeReadPort.rankingRows` (non-test practice answers), `tahap` from the
 * gamification port. A pupil is ranked from RANKING_MIN_ANSWERS answers; order: correct DESC, accuracy DESC,
 * id ASC (OQ-2). Privacy (OQ-7): full name and id only where `canSeeName` holds (own row, a teacher's own
 * class pupils, a school admin's own-school pupils, admin: all); every other row gets the first name plus the
 * last initial and a null id; a school name only in the sekolah and daerah scopes; a non-staff viewer
 * gets an empty table (total 0) for a filtered scope holding fewer than MIN_COHORT ranked pupils, and the
 * state list leaves out states with fewer than MIN_COHORT ranked pupils.
 */
@Injectable()
export class RankingService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) protected readonly directory: DirectoryPort,
  ) {}

  async rankings(ctx: Ctx, query: RankingQueryInput): Promise<PerformanceRanking> {
    const scope = parseScope(query.scope)
    const negeri = query.negeri === '' ? undefined : query.negeri
    const levelCode = levelCodeOf(query.tingkatan)
    const base: PracticeScopeQuery = {
      ...(query.subjectId !== undefined ? { subjectId: query.subjectId } : {}),
      ...(levelCode !== undefined ? { levelCode } : {}),
    }
    const title = rankingTitle(scope, negeri)
    const empty = (states: string[]): PerformanceRanking => ({ scope, title, showFooter: scope === 'nasional', states, rows: [], total: 0 })
    const visibleStates = (list: { state: string; pupils: number }[]): string[] =>
      list
        .filter((s) => scopeVisible(ctx.role, s.pupils))
        .map((s) => s.state)
        .sort()

    const geo = await this.geography(ctx, scope, negeri)
    if (geo === null) {
      // The scope can match nothing for this viewer: no rows, but the state picker still works.
      const r = await this.ports.practice.rankingRows({ ...base, minAnswers: RANKING_MIN_ANSWERS, limit: 0 })
      return empty(visibleStates(r.states))
    }

    const result = await this.ports.practice.rankingRows({ ...base, ...geo, minAnswers: RANKING_MIN_ANSWERS, limit: RANKING_ROW_CAP })
    const states = visibleStates(result.states)
    if (!scopeVisible(ctx.role, result.total)) return empty(states)

    const rows = result.rows.slice(0, RANKING_ROW_CAP)
    const profiles = await this.ports.gamification.profiles(rows.map((r) => r.userId))
    const names = await resolveNameScope(ctx, rows.map((r) => r.userId), this.ports.classes, this.directory)
    const showSchool = scope === 'sekolah' || scope === 'daerah'
    return {
      scope,
      title,
      showFooter: scope === 'nasional',
      states,
      rows: rows.map((r, i) => {
        const visible = canSeeName(ctx.role, ctx.userId, r.userId, names.ownPupils, names.schoolPupils)
        return {
          rank: i + 1,
          userId: visible ? r.userId : null,
          name: displayName(r.name, visible),
          schoolName: showSchool ? r.schoolName : '',
          tahap: profiles.get(r.userId)?.level ?? 1,
          correct: r.correct,
          accuracy: rankingAccuracy(r.correct, r.answered),
        }
      }),
      total: result.total,
    }
  }

  /** The scope's geography; null = the scope can match nothing for this viewer (no state given, no school). */
  private async geography(ctx: Ctx, scope: RankingScope | null, negeri: string | undefined): Promise<PracticeScopeQuery | null> {
    if (scope === 'negeri') return negeri === undefined ? null : { state: negeri }
    if (scope === 'daerah' || scope === 'sekolah') {
      const me = (await this.directory.users([ctx.userId])).get(ctx.userId)
      const school = me?.schoolId ? await this.directory.school(me.schoolId) : null
      if (!school) return null
      if (scope === 'sekolah') return { schoolIds: [school.id] }
      return school.district === null ? null : { state: school.state, district: school.district }
    }
    return {}
  }
}
