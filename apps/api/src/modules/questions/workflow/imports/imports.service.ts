import { Inject, Injectable } from '@nestjs/common'
import {
  QUESTION_IMPORT_ERROR_CSV_HEADER,
  QUESTION_IMPORT_MAX_ROWS,
  QUESTION_IMPORT_MESSAGES as MSG,
  QUESTION_IMPORT_MIME_TYPES,
  QUESTION_IMPORT_PAGE_SIZE,
  QUESTION_IMPORT_MAX_BYTES,
  QUESTION_IMPORT_TEMPLATE_CSV,
  QuestionImportListQuerySchema,
  type QuestionImportFailure,
  type QuestionImportGuruResult,
  type QuestionImportRun,
  type QuestionWorkflowStatus,
} from '@pp/contract'
import type { QuestionImport } from '../../../../db/generated/client'

import { CLOCK, type Clock } from '../../../../db/clock'
import { PrismaService } from '../../../../db/prisma.service'
import { ApiError } from '../../../../common/errors/api-error'
import { listMeta } from '../../../../common/http/respond'
import { toMytTimestamp } from '../../../../common/time/myt'
import { CurriculumRepository } from '../../../curriculum'
import { QuestionsRepository } from '../../index'
import type { WorkflowActor } from '../actor'
import { type ImportedQuestionInput, QuestionWorkflowPorts } from '../ports'
import type { CreateGateInput } from '../lifecycle'
import { QuestionWorkflowService } from '../question-workflow.service'
import {
  buildCsv,
  type CodeLookups,
  type CsvRecord,
  type CurriculumFacts,
  factsKey,
  GURU_IMPORT_CAPS,
  type ImportDefaults,
  type ImportLookups,
  isLegacyHeader,
  NO_IMPORT_DEFAULTS,
  numberKey,
  parseCsv,
  planImport,
  resolveSubjectLevel,
} from './csv'

/** What the controller hands over from multer (memory storage). */
export interface UploadedCsv {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

/**
 * Gate data of an imported row for `QuestionWorkflowService.assertCreateAllowed`. A row of the legacy header has no chapter, unit, SP or
 * TP; a row of the new header carries the unit, SP, TP and chapter its codes mapped to (S1-T05). It is a declared `excel` source.
 */
function gateInputOf(row: ImportedQuestionInput, status: QuestionWorkflowStatus): CreateGateInput {
  return {
    status,
    parts: [],
    marks: row.marks ?? 1,
    subjectId: row.subjectId,
    educationLevelId: row.educationLevelId,
    chapterId: row.chapterId ?? null,
    unitId: row.unitId ?? null,
    spIds: row.spIds ?? [],
    tp: row.tp ?? null,
    unconfirmedLowConfidenceFields: [],
    hasOpenDuplicateFlag: false,
    mediaResolved: true,
    missingRequiredFields: [],
    lastEditedByAi: false,
  }
}

/**
 * Working assumption (BE-10): the create gate is asked for permission as `draft`, whatever the status
 * saved. Historical note: a CSV row has no chapter and the H-A18 submit gate once refused that (`chapterId`); since REQ-B-071
 * (Q17) the Bab is optional at Semakan and Terbitkan, so the submit gate would let it through. The `draft` ask is kept: the Guru
 * import saves `review` by contract and this stays the one place that decides the gate. The status event still records the real status.
 */
const GATE_STATUS: QuestionWorkflowStatus = 'draft'

/** Sized for a 5 MB file (tens of thousands of rows): all rows are planned before it opens, so it only creates. */
const IMPORT_TX = { timeout: 120_000, maxWait: 10_000 } as const

const FILE_NAME_MAX = 255
const MIMES: readonly string[] = QUESTION_IMPORT_MIME_TYPES

@Injectable()
export class QuestionImportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(QuestionWorkflowPorts) private readonly ports: QuestionWorkflowPorts,
    @Inject(QuestionWorkflowService) private readonly workflow: QuestionWorkflowService,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
  ) {}

  /** The template file text (mock `IMPORT_TEMPLATE_CSV`; no cell starts with a formula character). */
  template(): string {
    return QUESTION_IMPORT_TEMPLATE_CSV
  }

  // --- history ---------------------------------------------------------------------------------

  async list(query: unknown) {
    const parsed = QuestionImportListQuerySchema.safeParse(query)
    const page = parsed.success ? (parsed.data.page ?? 1) : 1
    const db = this.prisma.client
    const [totalItems, rows] = await Promise.all([
      db.questionImport.count(),
      db.questionImport.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * QUESTION_IMPORT_PAGE_SIZE,
        take: QUESTION_IMPORT_PAGE_SIZE,
      }),
    ])
    return { data: rows.map(runView), meta: listMeta(page, QUESTION_IMPORT_PAGE_SIZE, totalItems) }
  }

  /**
   * The error CSV of one run (`GET /question-imports/:id/errors`, FR-ADM-QE6.2): columns `baris, question_key, medan, kod_ralat, mesej`, one
   * line per stored row error. It holds nothing of the file's cells but the question key and the codes the Q-11 messages name; every cell
   * goes through `csvCell` (formula neutralised). 404 for an unknown id.
   */
  async errorsCsv(id: string): Promise<string> {
    if (!/^[1-9]\d{0,17}$/.test(id)) throw ApiError.of('NOT_FOUND')
    const row = await this.prisma.client.questionImport.findUnique({ where: { id: BigInt(id) } })
    if (!row) throw ApiError.of('NOT_FOUND')
    return buildCsv([
      [...QUESTION_IMPORT_ERROR_CSV_HEADER],
      ...asFailures(row.failures).map((f) => [String(f.row), f.questionKey ?? '', f.field ?? '', f.code ?? '', f.message]),
    ])
  }

  // --- admin import ----------------------------------------------------------------------------

  async importAdmin(actor: WorkflowActor, file: UploadedCsv | undefined, body: unknown) {
    const fields: Record<string, string> = {}
    const text = readFile(file, fields)
    const lookups = await this.lookups()
    const defaults = parseDefaults(body, lookups, fields)
    if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })

    const records = parseCsv(text as string)
    const plan = planImport(records, await this.withCodes(lookups, records, defaults), defaults)
    refuseUnusable(plan)
    const run = await this.execute(actor, file as UploadedCsv, plan, defaults, 'draft', null)
    return {
      data: runView(run),
      status: MSG.imported(run.importedCount, run.failedCount),
      ...(plan.warnings.length === 0 ? {} : { warnings: plan.warnings }),
    }
  }

  // --- Guru import -----------------------------------------------------------------------------

  async importGuru(actor: WorkflowActor, file: UploadedCsv | undefined): Promise<{ data: QuestionImportGuruResult }> {
    const fields: Record<string, string> = {}
    const text = readFile(file, fields)
    if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })

    const records = parseCsv(text as string)
    const lookups = await this.withCodes(await this.lookups(), records, NO_IMPORT_DEFAULTS)
    const plan = planImport(records, lookups, NO_IMPORT_DEFAULTS, GURU_IMPORT_CAPS)
    refuseUnusable(plan)
    const run = await this.execute(actor, file as UploadedCsv, plan, NO_IMPORT_DEFAULTS, 'review', null)
    return { data: { imported: run.importedCount, failed: asFailures(run.failures), ...(plan.warnings.length === 0 ? {} : { warnings: plan.warnings }) } }
  }

  // --- shared ----------------------------------------------------------------------------------

  private async lookups(): Promise<ImportLookups> {
    const [subjects, levels] = await Promise.all([this.curriculum.subjects(), this.curriculum.levels()])
    return {
      subjectIds: new Set(subjects.map((s) => s.id.toString())),
      levelIds: new Set(levels.map((l) => l.id.toString())),
    }
  }

  /**
   * The code maps and curriculum facts the new header needs (read-only through `CurriculumRepository`), for the Subjek + Tingkatan the file
   * names. A legacy file or one over the row cap gets none (nothing is planned from it).
   */
  private async withCodes(lookups: ImportLookups, records: CsvRecord[], defaults: ImportDefaults): Promise<ImportLookups> {
    const [header, ...data] = records
    if (!header || isLegacyHeader(header) || data.length > QUESTION_IMPORT_MAX_ROWS) return lookups
    const [subjects, levels] = await Promise.all([this.curriculum.subjects(), this.curriculum.levels()])
    const subjectsByCode = new Map(subjects.map((s) => [s.code.toUpperCase(), s.id.toString()]))
    const levelsByCode = new Map(levels.map((l) => [l.code.toUpperCase(), l.id.toString()]))
    const names = new Map<string, number>()
    header.cells.forEach((n, i) => {
      const k = n.trim().toLowerCase()
      if (!names.has(k)) names.set(k, i)
    })
    const withTopics = names.has('topik_kod')
    const bare: CodeLookups = { subjectsByCode, levelsByCode, facts: new Map() }
    const pairs = new Map<string, { subjectId: string; levelId: string }>()
    for (const rec of data) {
      const get = (col: string): string => {
        const i = names.get(col)
        return i === undefined ? '' : (rec.cells[i] ?? '')
      }
      const { subjectId, levelId } = resolveSubjectLevel(get, bare, defaults)
      if (subjectId !== null && levelId !== null) pairs.set(factsKey(subjectId, levelId), { subjectId, levelId })
    }
    const facts = new Map<string, CurriculumFacts>()
    for (const [key, { subjectId, levelId }] of pairs) facts.set(key, await this.factsOf(BigInt(subjectId), BigInt(levelId), withTopics))
    return { ...lookups, codes: { subjectsByCode, levelsByCode, facts } }
  }

  private async factsOf(subjectId: bigint, levelId: bigint, withTopics: boolean): Promise<CurriculumFacts> {
    const [nodes, chapters, spmBound] = await Promise.all([
      this.curriculum.dskpNodes(levelId, subjectId),
      this.curriculum.chapters(subjectId, levelId, { active: true }),
      this.questions.isSpmBound(subjectId.toString(), levelId.toString()),
    ])
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const units = new Map<string, string[]>()
    const sps = new Map<string, { id: string; unitIds: Set<string> }[]>()
    for (const n of nodes) {
      if (n.kind === 'unit') units.set(n.code, [...(units.get(n.code) ?? []), n.id.toString()])
      if (n.kind !== 'sp') continue
      const unitIds = new Set<string>()
      const seen = new Set<bigint>()
      for (let p = n.parentId === null ? undefined : byId.get(n.parentId); p && !seen.has(p.id); p = p.parentId === null ? undefined : byId.get(p.parentId)) {
        seen.add(p.id)
        if (p.kind === 'unit') unitIds.add(p.id.toString())
      }
      sps.set(n.code, [...(sps.get(n.code) ?? []), { id: n.id.toString(), unitIds }])
    }
    const chapterMap = new Map<string, { id: string; topics: ReadonlyMap<string, string> }>()
    for (const c of chapters) {
      if (c.chapterNumber === null) continue
      const topics = new Map<string, string>()
      if (withTopics) {
        for (const t of await this.curriculum.topics(c.id)) if (t.topicNumber !== null && !topics.has(numberKey(t.topicNumber.trim()))) topics.set(numberKey(t.topicNumber.trim()), t.id.toString())
      }
      if (!chapterMap.has(numberKey(String(c.chapterNumber)))) chapterMap.set(numberKey(String(c.chapterNumber)), { id: c.id.toString(), topics })
    }
    return { subjectId: subjectId.toString(), levelId: levelId.toString(), hasDskpNodes: nodes.length > 0, spmBound, units, sps, chapters: chapterMap }
  }

  /** Creates the valid rows and stores the run in ONE transaction: nothing partial is kept on an error. */
  private execute(
    actor: WorkflowActor,
    file: UploadedCsv,
    plan: ReturnType<typeof planImport>,
    defaults: ImportDefaults,
    status: 'draft' | 'review',
    templateVersion: string | null,
  ): Promise<QuestionImport> {
    const bank = this.ports.questionBank
    return this.prisma.transaction(async () => {
      for (const row of plan.rows) {
        const input: ImportedQuestionInput = { ...row.input, createdById: actor.userId, status }
        this.workflow.assertCreateAllowed(gateInputOf(input, GATE_STATUS), actor)
        const id = await bank.create(input)
        await this.workflow.recordCreation(id, status, actor, 1)
      }
      return this.prisma.client.questionImport.create({
        data: {
          fileName: file.originalname.slice(0, FILE_NAME_MAX),
          templateVersion,
          importedCount: plan.rows.length,
          failedCount: plan.failedQuestions,
          failures: plan.failures,
          defaultSubjectId: defaults.subjectId === null ? null : BigInt(defaults.subjectId),
          defaultEducationLevelId: defaults.educationLevelId === null ? null : BigInt(defaults.educationLevelId),
          defaultDifficulty: defaults.difficultyLevel,
          createdById: BigInt(actor.userId),
          createdAt: this.clock.now(),
          updatedAt: this.clock.now(),
        },
      })
    }, IMPORT_TX)
  }
}

/** Text of the `csvFile` part, or the 422 message in `fields`. */
function readFile(file: UploadedCsv | undefined, fields: Record<string, string>): string | null {
  if (!file) {
    fields.csvFile = MSG.fileRequired
    return null
  }
  const name = file.originalname
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
  const mimeOk = file.mimetype === '' || MIMES.includes(file.mimetype)
  if ((ext !== 'csv' && ext !== 'txt') || !mimeOk || file.size > QUESTION_IMPORT_MAX_BYTES) {
    fields.csvFile = MSG.fileType
    return null
  }
  return file.buffer.toString('utf8')
}

function refuseUnusable(plan: ReturnType<typeof planImport>): void {
  if (plan.rowLimitExceeded) throw ApiError.of('VALIDATION_ERROR', { fields: { csvFile: MSG.tooManyRows } })
  if (plan.missingColumns.length > 0) {
    throw ApiError.of('VALIDATION_ERROR', { fields: { csvFile: MSG.missingColumns(plan.missingColumns) } })
  }
  if (plan.dataRows === 0) throw ApiError.of('VALIDATION_ERROR', { fields: { csvFile: MSG.noData } })
}

/** A positive integer in multipart text: undefined when absent, null when malformed. */
function optionalDigits(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === '') return undefined
  const v = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : null
  if (v === null || !/^\d{1,18}$/.test(v) || BigInt(v) < 1n) return null
  return String(BigInt(v))
}

function parseDefaults(body: unknown, lookups: ImportLookups, fields: Record<string, string>): ImportDefaults {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const subject = optionalDigits(b.defaultSubjectId)
  if (subject === null || (subject !== undefined && !lookups.subjectIds.has(subject))) fields.defaultSubjectId = MSG.subject
  const level = optionalDigits(b.defaultEducationLevelId)
  if (level === null || (level !== undefined && !lookups.levelIds.has(level))) fields.defaultEducationLevelId = MSG.level
  const difficulty = optionalDigits(b.defaultDifficultyLevel)
  if (difficulty === null || (difficulty !== undefined && Number(difficulty) > 5)) fields.defaultDifficultyLevel = MSG.difficulty
  return {
    subjectId: subject ?? null,
    educationLevelId: level ?? null,
    difficultyLevel: difficulty === undefined || difficulty === null ? null : Number(difficulty),
  }
}

function asFailures(value: unknown): QuestionImportFailure[] {
  return Array.isArray(value) ? (value as QuestionImportFailure[]) : []
}

export function runView(row: QuestionImport): QuestionImportRun {
  const createdAt = toMytTimestamp(row.createdAt)
  return {
    id: row.id.toString(),
    fileName: row.fileName,
    importedCount: row.importedCount,
    failedCount: row.failedCount,
    failures: asFailures(row.failures),
    defaults: {
      subjectId: row.defaultSubjectId?.toString() ?? null,
      educationLevelId: row.defaultEducationLevelId?.toString() ?? null,
      difficultyLevel: row.defaultDifficulty,
    },
    // The creating account may have been deleted (FK SET NULL); the wire id is never empty.
    createdBy: row.createdById?.toString() ?? '0',
    createdAt,
    createdMonth: createdAt.slice(0, 7),
  }
}
