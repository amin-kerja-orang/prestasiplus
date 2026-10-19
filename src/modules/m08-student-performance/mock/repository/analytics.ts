/**
 * The adaptive analytics read model (S7; SRS M08 v1.11 §7 #7; BR-M08-14, -16): SP records per
 * (user, subject, SP), bands Mahir ≥ 75 / Sederhana 50–74.9 / Lemah < 50 / Belum, the four weakest SPs
 * over all subjects, the subject tabs, the projected grade range and the DSKP map of the viewer's level.
 */

import { addDays } from '@/lib/time'
import type { UserRow } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'
import { dskp } from '@/modules/m10-teacher-class/mock'

import type { Analytics, AnalyticsSubject, Trend, WeakSp } from '../../api/types'
import type { SpRecordRow } from './types'
import { capPercent, pct, projection, round, spBand } from './rules'
import { spRecordsRepo } from './stores'

const DAY_WINDOW = 30

/** BR-M08-14 trend: accuracy of the last 30 days minus the previous 30 (≥ +5 up, ≤ −5 down, else stable; INFERRED). */
function trendOf(userId: number, subjectId: number, now: number): Trend {
  const recent = { n: 0, c: 0 }
  const before = { n: 0, c: 0 }
  const cut1 = addDays(now, -DAY_WINDOW)
  const cut2 = addDays(now, -2 * DAY_WINDOW)
  // Sessions, not answer rows: the log derives a row in about 1 ms, and a session holds its answers.
  // INFERRED: answers without a session do not count towards the trend.
  for (const s of practice.history(userId)) {
    if (s.subjectId !== subjectId) continue
    const w = s.completedAtMs >= cut1 ? recent : s.completedAtMs >= cut2 ? before : null
    if (!w) continue
    w.n += s.questionCount
    w.c += s.correctCount
  }
  if (recent.n === 0 || before.n === 0) return 'stable'
  const d = pct(recent.c, recent.n) - pct(before.c, before.n)
  return d >= 5 ? 'up' : d <= -5 ? 'down' : 'stable'
}

export function analyticsOf(user: UserRow, now: number): Analytics {
  const records = spRecordsRepo.forUser(user.id)
  const userLevelId = user.grade
  const bySubject = new Map<number, typeof records>()
  for (const r of records) bySubject.set(r.subjectId, [...(bySubject.get(r.subjectId) ?? []), r])

  const weakOf = (r: (typeof records)[number]): WeakSp | null => {
    const path = dskp.spPath(r.dskpSpId)
    const subject = curriculum.subject(r.subjectId)
    if (!path || !subject) return null
    const available = questions.spAvailable(r.dskpSpId, { levelId: path.bidang.educationLevelId })
    return {
      spId: r.dskpSpId,
      code: path.sp.code,
      title: path.sp.description,
      subjectName: subject.name,
      subjectCode: subject.code,
      answered: r.answered,
      accuracy: round(pct(r.correct, r.answered), 1),
      available,
      focusCount: Math.min(available, 25),
    }
  }
  /**
   * Lowest accuracy first; equal accuracies keep the record order (`seq`), which is the observed card order
   * of the admin (5.1.2, 3.4.1, 5.1.3, 4.2.1, …). The tie rule is INFERRED beyond that observation.
   */
  const byWeakness = (a: SpRecordRow, b: SpRecordRow) =>
    pct(a.correct, a.answered) - pct(b.correct, b.answered) || a.seq - b.seq

  const subjects: AnalyticsSubject[] = [...bySubject.entries()]
    .sort((a, b) => a[0] - b[0])
    .flatMap(([subjectId, list]) => {
      const subject = curriculum.subject(subjectId)
      if (!subject) return []
      const answered = list.reduce((a, r) => a + r.answered, 0)
      const correct = list.reduce((a, r) => a + r.correct, 0)
      const accuracy = pct(correct, answered)
      const counts = { mahir: 0, sederhana: 0, lemah: 0, belum: 0 }
      const status = new Map<number, 'mahir' | 'sederhana' | 'lemah'>()
      for (const r of list) {
        if (r.answered === 0) continue
        const band = spBand(pct(r.correct, r.answered))
        counts[band]++
        status.set(r.dskpSpId, band)
      }
      // The DSKP map of the viewer's level: one tile per SP of the subject at that level.
      const level = userLevelId === null ? undefined : curriculum.level(userLevelId)
      const tiles: AnalyticsSubject['map']['tiles'] = []
      if (level) {
        for (const bidang of dskp.bidang({ subjectId, educationLevelId: level.id })) {
          for (const sk of dskp.sk(bidang.id)) {
            for (const sp of dskp.sp(sk.id)) {
              tiles.push({
                spId: sp.id,
                code: sp.code,
                title: sp.description,
                status: status.get(sp.id) ?? 'belum',
              })
            }
          }
        }
      }
      counts.belum = tiles.filter((t) => t.status === 'belum').length
      const answeredSps = counts.mahir + counts.sederhana + counts.lemah
      // DV-13: the ring denominator is the map tile count unless mahir exceeds it.
      const ringTotal = counts.mahir > tiles.length ? answeredSps + counts.belum : tiles.length
      const weak = list
        .filter((r) => r.answered > 0 && spBand(pct(r.correct, r.answered)) === 'lemah')
        .sort(byWeakness)
        .flatMap((r) => weakOf(r) ?? [])
      return [
        {
          subjectId,
          name: subject.name,
          code: subject.code,
          accuracy: round(capPercent(accuracy), 1),
          answered,
          trend: trendOf(user.id, subjectId, now),
          projection: projection(accuracy),
          counts,
          ringTotal,
          weak,
          map: {
            caption: level ? `${level.curriculum} ${subject.name} ${level.name}` : '',
            tiles,
          },
        },
      ]
    })

  const topWeak = records
    .filter((r) => r.answered > 0 && spBand(pct(r.correct, r.answered)) === 'lemah')
    .sort(byWeakness)
    .flatMap((r) => weakOf(r) ?? [])
    .slice(0, 4)

  return { userLevelId, topWeak, subjects }
}
