import { Inject, Injectable, Optional } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../../db/clock'
import {
  CLASS_ANALYSIS_ROLES,
  ITEM_SCHOOL_ROLES,
  canOpenClassAnalysis,
  isOfficer,
  officerCoverage,
  schoolAccess,
  viewerSchoolId,
} from '../domain/access-policy'
import {
  COUNTED_MODES,
  DISCRIMINATION_GROUP_SHARE,
  DISCRIMINATION_MIN_MEMBERS,
  REDACTED_ID,
  SCHOOL_QUESTION_CAP,
} from '../domain/constants'
import { canSeeName, isStaff, meetsCohort, nameFor } from '../domain/privacy'
import {
  capPercent,
  compareIds,
  difficultyIndex,
  difficultyLevel,
  discriminationStatus,
  pct,
  round,
} from '../domain/rules'
import { HeadcountFactsService } from '../headcount/headcount-facts.service'
import {
  DIRECTORY_PORT,
  PerformancePorts,
  type BijakItemFact,
  type ClassInfo,
  type DirectoryPort,
  type OptionLetter,
  type SchoolRef,
} from '../ports'
import type { HeadcountEntryView, HeadcountFacts } from './headcount-facts.types'
import { gpsByYear, liveEntries, schoolGps } from './headcount-figures'
import { groupBy, nameMap, ownPupilIds, toCard } from './support'
import type {
  Ctx,
  ItemAnalysisSchoolQuery,
  PerformanceClassCard,
  PerformanceClassItemAnalysis,
  PerformanceSchoolItemAnalysis,
} from './types'

const isCorrect = (f: BijakItemFact): boolean => f.awarded >= f.max

const optionOf = (facts: readonly BijakItemFact[], letter: OptionLetter): { letter: OptionLetter; text: string } => {
  for (const f of facts) {
    const o = f.options.find((x) => x.letter === letter)
    if (o) return { letter, text: o.text }
  }
  return { letter, text: '' }
}

/** Most chosen wrong letter of a set of facts (lowest letter on ties) and how often; null if none. */
function popularWrong(facts: readonly BijakItemFact[]): { letter: OptionLetter; times: number } | null {
  const counts = new Map<OptionLetter, number>()
  for (const f of facts) {
    if (isCorrect(f) || f.chosenLetter === null || f.chosenLetter === f.correctLetter) continue
    counts.set(f.chosenLetter, (counts.get(f.chosenLetter) ?? 0) + 1)
  }
  let best: { letter: OptionLetter; times: number } | null = null
  for (const [letter, times] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
    if (best === null || times > best.times) best = { letter, times }
  }
  return best
}

const emptySchoolRef = (id: string): SchoolRef => ({ id, name: '', code: null, type: '', district: null, state: '' })

/** Analisa Item (S9, S11). Exported for BE-21. school(): 403 for role or scope, 404 when the viewer has no school; classAnalysis(): 403 for unknown or not-openable (same status, no leak). schoolId undefined = the viewer's own school (variant own). */
@Injectable()
export class ItemAnalysisService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) protected readonly directory: DirectoryPort,
    @Inject(CLOCK) protected readonly clock: Clock,
    @Optional() @Inject(HeadcountFactsService) protected readonly facts?: HeadcountFacts,
  ) {}

  /** Live headcount entries of a school; [] without the reader. With a tingkatan, only the entries of its pupils. */
  private async schoolEntries(schoolId: string, onlyPupils: ReadonlySet<string> | null): Promise<HeadcountEntryView[]> {
    if (!this.facts) return []
    const live = liveEntries(await this.facts.entriesInScope({ kind: 'school', schoolId }))
    return onlyPupils === null ? live : live.filter((e) => onlyPupils.has(e.studentId))
  }

  // --- S9 school ----------------------------------------------------------------------------------

  async school(ctx: Ctx, query: ItemAnalysisSchoolQuery, schoolId?: string): Promise<PerformanceSchoolItemAnalysis> {
    if (!ITEM_SCHOOL_ROLES.includes(ctx.role)) throw ApiError.of('FORBIDDEN')
    const variant = schoolId === undefined ? ('own' as const) : ('byId' as const)
    // Non-staff always get the all-levels view: three views of one school would let a small level be recovered by subtraction.
    const tingkatan = isStaff(ctx.role) && (query.tingkatan === 'T4' || query.tingkatan === 'T5') ? query.tingkatan : null

    let targetId: string
    if (schoolId === undefined) {
      const own = viewerSchoolId(ctx)
      if (own === null) throw ApiError.of('NOT_FOUND')
      targetId = own
    } else {
      targetId = schoolId
      const officerSchools = new Set<string>()
      if (isOfficer(ctx.role)) {
        const coverage = officerCoverage(ctx)
        if (coverage) for (const s of await this.directory.schoolsInScope(coverage)) officerSchools.add(s.id)
      }
      if (schoolAccess(ctx, targetId, officerSchools) === 'forbidden') throw ApiError.of('FORBIDDEN')
    }

    const school = await this.directory.school(targetId)
    if (!school) {
      if (ctx.role === 'admin' && variant === 'byId') return this.emptySchool(emptySchoolRef(targetId), variant, tingkatan)
      throw ApiError.of('NOT_FOUND')
    }

    // Pupils of the school, narrowed to the tingkatan (class level of an active class, else the grade level).
    const users = await this.directory.users(await this.directory.pupilIdsOfSchool(targetId))
    let pupils = [...users.values()].filter((u) => u.isActive)
    if (tingkatan !== null) {
      const slug = tingkatan.toLowerCase()
      const classIds = await this.ports.classes.classIdsOfStudents(pupils.map((u) => u.id))
      const classes = new Map((await this.ports.classes.classesByIds([...new Set([...classIds.values()].flat())])).map((c) => [c.id, c]))
      pupils = pupils.filter((u) => {
        const levels = new Set<string>()
        for (const cid of classIds.get(u.id) ?? []) {
          const c = classes.get(cid)
          if (c && c.isActive) levels.add(c.levelSlug)
        }
        return levels.size > 0 ? levels.has(slug) : u.levelSlug === slug
      })
    }
    const pupilIds = pupils.map((u) => u.id)
    const scopeQuery = tingkatan === null ? { schoolIds: [targetId] } : { userIds: pupilIds }
    const items = pupilIds.length === 0 && tingkatan !== null ? [] : await this.ports.bijak.items({ ...scopeQuery, modes: COUNTED_MODES.items })
    const hasSittings = items.length > 0 || (await this.ports.bijak.totals({ ...scopeQuery, modes: COUNTED_MODES.items }, 'school')).length > 0

    const own = await ownPupilIds(this.ports, ctx)
    const contributors = new Set(items.map((i) => i.userId)).size
    const suppressed = !meetsCohort(ctx.role, contributors)
    const usable = suppressed ? [] : items

    // Questions: one row per question, hardest first.
    const denominator = Math.max(1, pupils.length)
    const labels = await this.classLabels(usable)
    const wrongNames = await nameMap(this.directory, [...new Set(usable.filter((i) => !isCorrect(i)).map((i) => i.userId))])
    const all = [...groupBy(usable, (i) => i.questionId)]
      .map(([questionId, facts]) => {
        const first = facts[0] as BijakItemFact
        const attempts = facts.length
        const right = facts.filter(isCorrect).length
        const pupilSet = new Set(facts.map((f) => f.userId))
        const pop = popularWrong(facts)
        return { questionId, facts, first, attempts, right, pupilSet, pop }
      })
      .filter((q) => meetsCohort(ctx.role, q.pupilSet.size))
      .sort(
        (a, b) =>
          pct(b.attempts - b.right, b.attempts) - pct(a.attempts - a.right, a.attempts) ||
          b.attempts - a.attempts ||
          compareIds(a.questionId, b.questionId),
      )
    const difficulty = { mudah: 0, sederhana: 0, sukar: 0 }
    for (const q of all) {
      const level = difficultyLevel(difficultyIndex(q.right, q.attempts))
      if (level === 'Mudah') difficulty.mudah++
      else if (level === 'Sederhana') difficulty.sederhana++
      else difficulty.sukar++
    }
    // Non-staff totals cover only the questions that are shown, so none can be recovered by subtraction.
    const basis = isStaff(ctx.role) ? usable : all.slice(0, SCHOOL_QUESTION_CAP).flatMap((q) => q.facts)
    const correct = basis.filter(isCorrect).length
    const answers = hasSittings && !suppressed ? basis.length : null
    const subjects = [...groupBy(basis, (i) => i.subjectId)]
      .map(([subjectId, list]) => {
        const p = new Set(list.map((i) => i.userId)).size
        const ok = meetsCohort(ctx.role, p)
        const good = list.filter(isCorrect).length
        return {
          subjectId,
          name: (list[0] as BijakItemFact).subjectName,
          pupils: ok ? p : 0,
          questions: ok ? new Set(list.map((i) => i.questionId)).size : 0,
          accuracy: ok ? round(capPercent(pct(good, list.length)), 1) : 0,
          wrong: ok ? list.length - good : 0,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name) || compareIds(a.subjectId, b.subjectId))

    const questions = all.slice(0, SCHOOL_QUESTION_CAP).map((q, i) => {
      const wrong = q.facts.filter((f) => !isCorrect(f))
      const byPupil = groupBy(wrong, (f) => f.userId)
      const wrongPupils =
        ctx.role === 'student'
          ? []
          : [...byPupil.entries()]
              .sort(([a], [b]) => compareIds(a, b))
              .flatMap(([userId, list]) => {
                const letter = popularWrong(list)?.letter
                if (!letter) return []
                const visible = canSeeName(ctx.role, ctx.userId, userId, own)
                return [
                  {
                    userId: visible ? userId : REDACTED_ID,
                    name: nameFor(wrongNames.get(userId) ?? '', visible),
                    classLabel: labels.get(userId) ?? '',
                    wrongOption: letter,
                  },
                ]
              })
      return {
        rank: i + 1,
        questionId: q.questionId,
        stem: q.first.stem,
        subjectName: q.first.subjectName,
        chips: [q.first.topic, q.first.subtopic].filter((c): c is string => c !== null),
        level: difficultyLevel(difficultyIndex(q.right, q.attempts)),
        wrongPct: round(pct(q.attempts - q.right, q.attempts), 1),
        attempts: q.attempts,
        pupils: q.pupilSet.size,
        pupilsPct: round(pct(q.pupilSet.size, denominator), 1),
        wrongPupils,
        correctOption: optionOf(q.facts, q.first.correctLetter),
        popularWrongOption: q.pop ? optionOf(q.facts, q.pop.letter) : null,
        popularWrongCount: q.pop?.times ?? 0,
      }
    })

    // DV-M08-31: the GPS card is the school's own headcount GPS, the figure of Prestasi sekolah (same rule and suppression), with its yearly series.
    const headcount = await this.schoolEntries(targetId, tingkatan === null ? null : new Set(pupilIds))
    const staff = isStaff(ctx.role)
    const gps = { ...schoolGps(headcount, staff), years: gpsByYear(headcount, staff) }

    return {
      school,
      variant,
      tingkatan,
      students: pupils.length,
      answers,
      correct: answers === null ? null : correct,
      accuracy: answers === null ? null : round(capPercent(pct(correct, basis.length)), 1),
      difficulty,
      gps: gps.value === null ? { ...gps, years: [] } : gps,
      subjects,
      questions,
    }
  }

  private emptySchool(school: SchoolRef, variant: 'own' | 'byId', tingkatan: 'T4' | 'T5' | null): PerformanceSchoolItemAnalysis {
    return {
      school,
      variant,
      tingkatan,
      students: 0,
      answers: null,
      correct: null,
      accuracy: null,
      difficulty: { mudah: 0, sederhana: 0, sukar: 0 },
      gps: { value: null, band: null, entries: 0, years: [] },
      subjects: [],
      questions: [],
    }
  }

  /** Name of the lowest-id class of each pupil behind the facts. */
  private async classLabels(facts: readonly BijakItemFact[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    const userIds = [...new Set(facts.filter((f) => !isCorrect(f)).map((f) => f.userId))]
    const classIds = await this.ports.classes.classIdsOfStudents(userIds)
    const lowest = new Map<string, string>()
    for (const userId of userIds) {
      const first = [...(classIds.get(userId) ?? [])].sort(compareIds)[0]
      if (first !== undefined) lowest.set(userId, first)
    }
    const classes = new Map((await this.ports.classes.classesByIds([...new Set(lowest.values())])).map((c) => [c.id, c]))
    for (const [userId, cid] of lowest) {
      const c = classes.get(cid)
      if (c) out.set(userId, c.name)
    }
    return out
  }

  // --- S11 class ----------------------------------------------------------------------------------

  async classList(ctx: Ctx): Promise<PerformanceClassCard[]> {
    if (!CLASS_ANALYSIS_ROLES.includes(ctx.role)) throw ApiError.of('FORBIDDEN')
    if (ctx.role === 'admin') {
      return (await this.ports.classes.allClasses())
        .filter((c) => c.kind === 'classroom')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || compareIds(a.id, b.id))
        .map(toCard)
    }
    return (await this.ports.classes.classesForTeacher(ctx.userId, { includeInactive: true })).filter((c) => c.kind === 'classroom').map(toCard)
  }

  async classAnalysis(ctx: Ctx, id: string): Promise<PerformanceClassItemAnalysis> {
    if (!CLASS_ANALYSIS_ROLES.includes(ctx.role)) throw ApiError.of('FORBIDDEN')
    const cls: ClassInfo | null = await this.ports.classes.classById(id)
    if (!cls || !canOpenClassAnalysis(ctx, cls)) throw ApiError.of('FORBIDDEN')

    const members = await this.ports.classes.memberIds(cls.id)
    const subjectFilter = cls.subjectId !== null ? { subjectId: cls.subjectId } : {}
    const items = members.length === 0 ? [] : await this.ports.bijak.items({ userIds: members, ...subjectFilter, modes: COUNTED_MODES.items })
    const names = await nameMap(this.directory, members)
    const nameOf = (uid: string): string => names.get(uid) ?? ''

    const byQuestion = groupBy(items, (i) => i.questionId)
    const difficulty = [...byQuestion.entries()]
      .map(([questionId, facts]) => {
        const first = facts[0] as BijakItemFact
        const right = facts.filter(isCorrect).length
        const index = difficultyIndex(right, facts.length)
        const wrongBy = groupBy(
          facts.filter((f) => !isCorrect(f)),
          (f) => f.userId,
        )
        const pop = popularWrong(facts)
        return {
          questionId,
          text: first.stem,
          subject: first.subjectName,
          topic: first.topic,
          subtopic: first.subtopic,
          attempts: facts.length,
          students: new Set(facts.map((f) => f.userId)).size,
          accuracy: round(capPercent(pct(right, facts.length)), 1),
          index,
          level: difficultyLevel(index),
          wrongStudents: [...wrongBy.entries()]
            .sort(([a], [b]) => compareIds(a, b))
            .map(([userId, list]) => ({ userId, name: nameOf(userId), times: list.length })),
          correctOption: optionOf(facts, first.correctLetter),
          popularWrong: pop ? { ...optionOf(facts, pop.letter), times: pop.times } : null,
        }
      })
      .sort((a, b) => b.index - a.index || compareIds(a.questionId, b.questionId))

    const summary = { mudah: 0, sederhana: 0, sukar: 0 }
    for (const d of difficulty) {
      if (d.level === 'Mudah') summary.mudah++
      else if (d.level === 'Sederhana') summary.sederhana++
      else summary.sukar++
    }

    // BR-M08-19: members with a finished (graded) sitting in the class subject.
    const sittings = members.length === 0 ? [] : await this.ports.bijak.sittings({ userIds: members, ...subjectFilter, modes: COUNTED_MODES.items })
    const finished = new Set(sittings.filter((s) => !s.provisional).map((s) => s.userId))
    const n = finished.size
    const sufficient = n >= DISCRIMINATION_MIN_MEMBERS
    const rows: PerformanceClassItemAnalysis['analysis']['discrimination']['rows'] = []
    if (sufficient) {
      const perMember = new Map<string, { n: number; c: number }>()
      for (const f of items) {
        const m = perMember.get(f.userId) ?? { n: 0, c: 0 }
        m.n++
        if (isCorrect(f)) m.c++
        perMember.set(f.userId, m)
      }
      const ranked = [...finished].sort((a, b) => {
        const ma = perMember.get(a) ?? { n: 0, c: 0 }
        const mb = perMember.get(b) ?? { n: 0, c: 0 }
        return pct(mb.c, mb.n) - pct(ma.c, ma.n) || compareIds(a, b)
      })
      const g = Math.max(1, Math.round(DISCRIMINATION_GROUP_SHARE * n))
      const upper = new Set(ranked.slice(0, g))
      const lower = new Set(ranked.slice(-g))
      for (const [questionId, facts] of byQuestion) {
        const stat = (group: Set<string>) => {
          const mine = facts.filter((f) => group.has(f.userId))
          return { n: mine.length, c: mine.filter(isCorrect).length }
        }
        const u = stat(upper)
        const l = stat(lower)
        if (u.n === 0 || l.n === 0) continue
        const d = round(u.c / u.n - l.c / l.n, 3)
        rows.push({
          questionId,
          text: (facts[0] as BijakItemFact).stem,
          upperPct: round(pct(u.c, u.n), 1),
          lowerPct: round(pct(l.c, l.n), 1),
          index: d,
          status: discriminationStatus(d),
        })
      }
      rows.sort((a, b) => b.index - a.index || compareIds(a.questionId, b.questionId))
    }

    return {
      class: {
        id: cls.id,
        name: cls.name,
        subjectName: cls.subjectName,
        levelSlug: cls.classLevelSlug ?? cls.levelSlug,
        year: cls.year,
        students: members.length,
      },
      analysis: { questionCount: difficulty.length, summary, difficulty, discrimination: { sufficient, rows } },
    }
  }
}
