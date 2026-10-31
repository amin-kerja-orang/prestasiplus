import { randomInt } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import {
  normaliseKuizCount,
  BijakKuizCheckResultSchema,
  BijakKuizPaperPageSchema,
  BijakKuizResultSchema,
  BijakKuizSessionSchema,
  type BijakKuizCheckRequest,
  type BijakKuizCheckResult,
  type BijakKuizItem,
  type BijakKuizPaperPage,
  type BijakKuizResult,
  type BijakKuizSession,
  type BijakKuizStartRequest,
} from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { mulberry32 } from '../../../db/prng'
import { PrismaService } from '../../../db/prisma.service'
import { CurriculumRepository } from '../../curriculum'
import { FilesService } from '../../files'
import { PracticePorts, practiceRewardSource } from '../../practice/ports'
import { type GradedAnswer, PracticeRepository, type ServedRef, type StoredCheck } from '../../practice/practice.repository'
import { QuestionsRepository } from '../../questions'
import type { QuestionRecord } from '../../questions/types'
import { PapersRepository } from '../papers/papers.repository'
import {
  alreadyFinished,
  invalidAnswer,
  invalidValue,
  kuizPaperNotFound,
  kuizPaperUnavailable,
  KUIZ_OVER_FETCH,
  noQuestions,
  quizNotFound,
} from './kuiz.constants'
import {
  type ItemContext,
  leafOf,
  leavesOf,
  markableLeaf,
  optionImageIds,
  questionIdOfItem,
  type OwnStimulus,
  resolveStimuli,
  stimuliWithTokens,
  toItem,
} from './kuiz.mapper'
export interface KuizCaller {
  userId: string
  /** True under Mod Pelajar: every row written is stamped `is_test`. */
  isTest: boolean
}

/** Stored mode of a random quiz: decision U8 "disimpan sebagai sesi latih tubi". */
const KUIZ_MODE = 'latih_tubi' as const

/**
 * Simulasi Kuiz (R1-B16). The random quiz is a practice session written through `PracticeRepository` (U8), so Soalan Aku
 * Salah, mastery and the reward port see it like any other practice. The per-paper quiz writes nothing.
 *
 * Marking is done here and not by `PracticeService.check`: that path serves plain text MCQs only (its question source
 * refuses a stimulus or an option picture), while the quiz serves them. The key is read from the pinned version, never
 * from the request, and is returned only after the check.
 */
@Injectable()
export class KuizService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(PracticeRepository) private readonly practice: PracticeRepository,
    @Inject(PracticePorts) private readonly ports: PracticePorts,
    @Inject(PapersRepository) private readonly papers: PapersRepository,
  ) {}

  // --- random quiz -------------------------------------------------------------------------------

  async start(caller: KuizCaller, req: BijakKuizStartRequest): Promise<BijakKuizSession> {
    const count = normaliseKuizCount(req.count)
    let subjectId: string | null = null
    if (req.subject !== undefined) {
      const subject = await this.curriculum.subjectByCode(req.subject)
      // V2: a subject filter that matches nothing is the empty state, not an error.
      if (!subject?.isActive) throw noQuestions()
      subjectId = idToString(subject.id)
    }
    // Published + active + learner-visible (secondary, not PKSK) are forced by the bank's `sample`; the shape is one objective leaf.
    const ids = await this.questions.sample(
      { type: 'mcq', singleMcqLeaf: true, ...(subjectId ? { subjectId } : {}) },
      count * KUIZ_OVER_FETCH,
      mulberry32(randomInt(0, 0x1_0000_0000)),
    )
    const records = await this.questions.getMany(ids, 'live')
    const prepared = await this.prepare(records.filter((r) => r.isActive && r.version.status === 'approved'))
    // `getMany` keeps the order of `ids` (the seeded hash order); keep the first `count` that can be answered.
    const chosen = prepared
      .flatMap((p) => {
        const leaf = leavesOf(p.record.id, p.record.version.parts)[0]
        return p.complete && leaf && markableLeaf(leaf) !== null ? [{ ...p, leaf }] : []
      })
      .slice(0, count)
    if (chosen.length === 0) throw noQuestions()

    const startedAt = this.clock.now()
    const session = await this.practice.startSession({
      userId: caller.userId,
      clientUuid: null,
      mode: KUIZ_MODE,
      subjectId,
      educationLevelId: null,
      difficulty: null,
      chapterId: null,
      year: null,
      setNo: null,
      targetQuestionId: null,
      missionId: null,
      remedialTestId: null,
      questionSetId: null,
      timeLimitSec: null,
      coinsPerCorrect: null,
      startedAt,
      isTest: caller.isTest,
      served: chosen.map((p) => ({ questionId: p.record.id, versionNo: p.record.version.versionNo })),
    })
    const tokens = await this.tokensOf(chosen.flatMap((p) => p.fileIds))
    const subjects = await this.subjectNames(chosen.map((p) => p.record))
    const items = chosen.map((p) => toItem(p.record, p.leaf, this.context(p, tokens, subjects)))
    return BijakKuizSessionSchema.parse({ sessionId: session.id, count: items.length, items })
  }

  async check(caller: KuizCaller, sessionId: string, req: BijakKuizCheckRequest): Promise<BijakKuizCheckResult> {
    const now = this.clock.now()
    return this.prisma.transaction(async () => {
      const session = await this.practice.lockSession(sessionId, caller.userId, 'update')
      if (!session) throw quizNotFound()
      if (session.status !== 'in_progress') throw alreadyFinished()
      const questionId = questionIdOfItem(req.itemId)
      const served = (await this.practice.sessionQuestions(session.id)).find((s) => s.questionId === questionId)
      if (!served || questionId === null || req.itemId !== questionId) throw invalidAnswer('itemId')

      const [record] = await this.questions.getVersions([{ questionId, versionNo: served.versionNo }])
      const ref = record ? leafOf(record, req.itemId) : null
      const leaf = ref ? markableLeaf(ref) : null
      if (!record || !leaf) throw invalidAnswer('itemId')
      if (!leaf.options.some((o) => o.label === req.optionId)) throw invalidAnswer('optionId')

      const verdict = (correct: boolean): BijakKuizCheckResult =>
        BijakKuizCheckResultSchema.parse({ correct, correctOptionId: leaf.key.correct, explanation: record.version.explanationMs })

      // One check per question: a repeat returns the stored verdict and counts nothing.
      const stored = await this.practice.check(session.id, questionId)
      if (stored) return verdict(stored.selectedLabel === leaf.key.correct)
      const correct = req.optionId === leaf.key.correct
      const inserted = await this.practice.insertCheck({
        sessionId: session.id,
        userId: caller.userId,
        questionId,
        questionVersionNo: served.versionNo,
        selectedLabel: req.optionId,
        isCorrect: correct,
        checkedAt: now,
        isTest: caller.isTest || session.isTest,
      })
      if (!inserted) {
        const winner = await this.practice.check(session.id, questionId)
        return verdict((winner?.selectedLabel ?? req.optionId) === leaf.key.correct)
      }
      return verdict(correct)
    })
  }

  async finish(caller: KuizCaller, sessionId: string, timeSpent: number | undefined): Promise<BijakKuizResult> {
    const now = this.clock.now()
    const { done, result } = await this.practice.completeSession(
      { sessionId, userId: caller.userId, now, timeSpent: timeSpent ?? 0, isTest: caller.isTest },
      {
        guard: (session) => {
          if (session.mode !== KUIZ_MODE) throw quizNotFound()
          return Promise.resolve()
        },
        regrade: (_session, served, checks) => this.regrade(served, checks),
        completed: (completed, tx) =>
          this.ports.reward.onSessionCompleted(
            {
              userId: completed.session.userId,
              sessionId: completed.session.id,
              mode: completed.session.mode,
              source: practiceRewardSource(completed.session.mode),
              correct: completed.correct,
              total: completed.total,
              timeSpent: completed.timeSpentSec,
              completedAt: completed.completedAt,
              pointsEarned: completed.pointsEarned,
              sessionCoins: completed.coinsEarned,
              isTest: caller.isTest || completed.session.isTest,
            },
            tx,
          ),
      },
    )
    return BijakKuizResultSchema.parse({
      score: done.correct,
      total: done.total,
      answered: done.answers.length,
      gamification: {
        coinsEarned: result.coinsEarned,
        streakCount: result.streakCount,
        pointsEarned: done.pointsEarned,
        totalBalance: result.totalBalance,
      },
    })
  }

  /** Grades the stored checks against the versions the session served, copying the dimensions the answer row keeps. */
  private async regrade(served: readonly ServedRef[], checks: readonly StoredCheck[]): Promise<GradedAnswer[]> {
    const versionOf = new Map(served.map((s) => [s.questionId, s.versionNo]))
    const refs = checks.map((c) => ({ questionId: c.questionId, versionNo: versionOf.get(c.questionId) ?? c.questionVersionNo }))
    const records = refs.length > 0 ? await this.questions.getVersions(refs) : []
    const byKey = new Map(records.map((r) => [`${r.id}@${String(r.version.versionNo)}`, r]))
    return checks.map((check, i) => {
      const ref = refs[i] as { questionId: string; versionNo: number }
      const record = byKey.get(`${ref.questionId}@${String(ref.versionNo)}`)
      const leaf = record ? leavesOf(record.id, record.version.parts).map(markableLeaf).find((l) => l !== null) : undefined
      const v = record?.version
      return {
        check,
        isCorrect: leaf ? leaf.key.correct === check.selectedLabel : check.isCorrect,
        subjectId: v?.subjectId ?? null,
        educationLevelId: v?.educationLevelId ?? null,
        chapterId: v?.chapterId ?? null,
        topicId: v?.topicId ?? null,
        difficulty: v?.difficultyTp == null ? null : Math.min(5, Math.max(1, v.difficultyTp)),
        questionType: 'mcq',
      }
    })
  }

  // --- per-paper quiz (not stored) -----------------------------------------------------------------

  async paperPage(caller: KuizCaller, paperId: string, page: number | undefined): Promise<BijakKuizPaperPage> {
    const paper = await this.visiblePaper(caller.userId, paperId)
    const sections = [...paper.sections].sort((a, b) => a.position - b.position)
    const pins = sections.flatMap((s) =>
      [...s.placements].sort((a, b) => a.position - b.position).map((p) => ({ questionId: idToString(p.questionId), versionNo: p.pinnedVersionNo })),
    )
    const records = await this.questions.getVersions(pins)
    const byKey = new Map(records.map((r) => [`${r.id}@${String(r.version.versionNo)}`, r]))
    // A section without a question to show is not a page (V2 PaperViewBuilder).
    const pages = sections
      .map((s) => ({
        section: s,
        questions: [...s.placements]
          .sort((a, b) => a.position - b.position)
          .flatMap((p) => {
            const r = byKey.get(`${idToString(p.questionId)}@${String(p.pinnedVersionNo)}`)
            return r ? [r] : []
          }),
      }))
      .filter((p) => p.questions.length > 0)
    const markableTotal = pages.reduce(
      (n, p) => n + p.questions.reduce((m, r) => m + leavesOf(r.id, r.version.parts).filter((l) => markableLeaf(l) !== null).length, 0),
      0,
    )
    const subject = (await this.papers.subjectsByIds([paper.subjectId])).get(paper.subjectId.toString())
    const head = { id: idToString(paper.id), title: paper.title, subjectName: subject?.name ?? '', code: paper.paperCode ?? '' }
    const wanted = page ?? 1
    if (pages.length === 0) {
      if (wanted !== 1) throw invalidValue('page')
      return BijakKuizPaperPageSchema.parse({ paper: head, page: 1, pageCount: 0, section: null, items: [], groups: [], markableTotal })
    }
    const current = pages[wanted - 1]
    if (!current) throw invalidValue('page')

    // A question whose required stimulus cannot be shown is skipped, as in random mode (V2 §1.8 is silent on this case).
    const prepared = (await this.prepare(current.questions)).filter((p) => p.complete)
    const tokens = await this.tokensOf(prepared.flatMap((p) => p.fileIds))
    const subjects = await this.subjectNames(current.questions)
    // D90: members of one stimulus group are kept together at the place of the first member, in group order, and the group
    // stimulus is rendered once in `groups`, never repeated on each member.
    const byId = new Map(prepared.map((p) => [p.record.id, p]))
    const ordered: typeof prepared = []
    const groupsSeen = new Set<string>()
    for (const q of current.questions) {
      const p = byId.get(q.id)
      if (!p) continue
      const gid = p.record.groupId
      if (gid === null) {
        ordered.push(p)
      } else if (!groupsSeen.has(gid)) {
        groupsSeen.add(gid)
        ordered.push(
          ...current.questions
            .filter((m) => m.groupId === gid)
            .sort((a, b) => (a.groupPosition ?? 0) - (b.groupPosition ?? 0))
            .flatMap((m) => byId.get(m.id) ?? []),
        )
      }
    }
    const groups: Array<{ id: string; stimuli: ReturnType<typeof stimuliWithTokens> }> = []
    const items: BijakKuizItem[] = []
    for (const p of ordered) {
      const ctx = this.context(p, tokens, subjects, 'own')
      const gid = p.record.groupId
      if (gid !== null && !groups.some((g) => g.id === gid)) groups.push({ id: gid, stimuli: stimuliWithTokens(p.resolved, tokens, 'group') })
      // The question's own stimuli are shown once, on its first leaf; later parts follow it without repeating them.
      leavesOf(p.record.id, p.record.version.parts).forEach((ref, i) => items.push(toItem(p.record, ref, i === 0 ? ctx : { ...ctx, stimuli: [] })))
    }
    return BijakKuizPaperPageSchema.parse({
      paper: head,
      page: wanted,
      pageCount: pages.length,
      section: { id: idToString(current.section.id), label: current.section.label, instruction: current.section.instruction ?? null },
      items,
      groups,
      markableTotal,
    })
  }

  async paperCheck(caller: KuizCaller, paperId: string, req: BijakKuizCheckRequest): Promise<BijakKuizCheckResult> {
    const paper = await this.visiblePaper(caller.userId, paperId)
    const questionId = questionIdOfItem(req.itemId)
    if (questionId === null) throw invalidAnswer('itemId')
    // The question must be placed on THIS paper: the pinned version of the placement is the one marked.
    const placement = paper.sections.flatMap((s) => s.placements).find((p) => idToString(p.questionId) === questionId)
    if (!placement) throw invalidAnswer('itemId')
    const [record] = await this.questions.getVersions([{ questionId, versionNo: placement.pinnedVersionNo }])
    const ref = record ? leafOf(record, req.itemId) : null
    const leaf = ref ? markableLeaf(ref) : null
    if (!record || !leaf) throw invalidAnswer('itemId')
    // V2: the option must belong to the part it claims.
    if (!leaf.options.some((o) => o.label === req.optionId)) throw invalidAnswer('optionId')
    return BijakKuizCheckResultSchema.parse({
      correct: req.optionId === leaf.key.correct,
      correctOptionId: leaf.key.correct,
      explanation: record.version.explanationMs,
    })
  }

  /** Published only; a generated (Jana) paper only for the user it was made for. Same 404 for every other case. */
  private async visiblePaper(userId: string, paperId: string) {
    if (!isIdString(paperId)) throw kuizPaperNotFound()
    const paper = await this.papers.findPaper(idFromString(paperId))
    if (!paper || paper.status !== 'published') throw kuizPaperNotFound()
    if (paper.kind === 'jana' && paper.generatedForUserId?.toString() !== userId) throw kuizPaperNotFound()
    // H-A13 / AC-R1-18.4: a paper that places a question the bank no longer serves (archived after Terbit) is refused,
    // the same rule that refuses a new sitting. Nothing is shown or marked from it.
    const placed = [...new Set(paper.sections.flatMap((s) => s.placements.map((p) => idToString(p.questionId))))]
    if (placed.length === 0 || (await this.questions.getMany(placed, 'live')).filter((r) => r.isActive && r.version.status === 'approved').length < placed.length) throw kuizPaperUnavailable()
    return paper
  }

  // --- shared -------------------------------------------------------------------------------------

  /** Groups, linked pictures and whether every stimulus can be shown, for each record (one query per kind, not per record). */
  private async prepare(records: readonly QuestionRecord[]) {
    const linked = new Set<string>()
    for (const r of records) for (const id of r.version.stimulusIds) linked.add(id)
    for (const r of records) for (const l of leavesOf(r.id, r.version.parts)) if (l.leaf.stimulusId) linked.add(l.leaf.stimulusId)
    // The question's own stimuli (R1E2E-05b): full content in link order and how many questions link each (D90). A stimulus
    // linked only to a leaf is not in the version links: its picture is read from the asset row (no text of its own).
    const [versioned, uses, assetRows] = await Promise.all([
      this.questions.versionStimuli(records.map((r) => ({ questionId: r.id, versionNo: r.version.versionNo }))),
      this.questions.stimulusUseCounts([...linked]),
      this.questions.stimulusAssets([...linked]),
    ])
    const assets = new Map<string, OwnStimulus>()
    for (const a of assetRows) {
      if (a.assetFileId) assets.set(a.id, { kind: a.kind, label: '', bodyMs: null, alt: null, caption: null, sourceCitation: null, tableData: null, assetFileId: a.assetFileId, sharedBy: uses.get(a.id) ?? 1 })
    }
    for (const list of versioned.values()) {
      for (const st of list) {
        assets.set(st.id, {
          kind: st.kind,
          label: st.label,
          bodyMs: st.bodyMs,
          alt: st.alt,
          caption: st.caption ?? null,
          sourceCitation: st.sourceCitation ?? null,
          tableData: st.tableData ?? null,
          assetFileId: st.assetFileId,
          sharedBy: uses.get(st.id) ?? 1,
        })
      }
    }
    const out = []
    for (const record of records) {
      const group = record.groupId ? await this.questions.groupOf(record.id) : null
      const resolved = resolveStimuli(record, group, assets)
      const fileIds = [...resolved.entries.flatMap((e) => (e.file ? [e.file] : [])), ...optionImageIds(record)]
      out.push({ record, resolved, complete: resolved.complete, fileIds })
    }
    return out
  }

  private context(
    p: { record: QuestionRecord; resolved: ReturnType<typeof resolveStimuli> },
    tokens: ReadonlyMap<string, string>,
    subjects: ReadonlyMap<string, string>,
    part: 'all' | 'own' = 'all',
  ): ItemContext {
    const subjectId = p.record.version.subjectId
    return {
      stimuli: stimuliWithTokens(p.resolved, tokens, part),
      subjectName: subjectId ? (subjects.get(subjectId) ?? null) : null,
      tokens,
      pick: (n) => randomInt(0, n),
    }
  }

  private async tokensOf(fileIds: readonly string[]): Promise<Map<string, string>> {
    const unique = [...new Set(fileIds)]
    return unique.length === 0 ? new Map() : this.files.publicIdsOf(unique)
  }

  private async subjectNames(records: readonly QuestionRecord[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    for (const id of new Set(records.flatMap((r) => (r.version.subjectId ? [r.version.subjectId] : [])))) {
      const s = await this.curriculum.subject(idFromString(id))
      if (s) out.set(id, s.name)
    }
    return out
  }
}
