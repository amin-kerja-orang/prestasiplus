import { Inject, Injectable } from '@nestjs/common'
import {
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
import type { WorkflowActor } from '../actor'
import { type ImportedQuestionInput, QuestionWorkflowPorts } from '../ports'
import type { CreateGateInput } from '../lifecycle'
import { QuestionWorkflowService } from '../question-workflow.service'
import { GURU_IMPORT_CAPS, type ImportDefaults, type ImportLookups, NO_IMPORT_DEFAULTS, planImport } from './csv'

/** What the controller hands over from multer (memory storage). */
export interface UploadedCsv {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

/**
 * Gate data of an imported row for `QuestionWorkflowService.assertCreateAllowed`. A CSV row has no
 * chapter, unit, SP or TP, and it is a declared `excel` source.
 */
function gateInputOf(row: ImportedQuestionInput, status: QuestionWorkflowStatus): CreateGateInput {
  return {
    status,
    parts: [],
    marks: row.marks ?? 1,
    subjectId: row.subjectId,
    educationLevelId: row.educationLevelId,
    chapterId: null,
    unitId: null,
    spIds: [],
    tp: null,
    rightsStatus: null,
    hasSourceDeclaration: true,
    unconfirmedLowConfidenceFields: [],
    hasOpenDuplicateFlag: false,
    mediaResolved: true,
    missingRequiredFields: [],
    lastEditedByAi: false,
  }
}

/**
 * Working assumption (BE-10): the create gate is asked for permission as `draft`, whatever the status
 * saved. A CSV row has no chapter (submit gate: `chapterId`), so asking as `review` would refuse every
 * Guru row, which contradicts the mock and the contract (Guru import saves `review`). The status event
 * still records the real status.
 */
const GATE_STATUS: QuestionWorkflowStatus = 'draft'

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

  // --- admin import ----------------------------------------------------------------------------

  async importAdmin(actor: WorkflowActor, file: UploadedCsv | undefined, body: unknown) {
    const fields: Record<string, string> = {}
    const text = readFile(file, fields)
    const lookups = await this.lookups()
    const defaults = parseDefaults(body, lookups, fields)
    if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })

    const plan = planImport(text as string, lookups, defaults)
    refuseUnusable(plan)
    const run = await this.execute(actor, file as UploadedCsv, plan, defaults, 'draft', null)
    return { data: runView(run), status: MSG.imported(run.importedCount, run.failedCount) }
  }

  // --- Guru import -----------------------------------------------------------------------------

  async importGuru(actor: WorkflowActor, file: UploadedCsv | undefined): Promise<{ data: QuestionImportGuruResult }> {
    const fields: Record<string, string> = {}
    const text = readFile(file, fields)
    if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })

    const plan = planImport(text as string, await this.lookups(), NO_IMPORT_DEFAULTS, GURU_IMPORT_CAPS)
    refuseUnusable(plan)
    const run = await this.execute(actor, file as UploadedCsv, plan, NO_IMPORT_DEFAULTS, 'review', null)
    return { data: { imported: run.importedCount, failed: asFailures(run.failures) } }
  }

  // --- shared ----------------------------------------------------------------------------------

  private async lookups(): Promise<ImportLookups> {
    const [subjects, levels] = await Promise.all([this.curriculum.subjects(), this.curriculum.levels()])
    return {
      subjectIds: new Set(subjects.map((s) => s.id.toString())),
      levelIds: new Set(levels.map((l) => l.id.toString())),
    }
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
          failedCount: plan.failures.length,
          failures: plan.failures,
          defaultSubjectId: defaults.subjectId === null ? null : BigInt(defaults.subjectId),
          defaultEducationLevelId: defaults.educationLevelId === null ? null : BigInt(defaults.educationLevelId),
          defaultDifficulty: defaults.difficultyLevel,
          createdById: BigInt(actor.userId),
          createdAt: this.clock.now(),
          updatedAt: this.clock.now(),
        },
      })
    })
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
