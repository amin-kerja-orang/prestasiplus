import type { CommandCenterGuruAchievements, CommandCenterGuruBadgeHolders } from '@pp/contract'

import { notFound } from '../http/errors'
import { percent } from '../shared/math'
import { dateKey, toMytTimestamp } from '../shared/windows'
import { cmpId, type GuruContext, type GuruDeps, sum, tallies } from './context'
import { badgeColor } from './rules'

export async function buildAchievements(deps: GuruDeps, ctx: GuruContext): Promise<CommandCenterGuruAchievements> {
  const [catalogue, awards] = await Promise.all([deps.badges.catalogue(), deps.badges.awards(ctx.ids)])
  const known = new Map(catalogue.map((b) => [b.id, b]))
  const held = awards.filter((a) => known.has(a.badgeId) && ctx.byId.has(a.userId))
  const holders = new Map<string, number>()
  const perStudent = new Map<string, number>()
  for (const a of held) {
    holders.set(a.badgeId, (holders.get(a.badgeId) ?? 0) + 1)
    perStudent.set(a.userId, (perStudent.get(a.userId) ?? 0) + 1)
  }
  const today = dateKey(ctx.now)
  const newAwards = held
    .filter((a) => dateKey(a.awardedAt) === today)
    .map((a) => ({ studentId: a.userId, name: ctx.byId.get(a.userId)?.name ?? '', badgeName: known.get(a.badgeId)?.name ?? '', icon: known.get(a.badgeId)?.icon ?? '', at: a.awardedAt }))
    .sort((a, b) => b.at.getTime() - a.at.getTime() || cmpId(a.studentId, b.studentId))
    .map(({ at, ...rest }) => ({ ...rest, awardedAt: toMytTimestamp(at) }))
  return {
    totalStudents: ctx.ids.length,
    totalNew: newAwards.length,
    badgeStats: catalogue.map((b) => ({ id: b.id, name: b.name, icon: b.icon, color: badgeColor(holders.get(b.id) ?? 0), holders: holders.get(b.id) ?? 0 })),
    topCollectors: ctx.pupils
      .filter((p) => perStudent.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, count: perStudent.get(p.id) ?? 0 }))
      .sort((a, b) => b.count - a.count || cmpId(a.id, b.id))
      .slice(0, 5)
      .map(({ name, count }) => ({ name, count })),
    newAwards,
  }
}

/** An unknown badge (every id while the badge port is empty) is 404 "Lencana tidak dijumpai.". */
export async function buildBadgeHolders(deps: GuruDeps, ctx: GuruContext, badgeId: string): Promise<CommandCenterGuruBadgeHolders> {
  const badge = (await deps.badges.catalogue()).find((b) => b.id === badgeId)
  if (!badge) throw notFound('Lencana tidak dijumpai.')
  const [awards, all] = await Promise.all([deps.badges.awards(ctx.ids, { badgeId }), tallies(deps, ctx)])
  return {
    badge: { name: badge.name, description: '' },
    holders: awards
      .filter((a) => a.badgeId === badgeId && ctx.byId.has(a.userId))
      .sort((a, b) => a.awardedAt.getTime() - b.awardedAt.getTime() || cmpId(a.userId, b.userId))
      .map((a) => {
        const t = sum(all, [a.userId])
        return { studentId: a.userId, name: ctx.byId.get(a.userId)?.name ?? '', accuracy: percent(t.correct, t.answers), awardedAt: toMytTimestamp(a.awardedAt) }
      }),
  }
}
