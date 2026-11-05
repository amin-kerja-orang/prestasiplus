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
import { COUNTED_MODES, ITEM_TINGKATAN_CODES, REDACTED_ID, SCHOOL_QUESTION_CAP } from '../domain/constants'
import { canSeeName, isStaff, meetsCohort, nameFor } from '../domain/privacy'
import {
  capPercent,
  compareIds,
  difficultyIndex,
  difficultyLevel,
  discriminationStatus,
  pct,
  round,
  type DifficultyLevel,
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
import { discriminationOf, groupBy, itemStats, nameMap, ownPupilIds, pooledByPupil, toCard } from './support'
import type {
  Ctx,
  ItemAnalysisSchoolQuery,
  PerformanceClassCard,
  PerformanceClassItemAnalysis,
  PerformanceSchoolItemAnalysis,
} from './types'

type ItemTingkatan = NonNullable<PerformanceSchoolItemAnalysis['tingkatan']>
const TINGKATAN_LABELS: readonly ItemTingkatan[] = ITEM_TINGKATAN_CODES.map((c) => c.toUpperCase() as ItemTingkatan)

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

/**
 * Analisa Item (S9, S11). Exported for BE-21. school(): 403 for role or scope, 404 when the viewer has no school; classAnalysis(): 403 for unknown or not-openable (same status, no leak). schoolId undefined = the viewer's own school (variant own).
 * S10-T03: every count (Cubaan, Betul, Salah, pupils, Soalan Diuji) and the discrimination index read the shared reader `answerFacts`, all modes (XS-8).
 * The chosen letter, the option texts, the topic chips and the stem snapshot exist only in Bijak sittings: those display-only fields still come
 * from the Bijak port where the question has a sitting fact (the stem falls back to the S1 question content), else they are empty.
 */
@Injectable()
export class ItemAnalysisService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) protected readonly directory: DirectoryPort,
    @Inject(CLOCK) protected readonly clock: Clock,
    @Optional() @Inject(HeadcountFactsService) protected readonly facts?: HeadcountFacts,
  ) {}

  /** Bijak snapshot facts of some questions for display (stem, options, topic, chosen letters), by question; none when no ids. */
  private async bijakByQuestion(scope: { schoolIds?: string[]; userIds?: string[] }, questionIds: readonly string[]): Promise<Map<string, BijakItemFact[]>> {
    if (questionIds.length === 0) return new Map()
    return groupBy(await this.ports.bijak.items({ ...scope, questionIds, modes: COUNTED_MODES.items }), (i) => i.questionId)
  }

  /** Stem of the questions that have no Bijak snapshot, from the S1 question content (read-only); '' when unknown. */
  private async stemsOf(questionIds: readonly string[]): Promise<Map<string, string>> {
    if (questionIds.length === 0) return new Map()
    const content = await this.ports.questionContent.questionContent(questionIds)
    return new Map([...content].map(([id, c]) => [id, c.question.questionText]))
  }

  /** Tingkatan (T1 to T5) of each pupil: the level of an active class, else the grade level. */
  private async levelsOfPupils(pupils: readonly { id: string; levelSlug: string | null }[]): Promise<Map<string, Set<string>>> {
    const classIds = await this.ports.classes.classIdsOfStudents(pupils.map((u) => u.id))
    const classes = new Map((await this.ports.classes.classesByIds([...new Set([...classIds.values()].flat())])).map((c) => [c.id, c]))
    const out = new Map<string, Set<string>>()
    for (const u of pupils) {
      const levels = new Set<string>()
      for (const cid of classIds.get(u.id) ?? []) {
        const c = classes.get(cid)
        if (c && c.isActive) levels.add(c.levelSlug)
      }
      if (levels.size === 0 && u.levelSlug !== null) levels.add(u.levelSlug)
      out.set(u.id, levels)
    }
    return out
  }

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
    const staff = isStaff(ctx.role)
    // Non-staff always get the all-levels view: three views of one school would let a small level be recovered by subtraction.
    const tingkatan = staff ? (TINGKATAN_LABELS.find((t) => t === query.tingkatan) ?? null) : null

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

    // Every answer of the school, all modes, in one read (XS-8). Tingkatan narrows the PUPILS (class level of an active class, else the grade level).
    const users = await this.directory.users(await this.directory.pupilIdsOfSchool(targetId))
    let pupils = [...users.values()].filter((u) => u.isActive)
    let rows = await this.ports.answerFacts.answerFacts({ schoolIds: [targetId] })
    let tingkatanOptions: ItemTingkatan[] = []
    if (staff) {
      const levels = await this.levelsOfPupils(pupils)
      const withData = new Set(rows.map((r) => r.userId))
      tingkatanOptions = TINGKATAN_LABELS.filter((t) => pupils.some((u) => withData.has(u.id) && levels.get(u.id)?.has(t.toLowerCase()) === true))
      if (tingkatan !== null) {
        pupils = pupils.filter((u) => levels.get(u.id)?.has(tingkatan.toLowerCase()) === true)
        const keep = new Set(pupils.map((u) => u.id))
        rows = rows.filter((r) => keep.has(r.userId))
      }
    }
    const pupilIds = pupils.map((u) => u.id)

    const own = await ownPupilIds(this.ports, ctx)
    const hasAnswers = rows.length > 0
    const contributors = new Set(rows.map((r) => r.userId)).size
    const suppressed = !meetsCohort(ctx.role, contributors)
    const usable = suppressed ? [] : rows

    // Questions: one row per question, hardest first.
    const denominator = Math.max(1, pupils.length)
    const all = [...itemStats(usable).values()]
      .filter((q) => meetsCohort(ctx.role, q.pupils.size))
      .sort(
        (a, b) =>
          pct(b.attempts - b.correct, b.attempts) - pct(a.attempts - a.correct, a.attempts) ||
          b.attempts - a.attempts ||
          compareIds(a.questionId, b.questionId),
      )
    const levelOf = (q: { attempts: number; correct: number }): DifficultyLevel => difficultyLevel(pct(q.correct, q.attempts))
    const difficulty = { mudah: 0, sederhana: 0, sukar: 0 }
    for (const q of all) {
      const level = levelOf(q)
      if (level === 'Mudah') difficulty.mudah++
      else if (level === 'Sederhana') difficulty.sederhana++
      else difficulty.sukar++
    }
    const shown = all.slice(0, SCHOOL_QUESTION_CAP)
    // Non-staff totals cover only the questions that are shown, so none can be recovered by subtraction.
    const shownIds = new Set(shown.map((q) => q.questionId))
    const basis = staff ? usable : usable.filter((r) => shownIds.has(r.questionId))
    const answered = basis.reduce((n, r) => n + r.attempts, 0)
    const correct = basis.reduce((n, r) => n + r.correct, 0)
    const answers = hasAnswers && !suppressed ? answered : null

    const subjectIds = [...new Set([...basis.map((r) => r.subjectId), ...shown.map((q) => q.subjectId)])].filter((id) => id !== '0')
    const subjectNames = await this.directory.subjectsOfIds(subjectIds)
    const subjectNameOf = (id: string): string => subjectNames.get(id)?.name ?? ''
    const subjects = [...groupBy(basis.filter((r) => r.subjectId !== '0'), (r) => r.subjectId)]
      .map(([subjectId, list]) => {
        const p = new Set(list.map((r) => r.userId)).size
        const ok = meetsCohort(ctx.role, p)
        const n = list.reduce((sum, r) => sum + r.attempts, 0)
        const good = list.reduce((sum, r) => sum + r.correct, 0)
        return {
          subjectId,
          name: subjectNameOf(subjectId),
          pupils: ok ? p : 0,
          questions: ok ? new Set(list.map((r) => r.questionId).filter((id) => id !== '0')).size : 0,
          accuracy: ok ? round(capPercent(pct(good, n)), 1) : 0,
          wrong: ok ? n - good : 0,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name) || compareIds(a.subjectId, b.subjectId))

    // Display-only fields of the shown questions (stem, options, topic, chosen letters): the Bijak snapshot, else the S1 question content for the stem.
    const bijak = await this.bijakByQuestion(tingkatan === null ? { schoolIds: [targetId] } : { userIds: pupilIds }, shown.map((q) => q.questionId))
    const inScope = new Set(rows.map((r) => r.userId))
    const factsOf = (questionId: string): BijakItemFact[] => (bijak.get(questionId) ?? []).filter((f) => inScope.has(f.userId))
    const stems = await this.stemsOf(shown.filter((q) => factsOf(q.questionId).length === 0).map((q) => q.questionId))
    const labels = await this.classLabels(
      shown.flatMap((q) => factsOf(q.questionId).filter((f) => !isCorrect(f)).map((f) => f.userId)),
    )
    const wrongNames = await nameMap(this.directory, [...labels.keys()])

    const questions = shown.map((q, i) => {
      const facts = factsOf(q.questionId)
      const first = facts[0]
      const pop = popularWrong(facts)
      const byPupil = groupBy(
        facts.filter((f) => !isCorrect(f)),
        (f) => f.userId,
      )
      const wrongPupils = [...byPupil.entries()]
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
        stem: first?.stem ?? stems.get(q.questionId) ?? '',
        subjectName: first?.subjectName ?? subjectNameOf(q.subjectId),
        chips: first ? [first.topic, first.subtopic].filter((c): c is string => c !== null) : [],
        level: levelOf(q),
        wrongPct: round(pct(q.attempts - q.correct, q.attempts), 1),
        attempts: q.attempts,
        pupils: q.pupils.size,
        pupilsPct: round(pct(q.pupils.size, denominator), 1),
        wrongPupils,
        correctOption: first ? optionOf(facts, first.correctLetter) : null,
        popularWrongOption: pop ? optionOf(facts, pop.letter) : null,
        popularWrongCount: pop?.times ?? 0,
      }
    })

    // DV-M08-31: the GPS card is the school's own headcount GPS, the figure of Prestasi sekolah (same rule and suppression), with its yearly series.
    const headcount = await this.schoolEntries(targetId, tingkatan === null ? null : new Set(pupilIds))
    const gps = { ...schoolGps(headcount, staff), years: gpsByYear(headcount, staff) }

    return {
      school,
      variant,
      tingkatan,
      tingkatanOptions,
      students: pupils.length,
      answers,
      questionsTested: answers === null ? null : new Set(basis.map((r) => r.questionId).filter((id) => id !== '0')).size,
      correct: answers === null ? null : correct,
      accuracy: answers === null ? null : round(capPercent(pct(correct, answered)), 1),
      difficulty,
      gps: gps.value === null ? { ...gps, years: [] } : gps,
      subjects,
      questions,
    }
  }

  private emptySchool(school: SchoolRef, variant: 'own' | 'byId', tingkatan: ItemTingkatan | null): PerformanceSchoolItemAnalysis {
    return {
      school,
      variant,
      tingkatan,
      tingkatanOptions: [],
      students: 0,
      answers: null,
      questionsTested: null,
      correct: null,
      accuracy: null,
      difficulty: { mudah: 0, sederhana: 0, sukar: 0 },
      gps: { value: null, band: null, entries: 0, years: [] },
      subjects: [],
      questions: [],
    }
  }

  /** Name of the lowest-id class of each given pupil. */
  private async classLabels(userIdList: readonly string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    const userIds = [...new Set(userIdList)]
    const classIds = await this.ports.classes.classIdsOfStudents(userIds)
    const lowest = new Map<string, string>()
    for (const userId of userIds) {
      const first = [...(classIds.get(userId) ?? [])].sort(compareIds)[0]
      if (first !== undefined) lowest.set(userId, first)
    }
    const classes = new Map((await this.ports.classes.classesByIds([...new Set(lowest.values())])).map((c) => [c.id, c]))
    for (const userId of userIds) {
      const c = classes.get(lowest.get(userId) ?? '')
      out.set(userId, c ? c.name : '')
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
    // All modes (XS-8); the class subject narrows the rows when the class has one.
    const rows = members.length === 0 ? [] : await this.ports.answerFacts.answerFacts({ userIds: members, ...subjectFilter })
    const names = await nameMap(this.directory, members)
    const nameOf = (uid: string): string => names.get(uid) ?? ''
    const stats = [...itemStats(rows).values()]

    const subjectNames = await this.directory.subjectsOfIds([...new Set(stats.map((q) => q.subjectId))].filter((s) => s !== '0'))
    const bijak = await this.bijakByQuestion({ userIds: [...members] }, stats.map((q) => q.questionId))
    const stems = await this.stemsOf(stats.filter((q) => (bijak.get(q.questionId) ?? []).length === 0).map((q) => q.questionId))

    const difficulty = stats
      .map((q) => {
        const facts = bijak.get(q.questionId) ?? []
        const first = facts[0]
        const accuracy = round(capPercent(pct(q.correct, q.attempts)), 1)
        const index = difficultyIndex(q.correct, q.attempts)
        const pop = popularWrong(facts)
        return {
          questionId: q.questionId,
          text: first?.stem ?? stems.get(q.questionId) ?? '',
          subject: first?.subjectName ?? subjectNames.get(q.subjectId)?.name ?? '',
          topic: first?.topic ?? null,
          subtopic: first?.subtopic ?? null,
          attempts: q.attempts,
          students: q.pupils.size,
          accuracy,
          index,
          level: difficultyLevel(accuracy),
          wrongStudents: [...q.pupils.entries()]
            .filter(([, p]) => p.attempts > p.correct)
            .sort(([a], [b]) => compareIds(a, b))
            .map(([userId, p]) => ({ userId, name: nameOf(userId), times: p.attempts - p.correct })),
          correctOption: first ? optionOf(facts, first.correctLetter) : null,
          popularWrong: pop ? { ...optionOf(facts, pop.letter), times: pop.times } : null,
        }
      })
      .sort((a, b) => b.index - a.index || compareIds(a.questionId, b.questionId))

    // Tahap on the whole-number % betul; each question is in exactly one tier, so the tiers sum to the question count.
    const summary = { mudah: 0, sederhana: 0, sukar: 0 }
    for (const d of difficulty) {
      if (d.level === 'Mudah') summary.mudah++
      else if (d.level === 'Sederhana') summary.sederhana++
      else summary.sukar++
    }

    // FR-GUR-6-9: per question, N = the pupils with an answer to it (any mode); the index needs at least DISCRIMINATION_MIN_MEMBERS of them.
    const pooled = pooledByPupil(rows)
    const textOf = new Map(difficulty.map((d) => [d.questionId, d.text]))
    const discriminationRows: PerformanceClassItemAnalysis['analysis']['discrimination']['rows'] = []
    for (const q of stats) {
      const d = discriminationOf(q, pooled)
      if (d === null) continue
      discriminationRows.push({
        questionId: q.questionId,
        text: textOf.get(q.questionId) ?? '',
        upperPct: d.upperPct,
        lowerPct: d.lowerPct,
        index: d.index,
        status: discriminationStatus(d.index),
      })
    }
    discriminationRows.sort((a, b) => b.index - a.index || compareIds(a.questionId, b.questionId))

    return {
      class: {
        id: cls.id,
        name: cls.name,
        subjectName: cls.subjectName,
        levelSlug: cls.classLevelSlug ?? cls.levelSlug,
        year: cls.year,
        students: members.length,
      },
      analysis: {
        questionCount: difficulty.length,
        summary,
        difficulty,
        discrimination: { sufficient: discriminationRows.length > 0, rows: discriminationRows },
      },
    }
  }
}
