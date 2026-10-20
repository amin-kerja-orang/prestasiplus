import { Inject, Injectable, Logger } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import type { z } from 'zod'
import {
  PRACTICE_READS_MESSAGES,
  type PracticeReadChapterSubjectDetailSchema,
  type PracticeReadDashboard,
  type PracticeReadSubject,
  type PracticeReadSubjectConfig,
  type RoleCode,
} from '@pp/contract'

import { toMytTimestamp } from '../../../../common/time/myt'
import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, type Clock, mytDay } from '../../../../db/clock'
import { idToString } from '../../../../db/ids'
import { BannersRepository } from '../../../content/banners/banners.repository'
import { ArticlesService } from '../../../content/articles/articles.service'
import { CurriculumRepository, type SubjectWithLevels } from '../../../curriculum'
import { QuestionsRepository } from '../../../questions'
import { SubscriptionService } from '../../../subscriptions'
import { UsersRepository } from '../../../users'
import { StreakService, WalletService } from '../../../wallet'
import { OFFERED_LEVEL_CODES, UNLOCK_SCORE } from '../../rules'
import { BankFacts } from './bank-facts'
import { OverviewRepository } from './overview.repository'
import { bannerAudiences, cutQuestionText, difficultyLevelOfTp, greetingPeriod, pct, round, weekEndMyt, weekStartMyt } from './rules'

/** The caller of a read: own data only (card AC4), in the mode (real or Mod Pelajar) of the request. */
export interface Reader {
  userId: string
  role: RoleCode
  isTest: boolean
}

type PracticeReadChapterSubjectDetail = z.infer<typeof PracticeReadChapterSubjectDetailSchema>

/** Tuning of the service. `bankTtlMs`: how long the grouped bank counts are reused (0 = never; tests set 0). */
export interface OverviewOptions {
  bankTtlMs: number
}
export const OVERVIEW_OPTIONS = Symbol('OVERVIEW_OPTIONS')
/** The bank counts are global and change only when staff publish; a few seconds of reuse keeps the dashboard under the card budget on a 130k-question bank (AC5). */
export const DEFAULT_OVERVIEW_OPTIONS: OverviewOptions = { bankTtlMs: 10_000 }

const notFound = (): ApiError => ApiError.of('NOT_FOUND', { message: PRACTICE_READS_MESSAGES.notFound })

const subjectView = (s: SubjectWithLevels, bank: BankFacts): PracticeReadSubject => {
  const id = idToString(s.id)
  const n = bank.count({ subjectId: id })
  return { id, code: s.code, name: s.name, nameEn: s.nameEn, icon: s.icon, color: s.color, isCore: s.isCore, approvedCount: n, bankCount: n }
}

/**
 * Overview reads of M05 (SRS section 7 #1, #2, #3, #7, #8): the dashboard (S1), the practice subjects (S2, S3)
 * and the chapter lists (S4, S5). Nothing is stored here; every figure is derived at call time. The mock
 * handlers (`dashboard.ts`, `subjects.ts`, `chapters.ts`, `common.ts`) are the behavioural spec.
 *
 * Fields that belong to other owners are read through them: wallet and streak (BE-11), trial (BE-25),
 * banners (BE-24) and articles (BE-24, when its service is registered). Quests and badges (BE-23) have no
 * module yet and read empty.
 */
@Injectable()
export class OverviewService {
  private readonly logger = new Logger(OverviewService.name)

  constructor(
    @Inject(OverviewRepository) private readonly repo: OverviewRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SubscriptionService) private readonly subscriptions: SubscriptionService,
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(StreakService) private readonly streak: StreakService,
    @Inject(BannersRepository) private readonly banners: BannersRepository,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(OVERVIEW_OPTIONS) private readonly options: OverviewOptions,
  ) {}

  /**
   * Per process memo of the global bank counts. It is NOT invalidated when staff publish or deactivate a
   * question, so a count can be up to `bankTtlMs` (10 s by default) stale. Test boots must set `bankTtlMs: 0`
   * (see `bootOverviewApp` in apps/api/test/practice-reads/overview/helpers.ts) or they read old counts.
   */
  private bankMemo: { at: number; facts: Promise<BankFacts> } | null = null

  /** The grouped bank counts; reused for `bankTtlMs` of monotonic time (performance, not business time). */
  private bankFacts(): Promise<BankFacts> {
    const ttl = this.options.bankTtlMs
    const nowMs = performance.now()
    if (ttl > 0 && this.bankMemo && nowMs - this.bankMemo.at < ttl) return this.bankMemo.facts
    const facts = this.repo.bankMatrix().then((cells) => new BankFacts(cells))
    if (ttl > 0) {
      const memo = { at: nowMs, facts }
      this.bankMemo = memo
      facts.catch(() => {
        if (this.bankMemo === memo) this.bankMemo = null
      })
    }
    return facts
  }

  // --- S1 -------------------------------------------------------------------------------------------

  async dashboard(who: Reader): Promise<PracticeReadDashboard> {
    const now = this.clock.now()
    const from = weekStartMyt(now)
    const to = weekEndMyt(from)
    const [subjects, levels, bank, user, trial, streak, wallet, week, weekSessions, revisionTotal, usage, banners, articles, recent] = await Promise.all([
      this.curriculum.subjects({ active: true }),
      this.curriculum.levels({ active: true }),
      this.bankFacts(),
      this.users.get(who.userId),
      this.subscriptions.trial(who.userId, now),
      this.streak.get(who.userId),
      this.wallet.summary(who.userId),
      this.repo.answerFigures(who.userId, from, to, who.isTest),
      this.repo.completedSessions(who.userId, from, to, who.isTest),
      this.repo.revisionTotal(who.userId),
      this.repo.subjectUsage(),
      this.activeBanners(who.role, now),
      this.latestArticles(),
      this.recentQuestions(),
    ])
    const views = subjects.map((s) => subjectView(s, bank))
    const subjectStats = views
      .map((v) => ({
        id: v.id,
        name: v.name,
        icon: v.icon,
        color: v.color,
        bankCount: v.bankCount,
        avgDifficulty: bank.averageDifficulty(v.id),
        usedCount: usage.get(v.id) ?? 0,
      }))
      // FR-M05-28: by bankCount descending, ties by id.
      .sort((a, b) => b.bankCount - a.bankCount || (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
    return {
      user: { id: who.userId, name: user?.name ?? '', role: who.role },
      greetingPeriod: greetingPeriod(now),
      trial,
      streak: { count: streak.current, practisedToday: streak.lastActivityDate === mytDay(now) },
      wallet: { coins: wallet.currentSyiling, points: wallet.xp, level: wallet.level, levelProgressPct: wallet.levelProgressPct },
      week: { sessions: weekSessions, accuracyPct: Math.round(pct(week.correct, week.answered)) },
      banners,
      // BE-23 (challenges, badges) has not merged: nothing to show yet (open question).
      quests: [],
      questsCompleted: 0,
      badges: [],
      revisionTotal,
      articles,
      subjects: views,
      stats: {
        // No PKSK questions in the v2 store (Q-PKSK = 0), so Q-ACTIVE + Q-PKSK is Q-ACTIVE.
        totalQuestions: bank.count(),
        activeSubjects: subjects.length,
        activeLevels: levels.length,
        approvedQuestions: bank.count(),
      },
      levelPills: levels.map((l) => ({ code: l.code, name: l.name, stage: l.stage as 'primary' | 'lower_secondary' | 'upper_secondary', count: bank.count({ levelId: idToString(l.id) }) })),
      recentQuestions: recent,
      difficultyChart: bank.difficultyChart(),
      subjectStats,
    }
  }

  private async activeBanners(role: RoleCode, now: Date): Promise<PracticeReadDashboard['banners']> {
    const rows = await this.banners.active(new Date(`${mytDay(now)}T00:00:00.000Z`), bannerAudiences(role))
    return rows.map((b) => ({ type: b.bannerType, title: b.title, body: b.description }))
  }

  /** The five latest published articles, through the content module's own service when the app registers it. */
  private async latestArticles(): Promise<PracticeReadDashboard['articles']> {
    // Coupling: ContentArticlesModule does not export ArticlesService, so it is found app-wide with
    // `strict: false`. When that module is absent from the app, the lookup throws and the list degrades to [].
    let service: ArticlesService
    try {
      service = this.moduleRef.get(ArticlesService, { strict: false })
    } catch {
      return []
    }
    try {
      const { data } = await service.latest('5')
      return data.map((a) => ({ slug: a.slug, title: a.title, category: a.categoryLabel, publishedAt: a.publishedAt }))
    } catch (err) {
      this.logger.warn(`dashboard: latest articles unavailable (${err instanceof Error ? err.message : String(err)})`)
      return []
    }
  }

  /** BR-29: the five newest published objective questions, text cut at 100 characters. */
  private async recentQuestions(): Promise<PracticeReadDashboard['recentQuestions']> {
    const ids = await this.repo.newestPublishedMcqIds(5)
    // A stored question that fails to load (a bad stored key fails closed in the bank) must not take the dashboard down.
    const records = await this.questions.getMany(ids, 'live').catch((err: unknown) => {
      this.logger.warn(`dashboard: latest questions unavailable (${err instanceof Error ? err.message : String(err)})`)
      return []
    })
    const [subjects, levels] = await Promise.all([this.curriculum.subjects(), this.curriculum.levels()])
    const subjectName = new Map(subjects.map((s) => [idToString(s.id), s.name]))
    const levelCode = new Map(levels.map((l) => [idToString(l.id), l.code]))
    return records.map((r) => ({
        id: r.id,
        subjectName: (r.version.subjectId && subjectName.get(r.version.subjectId)) || '',
        difficulty: difficultyLevelOfTp(r.version.difficultyTp ?? 1),
        text: cutQuestionText(r.version.stemMs ?? r.version.stemEn ?? ''),
        createdAt: toMytTimestamp(r.createdAt),
        levelCode: (r.version.educationLevelId && levelCode.get(r.version.educationLevelId)) || '',
      }))
  }

  // --- S2 / S3 --------------------------------------------------------------------------------------

  async subjects(): Promise<PracticeReadSubject[]> {
    const [subjects, bank] = await Promise.all([this.curriculum.subjects({ active: true }), this.bankFacts()])
    return subjects.map((s) => subjectView(s, bank))
  }

  async subjectConfig(who: Reader, code: string): Promise<PracticeReadSubjectConfig> {
    const subject = await this.activeSubject(code)
    const [offered, bank, trial] = await Promise.all([this.offeredLevels(subject), this.bankFacts(), this.subscriptions.trial(who.userId, this.clock.now())])
    const subjectId = idToString(subject.id)
    const offeredIds = offered.map((l) => idToString(l.id))
    const levels = offered.map((l) => ({ id: idToString(l.id), code: l.code, name: l.name, count: bank.practice(subjectId, [idToString(l.id)]) }))
    const difficultyByLevel: PracticeReadSubjectConfig['difficultyByLevel'] = {}
    for (const l of levels) difficultyByLevel[l.id] = bank.practiceByDifficulty(subjectId, [l.id])
    return {
      subject: subjectView(subject, bank),
      total: levels.reduce((n, l) => n + l.count, 0),
      levels,
      difficultyStats: bank.practiceByDifficulty(subjectId, offeredIds),
      difficultyByLevel,
      // FR-M05-49: the mock keeps it empty (a test fixture); the v2 source is an open question.
      subjectiveCounts: {},
      trial,
    }
  }

  // --- S4 / S5 --------------------------------------------------------------------------------------

  async chapterSubjects(): Promise<{ code: string; name: string; icon: string | null; color: string; chapterCount: number; questionCount: number }[]> {
    const [subjects, bank] = await Promise.all([this.curriculum.subjects({ active: true }), this.bankFacts()])
    const out = []
    const levels = await this.curriculum.levels()
    const perSubject = subjects.map((s) => ({ s, offered: this.offeredOf(s, levels) }))
    // One chapter read per pair, then ONE question count over every chapter id.
    const { byPair } = await this.practiceChaptersOf(perSubject.flatMap(({ s, offered }) => offered.map((l) => ({ subject: s, levelId: l.id }))))
    for (const { s, offered } of perSubject) {
      const chapterCount = offered.reduce((n, l) => n + (byPair.get(`${s.id}:${l.id}`)?.length ?? 0), 0)
      // BR-15: subjects with at least one chapter at an offered level.
      if (chapterCount === 0) continue
      out.push({
        code: s.code,
        name: s.name,
        icon: s.icon,
        color: s.color,
        chapterCount,
        // FR-M05-58: Q-PRACTICE(subject).
        questionCount: bank.practice(idToString(s.id), offered.map((l) => idToString(l.id))),
      })
    }
    return out
  }

  async chapterSubject(who: Reader, code: string, levelIdQuery: string | undefined): Promise<PracticeReadChapterSubjectDetail> {
    const subject = await this.activeSubject(code)
    const offered = await this.offeredLevels(subject)
    const { byPair, counts } = await this.practiceChaptersOf(offered.map((l) => ({ subject, levelId: l.id })))
    const perLevel = offered.map((l) => ({ level: l, chapters: byPair.get(`${subject.id}:${l.id}`) ?? [] }))
    const levels = perLevel.map((p) => ({
      id: idToString(p.level.id),
      name: p.level.name,
      count: p.chapters.reduce((n, c) => n + (counts.get(idToString(c.id)) ?? 0), 0),
    }))
    // Default: the first offered level; an unknown, non-offered or non-numeric `levelId` falls back to it.
    const asked = levelIdQuery !== undefined && /^\d+$/.test(levelIdQuery.trim()) ? BigInt(levelIdQuery.trim()).toString() : undefined
    const shown = perLevel.find((p) => idToString(p.level.id) === asked) ?? perLevel[0]
    const chapters: PracticeReadChapterSubjectDetail['chapters'] = []
    if (shown) {
      const ids = shown.chapters.map((c) => idToString(c.id))
      const latest = await this.repo.chapterLatest(who.userId, ids, who.isTest)
      let prev: { complete: boolean; scorePct: number } | null = null
      for (const [i, chapter] of shown.chapters.entries()) {
        const id = ids[i] as string
        const total = counts.get(id) ?? 0
        const l = latest.get(id) ?? { answered: 0, correct: 0 }
        const scorePct = l.answered === 0 ? 0 : (l.correct / l.answered) * 100
        const complete = l.answered >= total && total > 0
        // BR-16: chapter 1 is open; chapter k is open when chapter k - 1 is complete with a score of at least 70.
        const open = i === 0 || (prev !== null && prev.complete && prev.scorePct >= UNLOCK_SCORE)
        chapters.push({
          id,
          number: chapter.chapterNumber,
          name: chapter.name ?? '',
          total,
          answered: l.answered,
          correct: l.correct,
          scorePct: round(scorePct, 1),
          remaining: Math.max(0, total - l.answered),
          state: open ? 'open' : 'locked',
          complete,
        })
        prev = { complete, scorePct }
      }
    }
    return {
      subject: { code: subject.code, name: subject.name, color: subject.color },
      levels,
      levelId: shown ? idToString(shown.level.id) : null,
      chapters,
    }
  }

  // --- helpers --------------------------------------------------------------------------------------

  /** Active subject by code (case-insensitive); unknown or inactive is 404. */
  private async activeSubject(code: string): Promise<SubjectWithLevels> {
    const subject = await this.curriculum.subjectByCode(code)
    if (!subject?.isActive) throw notFound()
    return subject
  }

  /** BR-11: the subject's level links at Darjah 1 to 4 (by code), in level order. */
  private async offeredLevels(subject: SubjectWithLevels) {
    return this.offeredOf(subject, await this.curriculum.levels())
  }

  private offeredOf(subject: SubjectWithLevels, levels: Awaited<ReturnType<CurriculumRepository['levels']>>) {
    const linked = new Set(subject.educationLevelIds.map(idToString))
    return levels.filter((l) => linked.has(idToString(l.id)) && OFFERED_LEVEL_CODES.includes(l.code))
  }

  /**
   * BR-15: for each (subject, level) pair, the active chapters with at least one chapter question, in chapter
   * order. The pairs are read in parallel and the question counts come from ONE statement over all chapter ids;
   * `counts` is returned so callers never count again.
   */
  private async practiceChaptersOf(pairs: { subject: SubjectWithLevels; levelId: bigint }[]) {
    const lists = await Promise.all(pairs.map((p) => this.curriculum.chapters(p.subject.id, p.levelId, { active: true })))
    const counts = await this.repo.chapterQuestionCounts(lists.flatMap((l) => l.map((c) => idToString(c.id))))
    const byPair = new Map<string, (typeof lists)[number]>()
    pairs.forEach((p, i) => byPair.set(`${p.subject.id}:${p.levelId}`, (lists[i] as (typeof lists)[number]).filter((c) => (counts.get(idToString(c.id)) ?? 0) > 0)))
    return { byPair, counts }
  }
}
