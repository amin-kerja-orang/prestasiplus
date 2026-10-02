/**
 * #8 S6 item analysis (SRS M11 v1.10 §6.4 ItemAnalysis; BR-M11-28, FR-M11-76…80; provisional).
 *
 * Scope: the answers of the S1 population (own classes, or the selected own class) to the questions of
 * the selected subject (all when none; a selected class without an explicit subject uses its own subject). The rules are M08's item analysis (BR-M08-17…19): p = correct ÷
 * attempts per question; D = upper-group p − lower-group p with a group of round(27 % × N), N = the
 * pupils with ≥ 1 finished session in the scope (sufficient from 4). A `classroomId` that is not an own
 * class gives no rows (FR-M11-79); the admin has no class and so no rows.
 */

import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'

import type { ItemAnalysis, ItemAnalysisRow } from '../../api/types'
import { classOptions, ownClasses, populationOf, type Viewer } from './report'
import { percent, round1, round3, stripHtml } from './rules'

/** BR-M11-28 bands: p > 70 mudah; 40 ≤ p ≤ 70 sederhana; p < 40 sukar. */
export const bandOf = (p: number): ItemAnalysisRow['band'] =>
  p > 70 ? 'mudah' : p >= 40 ? 'sederhana' : 'sukar'

export function itemAnalysis(
  viewer: Viewer,
  query: { subjectId?: number; classroomId?: number },
): ItemAnalysis {
  const own = ownClasses(viewer)
  const subjects = curriculum
    .subjects({ active: true })
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ms', { sensitivity: 'base' }))
  const options = { subjects, classes: classOptions(own) }

  const { classroomId, ids } = populationOf(viewer, own, query.classroomId, false)
  if (ids.length === 0) return { options, rows: [] }
  // A selected own class scopes the answers to its subject (M05 Q-ANS-CLASS, M08 BR-M08-17) unless a
  // subject is chosen explicitly (INFERRED; "Semua Kelas" and "Semua Subjek" keep every answer).
  const subjectId =
    query.subjectId ?? own.find((c) => c.classId === classroomId)?.subjectId ?? undefined

  const facts = practice.answerFacts(ids, subjectId === undefined ? {} : { subjectId })
  const tallies = new Map<number, { attempts: number; correct: number; subjectId: number | null }>()
  const perMember = new Map<number, { n: number; c: number }>()
  const memberAnswers = new Map<number, { questionId: number; isCorrect: boolean }[]>()
  const finished = new Set<number>()
  for (const uid of ids) {
    const mine: { questionId: number; isCorrect: boolean }[] = []
    let n = 0
    let c = 0
    for (const a of facts.get(uid) ?? []) {
      const t = tallies.get(a.questionId) ?? { attempts: 0, correct: 0, subjectId: a.subjectId }
      t.attempts++
      if (a.isCorrect) t.correct++
      tallies.set(a.questionId, t)
      n++
      if (a.isCorrect) c++
      mine.push({ questionId: a.questionId, isCorrect: a.isCorrect })
    }
    perMember.set(uid, { n, c })
    memberAnswers.set(uid, mine)
    if (practice.history(uid).some((s) => subjectId === undefined || s.subjectId === subjectId)) {
      finished.add(uid)
    }
  }

  // BR-M08-19 discrimination.
  const discrimination = new Map<number, number>()
  if (finished.size >= 4) {
    const ranked = [...finished].sort((a, b) => {
      const ma = perMember.get(a) ?? { n: 0, c: 0 }
      const mb = perMember.get(b) ?? { n: 0, c: 0 }
      return percent(mb.c, mb.n) - percent(ma.c, ma.n) || a - b
    })
    const g = Math.max(1, Math.round(0.27 * finished.size))
    const upper = new Set(ranked.slice(0, g))
    const lower = new Set(ranked.slice(-g))
    const group = (set: Set<number>, qid: number) => {
      let n = 0
      let c = 0
      for (const uid of set) {
        for (const a of memberAnswers.get(uid) ?? []) {
          if (a.questionId !== qid) continue
          n++
          if (a.isCorrect) c++
        }
      }
      return { n, c }
    }
    for (const qid of tallies.keys()) {
      const u = group(upper, qid)
      const l = group(lower, qid)
      if (u.n === 0 || l.n === 0) continue
      discrimination.set(qid, round3(u.c / u.n - l.c / l.n))
    }
  }

  const rows: ItemAnalysisRow[] = [...tallies.entries()]
    .map(([questionId, t]) => {
      const q = questions.get(questionId) ?? null
      const p = percent(t.correct, t.attempts)
      const sid = t.subjectId ?? q?.subjectId ?? null
      return {
        questionId,
        textPlain: q ? stripHtml(q.questionText) : '',
        subjectName: sid === null ? '' : (curriculum.subject(sid)?.name ?? ''),
        attempts: t.attempts,
        pct: round1(p),
        band: bandOf(p),
        discrimination: discrimination.get(questionId) ?? null,
        raw: p,
      }
    })
    // INFERRED order: % betul ascending, then question id.
    .sort((a, b) => a.raw - b.raw || a.questionId - b.questionId)
    .map(({ raw: _raw, ...row }) => {
      void _raw
      return row
    })
  return { options, rows }
}
