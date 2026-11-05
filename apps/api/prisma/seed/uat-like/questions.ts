/**
 * CI fixture questions of profile `uat-like` (S4-T01): four defect shapes on Sains Tingkatan 4 (a subject with DSKP nodes and chapters).
 * Invented, fictitious, approved (servable) MCQs. Natural key: `question_versions.number_label` (`UATLIKE-<SHAPE>-<nn>`); rows that
 * exist are never changed. Time from `ctx.clock`, difficulty and cognitive level from `ctx.prng('uat-like')`.
 *
 * Shapes (each `UAT_LIKE_PER_SHAPE` questions; a fixture of the defect, not an example to copy):
 * - `nobab`: no Bab (`chapter_id` null); unit and SP set.
 * - `nosp`: no SP tag (no `question_version_sp_nodes` row); Bab and unit set.
 * - `rajah`: stem and prompt refer to "Rajah n" but the question has no stimulus and no figure; Bab, unit and SP set.
 * - `dup`: the stem text is repeated as the only part's prompt; Bab, unit and SP set.
 */
import { QuestionPartSchema, type QuestionPart } from '@pp/contract'

import type { SeedContext } from '../index'
import { loadTags, writePart, type Tag } from '../questions'

export const UAT_LIKE_PER_SHAPE = 5
export const UAT_LIKE_SUBJECT = 'SCI'
export const UAT_LIKE_LEVEL = 'T4'
export const UAT_LIKE_LABEL_PREFIX = 'UATLIKE-'

export type UatLikeShape = 'nobab' | 'nosp' | 'rajah' | 'dup'
export const UAT_LIKE_SHAPES: readonly UatLikeShape[] = ['nobab', 'nosp', 'rajah', 'dup']

interface Spec {
  ref: string
  shape: UatLikeShape
  stem: string
  part: QuestionPart
}

const TOPICS = ['pembakaran', 'tindak balas asid dan alkali', 'getaran dan bunyi', 'sel dan organisma', 'daya dan gerakan']

const mcq = (prompt: string, n: number): QuestionPart => ({
  label: '1',
  prompt: { ms: prompt },
  mode: 'mcq',
  marks: 1,
  options: ['Pilihan pertama', 'Pilihan kedua', 'Pilihan ketiga', 'Pilihan keempat'].map((body, i) => ({ label: 'ABCD'[i] as string, body: { ms: body } })),
  key: { kind: 'option', correct: 'ABCD'[n % 4] as 'A' | 'B' | 'C' | 'D' },
})

export function buildSpecs(perShape: number = UAT_LIKE_PER_SHAPE): Spec[] {
  const specs: Spec[] = []
  for (const shape of UAT_LIKE_SHAPES) {
    for (let n = 1; n <= perShape; n++) {
      const topic = TOPICS[(n - 1) % TOPICS.length] as string
      const nn = String(n).padStart(2, '0')
      const ref = `${UAT_LIKE_LABEL_PREFIX}${shape.toUpperCase()}-${nn}`
      let stem: string
      let prompt: string
      if (shape === 'rajah') {
        stem = `Perhatikan Rajah ${n}. Soalan latihan ${nn} tentang ${topic}.`
        prompt = `Berdasarkan Rajah ${n}, nyatakan pemerhatian yang betul tentang ${topic}.`
      } else if (shape === 'dup') {
        stem = `Soalan latihan ${nn}: nyatakan satu contoh ${topic}.`
        prompt = stem
      } else {
        stem = `Soalan latihan ${nn} (${shape}) tentang ${topic}.`
        prompt = `Pilih pernyataan yang betul tentang ${topic} (set ${nn}).`
      }
      specs.push({ ref, shape, stem, part: mcq(prompt, n) })
    }
  }
  return specs
}

export async function seedUatLikeQuestions(ctx: SeedContext): Promise<void> {
  const specs = buildSpecs()
  for (const s of specs) QuestionPartSchema.parse(s.part)
  const now = ctx.clock.now()
  const prng = ctx.prng('uat-like')
  // Drawn for every spec in order, so the values do not depend on which rows already exist.
  const drawn = new Map(specs.map((s) => [s.ref, { tp: prng.int(2, 5), cognitive: prng.int(1, 4) }]))

  await ctx.prisma.$transaction(
    async (tx) => {
      const level = await tx.educationLevel.findFirstOrThrow({ where: { code: UAT_LIKE_LEVEL }, select: { id: true } })
      const subject = await tx.subject.findFirstOrThrow({ where: { code: UAT_LIKE_SUBJECT }, select: { id: true } })
      const owner = await tx.userRole.findFirst({ where: { role: 'admin' }, orderBy: { userId: 'asc' } })
      if (!owner) throw new Error('uat-like seed: core-identity must run first (needs an admin account).')
      const tags: Tag[] = await loadTags(tx, subject.id, level.id)
      if (tags.length === 0) throw new Error('uat-like seed: no DSKP unit/SP for SCI T4; run the curriculum seed first.')
      const chapter = await tx.chapter.findFirst({
        where: { subjectId: subject.id, educationLevelId: level.id, inTree: true, isActive: true },
        orderBy: [{ chapterNumber: 'asc' }, { id: 'asc' }],
        select: { id: true },
      })
      if (!chapter) throw new Error('uat-like seed: no chapter for SCI T4; run the curriculum seed first.')

      let index = 0
      for (const s of specs) {
        const tag = tags[index % tags.length] as Tag
        index += 1
        if (await tx.questionVersion.findFirst({ where: { numberLabel: s.ref }, select: { id: true } })) continue
        const draw = drawn.get(s.ref) as { tp: number; cognitive: number }
        const question = await tx.question.create({
          data: { sourceType: 'manual', createdById: owner.userId, latestVersionNo: 1, liveVersionNo: 1, isActive: true, createdAt: now, updatedAt: now },
        })
        const version = await tx.questionVersion.create({
          data: {
            questionId: question.id, versionNo: 1, status: 'approved', publishedAt: now,
            type: 'mcq', stemMs: s.stem, numberLabel: s.ref, language: 'ms',
            subjectId: subject.id, educationLevelId: level.id, unitNodeId: tag.unitNodeId,
            chapterId: s.shape === 'nobab' ? null : chapter.id, formOrigin: 't4',
            cognitiveLevel: draw.cognitive, difficultyTp: draw.tp,
            sourceKind: 'publisher', rightsStatus: 'own', createdAt: now, updatedAt: now,
          },
        })
        if (s.shape !== 'nosp') await tx.questionVersionSpNode.create({ data: { questionVersionId: version.id, nodeId: tag.spNodeId, createdAt: now } })
        await writePart(tx, version.id, s.part, 1, null, 1)
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  )
}
