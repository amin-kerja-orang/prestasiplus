/**
 * Cikgu Alesa demo seed (BE-43, M13): for the demo teacher `guru@demo.test` of the core identity seed, two lesson plans
 * (RPH), one saved essay marking and, when the demo class `DEMO4S` of the classes seed exists with a subject, two pending
 * PBD tags for its two demo pupils.
 *
 * Rules: fictitious data only (no real names; the pupils' names come from the identity seed); deterministic (dates derive
 * from `ctx.clock`, scores are fixed) and idempotent (an RPH is found by teacher + subject + topic + date + source, the
 * marking by teacher + title + rubric, a tag by its unique key); `legacy_*` does not exist on these tables. No chat
 * messages are seeded, so no daily quota turn is used. Skips (does not fail) when an account it needs is missing, so it
 * can run next to a partial seed list. Runs after the classes seed.
 */
import { mytDay } from '../../src/db/clock'
import { rphContent, dateLabelOf, spOf } from '../../src/modules/cikgu/rules'
import { cikguTpOf } from '@pp/contract'
import { assertSeedAllowed } from './guard'
import type { SeedModule } from './index'

const TEACHER = 'guru@demo.test'
const PUPILS: readonly { email: string; skor: number }[] = [
  { email: 'pelajar@demo.test', skor: 72.5 },
  { email: 'pelajar2@demo.test', skor: 45 },
]
const DEMO_CLASS_CODE = 'DEMO4S'
const DAY = 24 * 60 * 60 * 1000

const ESSAY = {
  rubricKey: 'pt3_bm_karangan',
  subjectName: 'Bahasa Melayu',
  level: 'T3',
  studentName: 'Murid Contoh',
  essayTitle: 'Hari Sukan Sekolah',
  essayText: 'Pada hari sukan, semua murid berkumpul di padang. Pasukan kami bermain dengan semangat dan jujur. Kami pulang dengan gembira.',
  marks: 21,
  maxMarks: 30,
} as const

export const cikguSeed: SeedModule = {
  name: 'poc-cikgu',
  kind: 'demo',
  async run(ctx) {
    assertSeedAllowed()
    const { prisma } = ctx
    const now = ctx.clock.now()
    const teacher = await prisma.user.findFirst({ where: { email: { equals: TEACHER, mode: 'insensitive' } }, select: { id: true } })
    if (!teacher) return

    const plans = [
      { subjectName: 'Matematik', level: 'T4', tajuk: 'Fungsi Kuadratik', lessonDate: mytDay(new Date(now.getTime() + DAY)), durationMinutes: 60 },
      { subjectName: 'Sains', level: 'T2', tajuk: 'Sel dan Organisma', lessonDate: mytDay(new Date(now.getTime() - 2 * DAY)), durationMinutes: 90 },
    ] as const
    for (const p of plans) {
      const exists = await prisma.rphPlan.findFirst({
        where: { userId: teacher.id, subjectName: p.subjectName, tajuk: p.tajuk, lessonDate: new Date(`${p.lessonDate}T00:00:00Z`), source: 'form' },
        select: { id: true },
      })
      if (exists) continue
      await prisma.rphPlan.create({
        data: {
          userId: teacher.id,
          subjectName: p.subjectName,
          level: p.level,
          tajuk: p.tajuk,
          className: 'Kelas Contoh',
          lessonDate: new Date(`${p.lessonDate}T00:00:00Z`),
          durationMinutes: p.durationMinutes,
          status: 'generated',
          source: 'form',
          content: rphContent({
            subjectName: p.subjectName,
            level: p.level,
            tajuk: p.tajuk,
            className: 'Kelas Contoh',
            dateLabel: dateLabelOf(p.lessonDate),
            durationMinutes: p.durationMinutes,
            timeSlot: null,
            tema: null,
            pengajaranKeperluan: null,
          }),
          createdAt: now,
        },
      })
    }

    const marking = await prisma.essayMarking.findFirst({ where: { userId: teacher.id, essayTitle: ESSAY.essayTitle, rubricKey: ESSAY.rubricKey }, select: { id: true } })
    if (!marking) {
      const thread = await prisma.chatThread.create({ data: { userId: teacher.id, createdAt: now, updatedAt: now } })
      await prisma.essayMarking.create({
        data: {
          userId: teacher.id,
          ...ESSAY,
          comment: `Markah: ${String(ESSAY.marks)}/${String(ESSAY.maxMarks)}\nRubric: PT3 Bahasa Melayu — Karangan (30 markah)\nKomen membina:\n1. Isi: idea utama jelas; tambah satu contoh untuk setiap isi.\n2. Bahasa: ayat gramatis; kurangkan pengulangan perkataan.\n3. Cadangan: kukuhkan penutup dengan rumusan yang merujuk tajuk.`,
          threadId: thread.id,
          createdAt: now,
        },
      })
    }

    const cls = await prisma.classroom.findFirst({ where: { joinCode: { equals: DEMO_CLASS_CODE, mode: 'insensitive' }, teacherId: teacher.id } })
    if (!cls || cls.subjectId === null) return
    const subject = await prisma.subject.findUnique({ where: { id: cls.subjectId }, select: { name: true } })
    if (!subject) return
    const sp = spOf(subject.name)
    for (const p of PUPILS) {
      const pupil = await prisma.user.findFirst({ where: { email: { equals: p.email, mode: 'insensitive' } }, select: { id: true } })
      if (!pupil) continue
      await prisma.pbdTag.upsert({
        where: { userId_classroomId_studentId_sp: { userId: teacher.id, classroomId: cls.id, studentId: pupil.id, sp } },
        create: { userId: teacher.id, classroomId: cls.id, studentId: pupil.id, sp, skor: p.skor, tp: cikguTpOf(p.skor), status: 'pending', createdAt: now },
        update: {},
      })
    }
  },
}
