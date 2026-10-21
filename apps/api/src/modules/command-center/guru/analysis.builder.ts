import type { CommandCenterGuruEvaluation, CommandCenterGuruPredictive } from '@pp/contract'

import { percent, round, round2 } from '../shared/math'
import { DAY_MS, startOfDay } from '../shared/windows'
import { answerDaysOf, cmpId, type GuruContext, type GuruDeps, tallies } from './context'
import { EVALUATION_MSG, GRADES, evaluationRisk, gradeOfPercent, gradePoints, PREDICT_MIN_ANSWERS, predictionRisk, trendLabel } from './rules'

/** Accuracy of the last 14 days minus the 14 before; 0 when either window has no answer. */
async function trends(deps: GuruDeps, ctx: GuruContext): Promise<Map<string, number>> {
  const [now, prev] = await Promise.all([tallies(deps, ctx, ctx.windows.d14), tallies(deps, ctx, ctx.windows.prev14, true)])
  const out = new Map<string, number>()
  for (const p of ctx.pupils) {
    const a = now.get(p.id)
    const b = prev.get(p.id)
    out.set(p.id, !a || !b || a.answers === 0 || b.answers === 0 ? 0 : round(percent(a.correct, a.answers, 2) - percent(b.correct, b.answers, 2)))
  }
  return out
}

export async function buildPredictive(deps: GuruDeps, ctx: GuruContext): Promise<CommandCenterGuruPredictive> {
  const [all, trend, days] = await Promise.all([tallies(deps, ctx), trends(deps, ctx), answerDaysOf(deps, ctx)])
  const predictions = []
  for (const p of ctx.pupils) {
    const t = all.get(p.id)
    if (!t || t.answers < PREDICT_MIN_ANSWERS) continue
    const accuracy = (t.correct / t.answers) * 100
    const grade = gradeOfPercent(accuracy)
    const tr = trend.get(p.id) ?? 0
    predictions.push({
      studentId: p.id,
      studentName: p.name,
      overallAccuracy: round(accuracy),
      trend: tr,
      trendLabel: trendLabel(tr),
      consistency: round(((days.get(p.id)?.size ?? 0) / 30) * 100),
      predictedGrade: grade,
      predictedGps: gradePoints(grade),
      risk: predictionRisk(grade),
    })
  }
  predictions.sort((a, b) => a.overallAccuracy - b.overallAccuracy || cmpId(a.studentId, b.studentId))
  const gradeDistribution: Record<string, number> = {}
  for (const g of GRADES) gradeDistribution[g] = 0
  for (const p of predictions) gradeDistribution[p.predictedGrade] = (gradeDistribution[p.predictedGrade] ?? 0) + 1
  return {
    predictions,
    gradeDistribution,
    avgPredictedGps: predictions.length === 0 ? 0 : round2(predictions.reduce((n, p) => n + p.predictedGps, 0) / predictions.length),
    atRiskCount: predictions.filter((p) => p.risk === 'kritikal' || p.risk === 'tinggi').length,
    totalPredicted: predictions.length,
  }
}

export async function buildEvaluation(deps: GuruDeps, ctx: GuruContext): Promise<CommandCenterGuruEvaluation> {
  const [all, trend] = await Promise.all([tallies(deps, ctx), trends(deps, ctx)])
  const todayStart = startOfDay(ctx.now)
  const rows: CommandCenterGuruEvaluation['alerts'] = []
  for (const p of ctx.pupils) {
    const t = all.get(p.id)
    const alerts: { message: string; suggestion: string }[] = []
    // A pupil who never answered counts as inactive since the enrolment, at least 7 days (BR-M10-15).
    const since = t?.lastAt ?? p.joinedAt ?? todayStart
    const days = Math.floor((todayStart.getTime() - startOfDay(since).getTime()) / DAY_MS)
    const idle = t ? days : Math.max(7, days)
    if (idle >= 7) alerts.push({ message: EVALUATION_MSG.inactive(idle), suggestion: EVALUATION_MSG.inactiveTip })
    const accuracy = t ? (t.correct / t.answers) * 100 : 0
    if (t && t.answers > 0 && accuracy < 40) alerts.push({ message: EVALUATION_MSG.lowAccuracy(round(accuracy)), suggestion: EVALUATION_MSG.lowAccuracyTip })
    if ((trend.get(p.id) ?? 0) < -10) alerts.push({ message: EVALUATION_MSG.declining, suggestion: EVALUATION_MSG.decliningTip })
    const risk = evaluationRisk(alerts.length)
    if (risk) rows.push({ studentId: p.id, name: p.name, riskLevel: risk, alerts })
  }
  const order = { critical: 0, high: 1, medium: 2 } as const
  rows.sort((a, b) => order[a.riskLevel] - order[b.riskLevel] || cmpId(a.studentId, b.studentId))
  return {
    summary: {
      totalStudents: ctx.ids.length,
      atRisk: rows.length,
      critical: rows.filter((r) => r.riskLevel === 'critical').length,
      high: rows.filter((r) => r.riskLevel === 'high').length,
      medium: rows.filter((r) => r.riskLevel === 'medium').length,
    },
    alerts: rows,
  }
}

