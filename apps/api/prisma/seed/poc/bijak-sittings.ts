/**
 * PoC Bijak sittings seed (demo): submitted Bijak SPM sittings for the demo school DEMO001, so the school-admin
 * dashboard (BE-21) and the BE-19 performance reports show real aggregate data (their privacy gate needs
 * MIN_COHORT = 5 contributing pupils).
 *
 * What it writes (all fictitious, `@demo.test` accounts, password hash copied from `pelajar@demo.test`):
 * - 5 extra Form 4 pupils (`murid4` to `murid8@demo.test`, grade 10) at DEMO001, enrolled in "Kelas Demo Tingkatan 4"
 *   (join code `DEMO4S`) of `guru@demo.test`. With `pelajar` and `pelajar2` the class has 7 pupils.
 * - Submitted, non-test sittings on the PoC paper "Percubaan SPM Matematik Kertas 1 Set A" (10 MCQ) for `pelajar`
 *   and the 5 new pupils: one `exam` sitting each, plus a `latihan` sitting for three of them. `pelajar2` stays
 *   without Bijak history on purpose (the "no history" state).
 *
 * How the rows are produced: directly, with the SAME code as the real submit path, not by calling the HTTP service.
 * Answers are chosen from `ctx.prng`, marked with BE-16's own `gradeAttempt` (`attempts/marking`) against the PoC
 * question source, so `attempt_results.graded` has the exact shape the app writes. The `exam_attempts`,
 * `attempt_answers` and `attempt_results` rows mirror `AttemptsRepository.create/upsertAnswers/close/saveResult`; the
 * `practice_attempt_aggregates` rows (with the `school_id` snapshot, migration 0018) are written by the real
 * `PracticeAggregateService.recordGraded`.
 *
 * No wallet reward: the real exam submit credits coins through `WalletBijakReward` (`coin_ledger`, source `quiz_spm`);
 * a demo seed must not move balances, so no ledger row is written (`attempt_results.coins/points` keep their display
 * values).
 *
 * Item analysis: PoC options are ids like `mat1-pecahan-v1-o3`, not letters, so the BE-19/BE-20 item analysis ignores them. A second demo paper ("Latihan Demo Matematik Bank Soalan (Contoh)", the published BE-09 seed MCQ SEED-MCQ-MATH-T4 and -T5, marks pinned as publish does) is therefore sat by 6 pupils, marked through the BE-09 bridge (`Be09BijakQuestionSource`) with lettered options. Needs the questions seed before this one.
 *
 * Idempotent: the sitting id is a deterministic uuid of (pupil, paper, mode), an existing sitting is left alone and the
 * aggregate insert is `ON CONFLICT DO NOTHING`. Deterministic: randomness from `ctx.prng`, time from `ctx.clock`.
 */
import { createHash } from 'node:crypto'

import type { PrismaClient } from '../../../src/db/client'
import { startOfMytDay } from '../../../src/db/clock'
import type { PrismaService } from '../../../src/db/prisma.service'
import { gradeAttempt } from '../../../src/modules/bijak/attempts/marking'
import type { PartAnswer, SectionSnapshot } from '../../../src/modules/bijak/attempts/exam-core.adapter'
import { Be09BijakQuestionSource } from '../../../src/modules/bijak/question-bridge'
import { PocBijakQuestionSource } from '../../../src/modules/bijak/integration/poc-question-source'
import { POC_BANK } from '../../../src/modules/bijak/papers/poc'
import { ruleOf } from '../../../src/modules/bijak/papers/rules'
import { bijakCodeOf } from '../../../src/modules/bijak/papers/subject-codes'
import { CurriculumRepository } from '../../../src/modules/curriculum'
import { QuestionsRepository } from '../../../src/modules/questions'
import { PracticeAggregateService } from '../../../src/modules/practice/aggregate/aggregate.service'
import { assertSeedAllowed } from '../guard'
import type { SeedContext, SeedModule } from '../index'

const SCHOOL_CODE = 'DEMO001'
const CLASS_CODE = 'DEMO4S'
const TEMPLATE_EMAIL = 'pelajar@demo.test'
const PAPER_ID = 'mat-k1-2025-a'
const DAY_MS = 24 * 60 * 60 * 1000

interface NewPupil {
  email: string
  username: string
  name: string
  classLabel: string
}

/** Fictitious Form 4 pupils (grade 10), same shape as the identity seed's demo pupils. */
export const BIJAK_DEMO_PUPILS: readonly NewPupil[] = [
  { email: 'murid4@demo.test', username: 'murid04', name: 'Murid Demo Empat', classLabel: '4 Amanah' },
  { email: 'murid5@demo.test', username: 'murid05', name: 'Murid Demo Lima', classLabel: '4 Amanah' },
  { email: 'murid6@demo.test', username: 'murid06', name: 'Murid Demo Enam', classLabel: '4 Bestari' },
  { email: 'murid7@demo.test', username: 'murid07', name: 'Murid Demo Tujuh', classLabel: '4 Bestari' },
  { email: 'murid8@demo.test', username: 'murid08', name: 'Murid Demo Lapan', classLabel: '4 Cekap' },
]

interface Sitting {
  email: string
  mode: 'exam' | 'latihan'
  /** Chance of a right answer. */
  skill: number
  /** Days before the seed anchor day. */
  daysAgo: number
}

/** Planned sittings: 6 pupils, 9 sittings, ability from strong to weak. */
export const BIJAK_DEMO_SITTINGS: readonly Sitting[] = [
  { email: 'pelajar@demo.test', mode: 'exam', skill: 0.9, daysAgo: 1 },
  { email: 'murid4@demo.test', mode: 'exam', skill: 0.8, daysAgo: 2 },
  { email: 'murid5@demo.test', mode: 'exam', skill: 0.7, daysAgo: 3 },
  { email: 'murid6@demo.test', mode: 'exam', skill: 0.6, daysAgo: 4 },
  { email: 'murid7@demo.test', mode: 'exam', skill: 0.45, daysAgo: 6 },
  { email: 'murid8@demo.test', mode: 'exam', skill: 0.3, daysAgo: 8 },
  { email: 'pelajar@demo.test', mode: 'latihan', skill: 0.95, daysAgo: 5 },
  { email: 'murid5@demo.test', mode: 'latihan', skill: 0.8, daysAgo: 7 },
  { email: 'murid7@demo.test', mode: 'latihan', skill: 0.6, daysAgo: 10 },
]

/** Deterministic uuid (version 5 layout) of a name. */
function uuidOf(name: string): string {
  const b = createHash('sha1').update(`bijak-sittings:${name}`).digest().subarray(0, 16)
  b[6] = ((b[6] as number) & 0x0f) | 0x50
  b[8] = ((b[8] as number) & 0x3f) | 0x80
  const h = b.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

async function ensurePupils(prisma: PrismaClient, ctx: SeedContext): Promise<Map<string, bigint>> {
  const createdAt = ctx.clock.now()
  const school = await prisma.school.findUnique({ where: { code: SCHOOL_CODE }, select: { id: true } })
  if (!school) throw new Error(`Bijak sittings seed needs school ${SCHOOL_CODE}; run the identity seed first.`)
  const template = await prisma.user.findFirst({ where: { email: { equals: TEMPLATE_EMAIL, mode: 'insensitive' } }, select: { passwordHash: true } })
  if (!template?.passwordHash) throw new Error(`Bijak sittings seed needs ${TEMPLATE_EMAIL} (identity seed).`)

  const ids = new Map<string, bigint>()
  for (const p of BIJAK_DEMO_PUPILS) {
    const existing = await prisma.user.findFirst({ where: { email: { equals: p.email, mode: 'insensitive' } }, select: { id: true } })
    const id =
      existing?.id ??
      (
        await prisma.user.create({
          data: { name: p.name, email: p.email, username: p.username, schoolId: school.id, grade: 10, classLabel: p.classLabel, isActive: true, isSuspended: false, passwordHash: template.passwordHash, createdAt },
          select: { id: true },
        })
      ).id
    await prisma.userRole.upsert({ where: { userId_role: { userId: id, role: 'student' } }, create: { userId: id, role: 'student', createdAt }, update: {} })
    ids.set(p.email, id)
  }
  const pelajar = await prisma.user.findFirst({ where: { email: { equals: TEMPLATE_EMAIL, mode: 'insensitive' } }, select: { id: true } })
  if (pelajar) ids.set(TEMPLATE_EMAIL, pelajar.id)

  const classroom = await prisma.classroom.findFirst({ where: { joinCode: { equals: CLASS_CODE, mode: 'insensitive' } }, select: { id: true } })
  if (!classroom) throw new Error(`Bijak sittings seed needs class ${CLASS_CODE}; run the classes seed first.`)
  for (const p of BIJAK_DEMO_PUPILS) {
    const studentId = ids.get(p.email) as bigint
    await prisma.enrolment.upsert({
      where: { classroomId_studentId: { classroomId: classroom.id, studentId } },
      create: { classroomId: classroom.id, studentId, status: 'active', source: 'teacher', joinedAt: createdAt, createdAt, updatedAt: createdAt },
      update: {},
    })
  }
  return ids
}

type Bundles = Awaited<ReturnType<PocBijakQuestionSource['loadQuestions']>>

interface Target {
  /** Namespace of the deterministic attempt ids. */
  key: string
  paper: { id: bigint; title: string; kertas: number; paperCode: string | null; printedDurationMin: number }
  subjectName: string
  subject: string
  composition: SectionSnapshot[]
  bundles: Bundles
  plans: readonly Sitting[]
  /** Chance that a question is left blank. */
  blank: number
}

const correctOf = (bundles: Bundles, qid: string): string => (bundles.get(qid)?.schemes[qid] as { correct?: string } | undefined)?.correct as string

/** Marks, stores and aggregates the planned sittings of one paper (same code as the real submit path). */
async function writeSittings(ctx: SeedContext, pupils: Map<string, bigint>, aggregates: PracticeAggregateService, t: Target): Promise<void> {
  const { prisma } = ctx
  const questionIds = t.composition.flatMap((s) => s.questionIds)
  // A popular wrong answer per question, so the wrong-answer distribution is not flat.
  const pick = ctx.prng(`poc-bijak-sittings:${t.key}:distractors`)
  const popular = new Map<string, string>()
  for (const qid of questionIds) {
    const correct = correctOf(t.bundles, qid)
    const wrong = (t.bundles.get(qid)?.question.mcq?.options ?? []).map((o) => o.id).filter((id) => id !== correct)
    popular.set(qid, pick.pick(wrong))
  }
  const anchor = startOfMytDay(ctx.clock.now()).getTime()
  const rng = ctx.prng(`poc-bijak-sittings:${t.key}:answers`)
  const dur = t.paper.printedDurationMin

  for (const plan of t.plans) {
    const userId = pupils.get(plan.email)
    if (userId === undefined) throw new Error(`Bijak sittings seed: pupil ${plan.email} is missing.`)
    const attemptId = uuidOf(`${plan.email}:${t.key}:${plan.mode}`)

    // Always draw, so the stream (and every later sitting) is the same whether or not the row already exists.
    const answers = new Map<string, PartAnswer>()
    const savedAt = new Map<string, number>()
    const startedMs = anchor - plan.daysAgo * DAY_MS + (8 * 60 + rng.int(0, 8 * 60)) * 60_000
    const durationMin = rng.int(Math.max(1, Math.ceil(dur * 0.45)), Math.max(2, Math.floor(dur * 0.93)))
    for (const [i, qid] of questionIds.entries()) {
      const correct = correctOf(t.bundles, qid)
      const roll = rng.next()
      if (roll < t.blank) continue // left blank
      const right = roll < t.blank + plan.skill * (1 - t.blank)
      const options = (t.bundles.get(qid)?.question.mcq?.options ?? []).map((o) => o.id)
      const wrongPick = rng.next() < 0.6 ? (popular.get(qid) as string) : rng.pick(options.filter((id) => id !== correct))
      answers.set(qid, { choice: right ? correct : wrongPick })
      savedAt.set(qid, startedMs + Math.floor(((i + 1) / questionIds.length) * durationMin * 60_000))
    }
    const result = gradeAttempt(t.composition, t.bundles, answers)
    const startedAt = new Date(startedMs)
    const submittedAt = new Date(startedMs + durationMin * 60_000)

    const exists = await prisma.examAttempt.findUnique({ where: { id: attemptId }, select: { id: true } })
    if (!exists) {
      await prisma.$transaction(async (tx) => {
        await tx.examAttempt.create({
          data: {
            id: attemptId,
            userId,
            paperId: t.paper.id,
            paperKind: 'pilihan',
            title: t.paper.title,
            subject: t.subject,
            subjectName: t.subjectName,
            kertas: t.paper.kertas,
            paperCode: t.paper.paperCode ?? '',
            mode: plan.mode,
            status: 'submitted',
            startedAt,
            deadlineAt: plan.mode === 'exam' ? new Date(startedMs + dur * 60_000) : null,
            durationMin: dur,
            composition: t.composition as unknown as object,
            position: questionIds.length - 1,
            submittedAt,
            resultViewedAt: submittedAt,
            isTest: false,
            createdAt: startedAt,
            updatedAt: submittedAt,
          },
        })
        await tx.attemptAnswer.createMany({
          data: [...answers].map(([partId, answer]) => ({ attemptId, partId, answer: answer as unknown as object, rev: 1, savedAt: new Date(savedAt.get(partId) as number), createdAt: startedAt, updatedAt: submittedAt })),
        })
        await tx.attemptResult.create({
          data: {
            attemptId,
            score: result.score,
            maxScore: result.max,
            provisional: result.provisional,
            pendingReview: result.pendingReview,
            coins: result.coins,
            points: result.points,
            graded: { sections: result.sections, questions: result.questions } as unknown as object,
            createdAt: submittedAt,
            updatedAt: submittedAt,
          },
        })
      })
    }

    // What BE-16 emits after the commit (idempotent: a replay changes nothing).
    await aggregates.recordGraded({
      attemptId,
      userId: userId.toString(),
      isTest: false,
      paperKind: 'pilihan',
      startedAt,
      submittedAt,
      paperId: t.paper.id.toString(),
      subject: t.subject,
      kertas: t.paper.kertas,
      mode: plan.mode,
      status: 'submitted',
      score: result.score,
      max: result.max,
      provisional: result.provisional,
      regraded: false,
      questions: result.questions.map((q) => ({ questionId: q.questionId, marks: q.marks, awarded: q.awarded, attempted: q.attempted, counted: q.counted })),
    })
  }
}

/** Sittings on the BE-09 bank paper: 6 pupils, strong to weak. */
export const BIJAK_BANK_SITTINGS: readonly Sitting[] = [
  { email: 'pelajar@demo.test', mode: 'exam', skill: 0.9, daysAgo: 1 },
  { email: 'murid4@demo.test', mode: 'exam', skill: 0.7, daysAgo: 2 },
  { email: 'murid5@demo.test', mode: 'exam', skill: 0.55, daysAgo: 4 },
  { email: 'murid6@demo.test', mode: 'exam', skill: 0.5, daysAgo: 5 },
  { email: 'murid7@demo.test', mode: 'exam', skill: 0.35, daysAgo: 7 },
  { email: 'murid8@demo.test', mode: 'exam', skill: 0.2, daysAgo: 9 },
]

/** Demo paper on published BE-09 bank questions (lettered options): the item analysis reads these. */
export const BANK_PAPER_TITLE = 'Latihan Demo Matematik Bank Soalan (Contoh)'
export const BANK_QUESTION_LABELS = ['SEED-MCQ-MATH-T4', 'SEED-MCQ-MATH-T5'] as const

async function ensureBankPaper(
  ctx: SeedContext,
  subjectId: bigint,
): Promise<{ id: bigint; title: string; kertas: number; paperCode: string | null; printedDurationMin: number; sectionId: bigint; questions: { id: bigint; versionNo: number }[] }> {
  const { prisma } = ctx
  const rows = await prisma.$queryRaw<{ id: bigint; version_no: number; label: string }[]>`
    select q.id, q.live_version_no as version_no, v.number_label as label
      from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
     where v.number_label = any(${[...BANK_QUESTION_LABELS]}::text[]) and v.status = 'published'
     order by v.number_label`
  if (rows.length !== BANK_QUESTION_LABELS.length) throw new Error('Bijak sittings seed needs the published BE-09 seed questions; run the questions seed first.')
  const questions = rows.map((r) => ({ id: r.id, versionNo: r.version_no }))
  const include = { sections: { orderBy: { position: 'asc' as const }, include: { placements: { orderBy: { position: 'asc' as const } } } } }
  const now = ctx.clock.now()
  let paper = await prisma.paper.findFirst({ where: { kind: 'pilihan', title: BANK_PAPER_TITLE, subjectId }, include })
  if (!paper) {
    paper = await prisma.paper.create({
      data: {
        kind: 'pilihan',
        title: BANK_PAPER_TITLE,
        subjectId,
        kertas: 1,
        year: 2026,
        paperCode: 'DEMO/1',
        levelScope: 't4_t5',
        printedDurationMin: 20,
        instructions: ['Kertas contoh ini mengandungi 2 soalan objektif.', 'Jawab semua soalan.'],
        referenceSheets: [],
        status: 'published',
        version: 1,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
        sections: {
          create: [
            {
              position: 1,
              label: 'Objektif',
              ruleType: 'all',
              questionCount: questions.length,
              markBudget: questions.length,
              // Pinned as publish does: the live version number and the question marks (1 per MCQ).
              placements: { create: questions.map((q, j) => ({ questionId: q.id, pinnedVersionNo: q.versionNo, position: j + 1, marksOverride: 1 })) },
            },
          ],
        },
      },
      include,
    })
  }
  const section = paper.sections[0]
  if (!section) throw new Error('Bijak sittings seed: the bank demo paper has no section.')
  return { id: paper.id, title: paper.title, kertas: paper.kertas, paperCode: paper.paperCode, printedDurationMin: paper.printedDurationMin, sectionId: section.id, questions }
}

export const bijakSittingsSeed: SeedModule = {
  name: 'poc-bijak-sittings',
  kind: 'demo',
  async run(ctx) {
    assertSeedAllowed()
    const { prisma } = ctx
    const pupils = await ensurePupils(prisma, ctx)
    const service = { client: prisma, transaction: (fn: Parameters<PrismaClient['$transaction']>[0]) => prisma.$transaction(fn as never) } as unknown as PrismaService
    const aggregates = new PracticeAggregateService(service)

    const pocPaper = POC_BANK.papers.find((p) => p.id === PAPER_ID)
    if (!pocPaper) throw new Error(`PoC paper ${PAPER_ID} is not in the export.`)
    const subjectRow = await prisma.subject.findFirst({ where: { code: 'MATH' }, select: { id: true, code: true, name: true } })
    const paper = subjectRow
      ? await prisma.paper.findFirst({
          where: { kind: 'pilihan', title: pocPaper.title, subjectId: subjectRow.id },
          include: { sections: { orderBy: { position: 'asc' }, include: { placements: { orderBy: { position: 'asc' } } } } },
        })
      : null
    if (!subjectRow || !paper) throw new Error('Bijak sittings seed needs the PoC papers; run the exam seed first.')
    const subject = bijakCodeOf(subjectRow.code)

    const composition: SectionSnapshot[] = paper.sections.map((s) => ({
      id: s.id.toString(),
      label: s.label,
      ...(s.compulsory ? { compulsory: true } : {}),
      ...(s.instruction ? { instruction: s.instruction } : {}),
      rule: ruleOf(s.ruleType, s.ruleN),
      questionIds: s.placements.map((p) => p.questionId.toString()),
    }))
    const ids = composition.flatMap((s) => s.questionIds)
    const bundles = await new PocBijakQuestionSource().loadQuestions(ids)
    if (ids.some((q) => !bundles.has(q))) throw new Error('Bijak sittings seed: a PoC question is missing from the PoC source.')
    await writeSittings(ctx, pupils, aggregates, { key: PAPER_ID, paper, subjectName: subjectRow.name, subject, composition, bundles, plans: BIJAK_DEMO_SITTINGS, blank: 0.04 })

    // The same flow on a paper of BE-09 bank questions, marked through the BE-09 bridge: lettered options (A-D), so the
    // BE-19 / BE-20 item analysis has rows.
    const bank = await ensureBankPaper(ctx, subjectRow.id)
    const bankComposition: SectionSnapshot[] = [{ id: bank.sectionId.toString(), label: 'Objektif', rule: { type: 'all' }, questionIds: bank.questions.map((q) => q.id.toString()) }]
    const bankSource = new Be09BijakQuestionSource(new QuestionsRepository(service), new CurriculumRepository(service))
    const bankBundles = await bankSource.loadQuestions(bankComposition.flatMap((s) => s.questionIds))
    if (bankBundles.size !== bank.questions.length) throw new Error('Bijak sittings seed: the BE-09 bridge did not serve the bank questions.')
    await writeSittings(ctx, pupils, aggregates, { key: 'bank-mat-demo', paper: bank, subjectName: subjectRow.name, subject, composition: bankComposition, bundles: bankBundles, plans: BIJAK_BANK_SITTINGS, blank: 0 })
  },
}
