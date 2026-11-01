/**
 * E2E FIXTURE (REQ-B-003, T26c): a small structured Kertas 2 pool for Matematik Tambahan (blueprint 3472/2) and ONE published (Terbit)
 * paper built from it, so a pupil can list, open and sit a Kertas 2 paper in the local end-to-end runs.
 *
 * Called ONLY from the guarded `e2e` seed (`e2e.ts`: profile `e2e`, `E2E_SEED=1`, refuses when `countsAsProduction`). It is not a seed module of its own
 * and is never reachable from the UAT or production seed path. UAT blueprints are created and Sahkan'd by the admin; this fixture does not stand in for that.
 *
 * Content: 15 generic Matematik Tambahan structured questions written for this fixture (no exam paper is copied, no real person is named). They are labelled
 * as fixtures in the source fields: `number_label` starts with `E2E-K2-`, `exam_board` and `set_label` say "E2E fixture", `exam_type` is `latihan`.
 * Shape (matches the 3472/2 blueprint): Bahagian A 7 questions of 5 to 9 marks (50 marks, all); Bahagian B 4 questions of 10 marks (choose 3);
 * Bahagian C 4 questions of 10 marks (choose 2). Every question is multi-part (2 to 5 leaves), approved, tagged with a DSKP unit and SP of its own topic, and
 * every leaf carries `difficultyTp` and `cognitiveLevel`.
 *
 * Gates: each question is validated with the real contract schema (`QuestionPartSchema`) and the real approve gate (`GATES.approve`, which includes the
 * key, tag and DSKP rules of R1-B05) BEFORE anything is written; a question that fails stops the seed. The paper is made the way the builder makes one
 * (`BuilderRepository`: `createPaper` from the active Disahkan blueprint, `replacePlacements`, `pinPlacement`, `updatePaper` to published) and the
 * structure is checked against the blueprint sections first. The integration test (`test/bijak-integration/e2e-profile-builder.spec.ts`) then runs the
 * real Terbit endpoint on it, which re-runs the builder gates.
 *
 * Idempotent: questions are keyed by `number_label`, the paper by its title; a re-run inserts nothing.
 */
import { QuestionPartSchema, type QuestionPart } from '@pp/contract'

import type { PrismaClient, TxClient } from '../../src/db/client'
import type { PrismaService } from '../../src/db/prisma.service'
import type { Prisma } from '../../src/db/generated/client'
import { mytYear, referencePanels } from '../../src/modules/bijak/papers/rules'
import { BuilderRepository } from '../../src/modules/exam/builder/builder.repository'
import { GATES } from '../../src/modules/questions/workflow/lifecycle/gates'
import type { SeedContext } from './index'
import { loadTags } from './questions/index'

export const E2E_K2_BLUEPRINT = '3472/2'
export const E2E_K2_PAPER_TITLE = 'E2E fixture: Percubaan Matematik Tambahan Kertas 2'
export const E2E_K2_LABEL_PREFIX = 'E2E-K2-'
export const E2E_K2_FIXTURE_NOTE = 'E2E fixture'

type Cog = 'mengaplikasi' | 'menganalisis' | 'menilai'
type Level = 'T4' | 'T5'
const COGS: readonly Cog[] = ['mengaplikasi', 'menganalisis', 'menilai']

interface LeafSpec {
  label: string
  prompt: string
  marks: number
  /** Numeric answer (with an absolute tolerance), accepted text answers, or marking points of a worked answer. */
  num?: { v: number; tol?: number }
  text?: string[]
  work?: { code: 'K' | 'N' | 'P'; label: string; marks: number; accept: string[] }[]
}

export interface K2Spec {
  ref: string
  section: 0 | 1 | 2
  level: Level
  /** DSKP unit code of the subject (`1.0` = chapter 1). */
  unit: string
  stem: string
  /** TP of the leaves in order (cycled); the question TP is their maximum. */
  tps: readonly number[]
  leaves: LeafSpec[]
}

const n = (label: string, prompt: string, marks: number, v: number, tol = 0): LeafSpec => ({ label, prompt, marks, num: { v, tol } })
const t = (label: string, prompt: string, marks: number, ...text: string[]): LeafSpec => ({ label, prompt, marks, text })
const w = (label: string, prompt: string, ...work: NonNullable<LeafSpec['work']>): LeafSpec => ({
  label,
  prompt,
  marks: work.reduce((s, p) => s + p.marks, 0),
  work,
})
const K = (label: string, ...accept: string[]) => ({ code: 'K' as const, label, marks: 1, accept })
const N = (label: string, ...accept: string[]) => ({ code: 'N' as const, label, marks: 1, accept })

/** The 15 fixture questions. The answers were worked by hand; the test re-checks the marks, not the arithmetic. */
export const K2_SPECS: readonly K2Spec[] = [
  // Bahagian A (7 questions, 50 marks)
  { ref: 'A1', section: 0, level: 'T4', unit: '1.0', tps: [3, 4, 4], stem: 'Diberi fungsi f(x) = 2x + 3 dan g(x) = x².',
    leaves: [n('(a)', 'Cari nilai f(4).', 1, 11), n('(b)', 'Cari nilai f⁻¹(9).', 2, 3), w('(c)', 'Cari nilai gf(1).', K('Menggantikan x = 1 ke dalam f untuk mendapat 5', 'f(1) = 5', '5'), N('gf(1) = 25', '25'))] },
  { ref: 'A2', section: 0, level: 'T4', unit: '2.0', tps: [3, 4, 4, 5], stem: 'Persamaan kuadratik 2x² − 5x − 3 = 0 diberi.',
    leaves: [w('(a)', 'Selesaikan persamaan itu.', K('Memfaktorkan: (2x + 1)(x − 3) = 0', '(2x + 1)(x − 3)', '(2x+1)(x-3)'), N('x = 3', '3', 'x = 3'), N('x = −1/2', '-1/2', '−1/2', '-0.5', 'x = -1/2')),
      n('(b)', 'Cari hasil tambah punca-punca persamaan itu.', 1, 2.5), n('(c)', 'Cari hasil darab punca-punca persamaan itu.', 1, -1.5), n('(d)', 'Cari nilai b² − 4ac bagi persamaan itu.', 1, 49)] },
  { ref: 'A3', section: 0, level: 'T4', unit: '4.0', tps: [3, 4, 4, 5], stem: 'Selesaikan masalah indeks dan logaritma berikut.',
    leaves: [n('(a)', 'Cari nilai log₂ 32.', 1, 5), n('(b)', 'Diberi log₃ x = 4, cari nilai x.', 1, 81), n('(c)', 'Selesaikan 2^(x + 1) = 32.', 2, 4), n('(d)', 'Cari nilai log₂ 8 + log₂ 4 − log₂ 2.', 2, 4)] },
  { ref: 'A4', section: 0, level: 'T4', unit: '8.0', tps: [3, 4, 5], stem: 'Diberi vektor p = (2, 3) dan q = (−1, 5).',
    leaves: [t('(a)', 'Cari p + q dalam bentuk (x, y).', 2, '(1, 8)', '(1,8)'), n('(b)', 'Cari |p|, betul kepada dua tempat perpuluhan.', 2, 3.61, 0.01),
      w('(c)', 'Cari 2p − q dalam bentuk (x, y).', K('2p = (4, 6)', '(4, 6)', '(4,6)'), K('Menolak q daripada 2p', '(4, 6) − (−1, 5)', '(4,6)-(-1,5)'), N('(5, 1)', '(5, 1)', '(5,1)'))] },
  { ref: 'A5', section: 0, level: 'T5', unit: '1.0', tps: [3, 4, 4, 5], stem: 'Sebuah sektor bulatan berjejari 6 cm mencangkum sudut 1.2 radian di pusat.',
    leaves: [n('(a)', 'Cari panjang lengkok, dalam cm.', 2, 7.2, 0.01), n('(b)', 'Cari luas sektor itu, dalam cm².', 2, 21.6, 0.01),
      w('(c)', 'Cari perimeter sektor itu, dalam cm.', K('2 × 6 + panjang lengkok', '12 + 7.2'), N('19.2', '19.2')), n('(d)', 'Tukarkan 1.2 radian kepada darjah, betul kepada dua tempat perpuluhan.', 2, 68.75, 0.01)] },
  { ref: 'A6', section: 0, level: 'T5', unit: '2.0', tps: [3, 4, 5, 5], stem: 'Satu lengkung mempunyai persamaan y = x³ − 6x² + 9x.',
    leaves: [w('(a)', 'Cari dy/dx.', K('Membezakan setiap sebutan', '3x²', '3x^2'), N('3x² − 12x + 9', '3x^2 - 12x + 9', '3x²-12x+9')),
      w('(b)', 'Cari koordinat-x bagi titik pegun lengkung itu.', K('Menetapkan dy/dx = 0', '3x² − 12x + 9 = 0', '3x^2-12x+9=0'), K('3(x − 1)(x − 3) = 0', '3(x-1)(x-3)'), N('x = 1 dan x = 3', '1 dan 3', '1, 3', 'x = 1, x = 3')),
      n('(c)', 'Cari nilai maksimum bagi y.', 2, 4), n('(d)', 'Cari nilai d²y/dx² apabila x = 3.', 2, 6)] },
  { ref: 'A7', section: 0, level: 'T5', unit: '6.0', tps: [3, 4, 4, 5], stem: 'Selesaikan masalah trigonometri berikut.',
    leaves: [w('(a)', 'Selesaikan 2 sin x = 1 bagi 0° ≤ x ≤ 360°.', K('sin x = 1/2', 'sin x = 0.5', 'sin x = 1/2'), N('x = 30°', '30', '30°'), N('x = 150°', '150', '150°')),
      n('(b)', 'Diberi tan A = 3/4 dan A ialah sudut tirus, cari sin A.', 2, 0.6, 0.001), n('(c)', 'Cari kos A.', 1, 0.8, 0.001), n('(d)', 'Cari nilai sin 2A.', 3, 0.96, 0.001)] },
  // Bahagian B (4 questions of 10 marks, choose 3)
  { ref: 'B1', section: 1, level: 'T4', unit: '6.0', tps: [4, 5, 5], stem: 'Pembolehubah x dan y dihubungkan oleh y = abˣ. Graf log₁₀ y melawan x ialah garis lurus dengan kecerunan 0.3 dan pintasan-Y 0.5.',
    leaves: [w('(a)', 'Ungkapkan y = abˣ dalam bentuk linear.', K('Mengambil log kedua-dua belah', 'log y = log a + x log b'), N('log y = (log b)x + log a', 'log y = x log b + log a')),
      n('(b)', 'Cari nilai b, betul kepada tiga tempat perpuluhan.', 2, 1.995, 0.01), n('(c)', 'Cari nilai a, betul kepada tiga tempat perpuluhan.', 2, 3.162, 0.01),
      n('(d)', 'Cari nilai y apabila x = 2, betul kepada dua tempat perpuluhan.', 2, 12.59, 0.01), n('(e)', 'Cari nilai x apabila y = 100.', 2, 5)] },
  { ref: 'B2', section: 1, level: 'T4', unit: '7.0', tps: [4, 5, 5], stem: 'Titik A ialah (1, 2) dan titik B ialah (7, 10).',
    leaves: [t('(a)', 'Cari koordinat titik tengah AB.', 2, '(4, 6)', '(4,6)'), n('(b)', 'Cari jarak AB.', 2, 10), n('(c)', 'Cari kecerunan AB, betul kepada tiga tempat perpuluhan.', 2, 1.333, 0.01),
      w('(d)', 'Cari persamaan garis lurus AB.', K('Kecerunan 4/3', '4/3', 'm = 4/3'), K('y − 2 = (4/3)(x − 1)', 'y-2=4/3(x-1)', 'y − 2 = 4/3(x − 1)'), N('3y = 4x + 2', '3y=4x+2'), N('4x − 3y + 2 = 0', '4x-3y+2=0'))] },
  { ref: 'B3', section: 1, level: 'T5', unit: '3.0', tps: [4, 5, 5], stem: 'Satu lengkung melalui titik (1, 5) dan mempunyai dy/dx = 6x² − 4x.',
    leaves: [w('(a)', 'Cari persamaan lengkung itu.', K('Mengamirkan dy/dx', '2x³', '2x^3'), N('y = 2x³ − 2x² + c', 'y=2x^3-2x^2+c'), K('Menggantikan (1, 5) untuk mendapat c', '2 − 2 + c = 5', '2-2+c=5'), N('y = 2x³ − 2x² + 5', 'y=2x^3-2x^2+5')),
      n('(b)', 'Cari nilai y apabila x = 2.', 2, 13), n('(c)', 'Nilaikan ∫₀² (6x² − 4x) dx.', 2, 8), n('(d)', 'Nilaikan ∫₁³ 3x² dx.', 2, 26)] },
  { ref: 'B4', section: 1, level: 'T5', unit: '5.0', tps: [4, 5, 5], stem: 'X ialah pemboleh ubah rawak binomial dengan n = 5 dan kebarangkalian kejayaan 0.4.',
    leaves: [n('(a)', 'Cari P(X = 0), betul kepada lima tempat perpuluhan.', 2, 0.07776, 0.0001), n('(b)', 'Cari P(X = 2), betul kepada empat tempat perpuluhan.', 2, 0.3456, 0.0001),
      n('(c)', 'Cari min X.', 2, 2), n('(d)', 'Cari varians X.', 2, 1.2, 0.001), n('(e)', 'Cari sisihan piawai X, betul kepada dua tempat perpuluhan.', 2, 1.1, 0.01)] },
  // Bahagian C (4 questions of 10 marks, choose 2)
  { ref: 'C1', section: 2, level: 'T4', unit: '9.0', tps: [4, 5, 6], stem: 'Dalam segi tiga ABC, AB = 8 cm, BC = 10 cm dan ∠ABC = 60°.',
    leaves: [n('(a)', 'Cari panjang AC, betul kepada dua tempat perpuluhan.', 2, 9.17, 0.01), n('(b)', 'Cari luas segi tiga ABC, betul kepada dua tempat perpuluhan.', 2, 34.64, 0.01),
      n('(c)', 'Cari sin ∠BAC, betul kepada tiga tempat perpuluhan.', 2, 0.945, 0.001), n('(d)', 'Cari ∠BAC, betul kepada satu tempat perpuluhan, dalam darjah.', 2, 70.9, 0.2),
      n('(e)', 'Cari jarak serenjang dari A ke BC, betul kepada dua tempat perpuluhan.', 2, 6.93, 0.01)] },
  { ref: 'C2', section: 2, level: 'T4', unit: '10.0', tps: [4, 5, 6], stem: 'Harga satu barang ialah RM40 pada tahun 2020 dan RM50 pada tahun 2023.',
    leaves: [n('(a)', 'Cari indeks harga barang itu pada tahun 2023 berasaskan tahun 2020.', 2, 125),
      n('(b)', 'Barang A mempunyai indeks 125 dengan pemberat 3 dan barang B mempunyai indeks 110 dengan pemberat 2. Cari indeks gubahan.', 3, 119),
      n('(c)', 'Harga barang C pada tahun 2020 ialah RM20 dan indeks harganya pada tahun 2023 ialah 140. Cari harga pada tahun 2023, dalam RM.', 2, 28),
      n('(d)', 'Kos satu bakul barang pada tahun 2020 ialah RM500. Dengan indeks gubahan 119, cari kos bakul itu pada tahun 2023, dalam RM.', 3, 595)] },
  { ref: 'C3', section: 2, level: 'T5', unit: '7.0', tps: [4, 5, 6], stem: 'Sebuah kilang membuat x meja dan y kerusi. Jumlah meja dan kerusi tidak melebihi 10, bilangan kerusi sekurang-kurangnya sama dengan bilangan meja, dan sekurang-kurangnya 1 meja dibuat. Keuntungan ialah P = 40x + 25y.',
    leaves: [t('(a)', 'Tulis satu ketaksamaan bagi syarat jumlah meja dan kerusi.', 2, 'x + y ≤ 10', 'x+y<=10', 'x + y <= 10', 'x+y≤10'), n('(b)', 'Cari nilai x pada titik persilangan x + y = 10 dan y = x.', 2, 5),
      n('(c)', 'Cari nilai P pada titik (1, 9).', 2, 265), w('(d)', 'Cari keuntungan maksimum.', K('Menilai P pada bucu (1, 1), (1, 9) dan (5, 5)', '65, 265, 325', '65 265 325'), K('Membandingkan nilai P', '325 ialah yang terbesar'), N('P maksimum = 325', '325', 'RM325'), N('pada (5, 5)', '(5, 5)', '(5,5)'))] },
  { ref: 'C4', section: 2, level: 'T5', unit: '8.0', tps: [4, 5, 6], stem: 'Halaju zarah ialah v = 3t² − 12t + 9 m/s, dengan t ialah masa dalam saat selepas melalui titik tetap O.',
    leaves: [n('(a)', 'Cari halaju zarah apabila t = 2, dalam m/s.', 2, -3), w('(b)', 'Cari nilai t apabila zarah berhenti seketika.', K('Menetapkan v = 0', '3t² − 12t + 9 = 0', '3t^2-12t+9=0'), K('3(t − 1)(t − 3) = 0', '3(t-1)(t-3)'), N('t = 1 dan t = 3', '1 dan 3', '1, 3')),
      n('(c)', 'Cari pecutan zarah apabila t = 3, dalam m/s².', 2, 6), n('(d)', 'Cari sesaran zarah dari O apabila t = 3, dalam m.', 3, 0)] },
]

const MARKS_PER_SECTION: readonly (readonly number[])[] = [[5, 6, 6, 7, 8, 9, 9], [10, 10, 10, 10], [10, 10, 10, 10]]

function leafOf(l: LeafSpec, i: number, tps: readonly number[]): QuestionPart {
  const base = {
    label: l.label,
    prompt: { ms: l.prompt },
    marks: l.marks,
    difficultyTp: tps[i % tps.length] as number,
    cognitiveLevel: COGS[i % COGS.length] as Cog,
  }
  if (l.num) return { ...base, mode: 'numeric', key: { kind: 'accepted', values: [{ v: l.num.v, ...(l.num.tol ? { tol: l.num.tol, tolKind: 'abs' as const } : {}) }] } }
  if (l.text) return { ...base, mode: 'short_text', key: { kind: 'accepted', values: l.text } }
  const points = (l.work ?? []).map((p, k) => ({ id: `p${String(k + 1)}`, code: p.code, label: p.label, marks: p.marks, accept: p.accept }))
  return { ...base, mode: 'working', key: { kind: 'points', marks: l.marks, points } }
}

/** The part trees of a spec (pure). */
export function partsOf(spec: K2Spec): QuestionPart[] {
  return spec.leaves.map((l, i) => leafOf(l, i, spec.tps))
}

export const totalMarks = (spec: K2Spec): number => spec.leaves.reduce((s, l) => s + l.marks, 0)
export const labelOf = (spec: K2Spec): string => `${E2E_K2_LABEL_PREFIX}${spec.ref}`

/** Structure self-check of the fixture against the 3472/2 shape (pure; the seed and the test both run it). */
export function assertFixtureShape(specs: readonly K2Spec[] = K2_SPECS): void {
  for (const s of [0, 1, 2] as const) {
    const marks = specs.filter((q) => q.section === s).map(totalMarks)
    if (JSON.stringify(marks) !== JSON.stringify(MARKS_PER_SECTION[s])) throw new Error(`e2e-k2: section ${String(s + 1)} marks ${marks.join(',')} do not match the 3472/2 shape`)
  }
  for (const q of specs) {
    if (q.leaves.length < 2) throw new Error(`e2e-k2: ${q.ref} is not multi-part`)
    if (totalMarks(q) < 5 || totalMarks(q) > 10) throw new Error(`e2e-k2: ${q.ref} is outside 5 to 10 marks`)
    for (const p of partsOf(q)) QuestionPartSchema.parse(p)
  }
}

interface Resolved {
  unitNodeId: bigint
  spNodeId: bigint
}

async function resolveTag(tx: TxClient, subjectId: bigint, levelId: bigint, unitCode: string): Promise<Resolved> {
  const unit = await tx.curriculumNode.findFirst({ where: { subjectId, educationLevelId: levelId, kind: 'unit', code: unitCode }, select: { id: true } })
  if (!unit) throw new Error(`e2e-k2: ADDMATH unit ${unitCode} does not exist (run the curriculum seed first)`)
  const tags = await loadTags(tx, subjectId, levelId)
  const tag = tags.find((x) => x.unitNodeId === unit.id)
  if (!tag) throw new Error(`e2e-k2: ADDMATH unit ${unitCode} has no SP node`)
  return tag
}

/** Writes the 15 approved questions (the approve gate runs on each first) and returns their ids in `K2_SPECS` order. */
async function seedQuestions(prisma: PrismaClient, adminId: bigint, now: Date): Promise<bigint[]> {
  assertFixtureShape()
  return prisma.$transaction(
    async (tx) => {
      const subject = await tx.subject.findUnique({ where: { code: 'ADDMATH' }, select: { id: true } })
      if (!subject) throw new Error('e2e-k2: subject ADDMATH is missing (run the curriculum seed first)')
      const levels = new Map((await tx.educationLevel.findMany({ where: { code: { in: ['T4', 'T5'] } } })).map((l) => [l.code, l.id]))
      const ids: bigint[] = []
      for (const spec of K2_SPECS) {
        const label = labelOf(spec)
        const existing = await tx.questionVersion.findFirst({ where: { numberLabel: label }, select: { questionId: true } })
        if (existing) {
          ids.push(existing.questionId)
          continue
        }
        const levelId = levels.get(spec.level)
        if (levelId === undefined) throw new Error(`e2e-k2: level ${spec.level} is missing`)
        const tag = await resolveTag(tx, subject.id, levelId, spec.unit)
        const parts = partsOf(spec)
        const tp = Math.max(...spec.tps)
        // The real approve gate (tag, keys, marks, DSKP leaf rules of R1-B05) on the exact data that is written.
        const failed = GATES.approve({
          id: label, parts, marks: totalMarks(spec), subjectId: subject.id.toString(), educationLevelId: levelId.toString(), chapterId: '1',
          unitId: tag.unitNodeId.toString(), spIds: [tag.spNodeId.toString()], tp,
          unconfirmedLowConfidenceFields: [], hasOpenDuplicateFlag: false, mediaResolved: true, missingRequiredFields: [], lastEditedByAi: false,
          paperCode: E2E_K2_BLUEPRINT, spmBound: true,
        })
        if (Object.keys(failed).length > 0) throw new Error(`e2e-k2: ${label} fails the approve gate: ${JSON.stringify(failed)}`)

        const question = await tx.question.create({
          data: { sourceType: 'manual', createdById: adminId, latestVersionNo: 1, liveVersionNo: 1, isActive: true, createdAt: now, updatedAt: now },
        })
        const version = await tx.questionVersion.create({
          data: {
            questionId: question.id, versionNo: 1, status: 'approved', publishedAt: now, type: 'structured', stemMs: spec.stem, numberLabel: label, language: 'ms',
            subjectId: subject.id, educationLevelId: levelId, unitNodeId: tag.unitNodeId, formOrigin: spec.level === 'T5' ? 't5' : 't4',
            cognitiveLevel: 3, difficultyTp: tp, paperCode: E2E_K2_BLUEPRINT,
            // Labelled as a fixture in the source fields.
            sourceKind: 'publisher', rightsStatus: 'own', examType: 'latihan', examBoard: E2E_K2_FIXTURE_NOTE, setLabel: E2E_K2_FIXTURE_NOTE, createdAt: now, updatedAt: now,
          },
        })
        await tx.questionVersionSpNode.create({ data: { questionVersionId: version.id, nodeId: tag.spNodeId, createdAt: now } })
        for (const [i, p] of parts.entries()) {
          if ('children' in p) throw new Error('e2e-k2: fixture leaves are flat')
          const row = await tx.questionPart.create({
            data: {
              questionVersionId: version.id, parentPartId: null, position: i + 1, depth: 1, label: p.label, promptMs: p.prompt.ms, marks: p.marks, mode: p.mode,
              reveal: 'after_submit', difficultyTp: p.difficultyTp ?? null, cognitiveLevel: p.cognitiveLevel ?? null,
            },
          })
          await tx.answerKey.create({ data: { partId: row.id, kind: p.key.kind, content: p.key as unknown as Prisma.InputJsonValue } })
        }
        ids.push(question.id)
      }
      return ids
    },
    { timeout: 120_000, maxWait: 20_000 },
  )
}

/** The published fixture paper: made like the builder makes one, checked against the blueprint sections, then Terbit. Idempotent by title. */
async function seedPaper(prisma: PrismaClient, questionIds: readonly bigint[], adminId: bigint, now: Date): Promise<void> {
  const repo = new BuilderRepository({ client: prisma } as unknown as PrismaService)
  if (await prisma.paper.findFirst({ where: { title: E2E_K2_PAPER_TITLE, kind: 'pilihan' }, select: { id: true } })) return
  const subject = await repo.subjectByCode('ADDMATH')
  const blueprint = subject ? await repo.activeBlueprint(subject.id, 2) : null
  if (!subject || !blueprint || blueprint.code !== E2E_K2_BLUEPRINT) throw new Error('e2e-k2: no active 3472/2 blueprint')
  if (blueprint.source !== 'verified') throw new Error('e2e-k2: the 3472/2 blueprint is not Disahkan, so no paper can be made from it')
  if (blueprint.sections.length !== 3) throw new Error('e2e-k2: the 3472/2 blueprint has not three sections')
  blueprint.sections.forEach((s, i) => {
    const marks = MARKS_PER_SECTION[i] as readonly number[]
    if (s.questionCount !== marks.length) throw new Error(`e2e-k2: blueprint section ${String(i + 1)} wants ${String(s.questionCount)} questions, the fixture has ${String(marks.length)}`)
  })

  await prisma.$transaction(async (tx) => {
    const txRepo = new BuilderRepository({ client: tx } as unknown as PrismaService)
    const id = await txRepo.createPaper({
      title: E2E_K2_PAPER_TITLE, subjectId: subject.id, kertas: 2, year: mytYear(now), paperCode: blueprint.code, printedDurationMin: blueprint.durationMin,
      instructions: blueprint.instructions, referenceSheets: referencePanels(blueprint.referenceSheets), blueprintId: blueprint.id, createdById: adminId, isTest: false,
      sections: blueprint.sections.map((s) => ({
        label: s.label, instruction: s.instruction, ruleType: s.ruleType === 'choose' ? 'choose' : 'all', ruleN: s.ruleType === 'choose' ? s.ruleN : null,
        questionCount: s.questionCount, markBudget: s.markBudget ?? s.questionCount, compulsory: s.compulsory,
      })),
    })
    const tree = await txRepo.findPilihan(id)
    if (!tree) throw new Error('e2e-k2: the new paper cannot be read back')
    for (const [si, section] of tree.sections.entries()) {
      const placed = K2_SPECS.flatMap((q, qi) => (q.section === si ? [{ questionId: questionIds[qi] as bigint, pinnedVersionNo: 1 }] : []))
      await txRepo.replacePlacements(section.id, placed)
    }
    // Terbit: pin each placement at version 1 and freeze its marks (what `BuilderService.publish` does after its checks).
    const full = await txRepo.findPilihan(id)
    for (const section of full?.sections ?? []) {
      for (const pl of section.placements) {
        const qi = questionIds.indexOf(pl.questionId)
        await txRepo.pinPlacement(pl.id, 1, totalMarks(K2_SPECS[qi] as K2Spec))
      }
    }
    await txRepo.updatePaper(id, { status: 'published', publishedAt: now, updatedAt: now })
    return id
  })
}

/** Entry point, called by the guarded e2e seed after the 3472/2 blueprint is Disahkan. */
export async function seedE2eK2(ctx: SeedContext, adminId: bigint): Promise<void> {
  const now = ctx.clock.now()
  const ids = await seedQuestions(ctx.prisma, adminId, now)
  await seedPaper(ctx.prisma, ids, adminId, now)
}
