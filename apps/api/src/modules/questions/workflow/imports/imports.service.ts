import { lookup as dnsLookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP } from 'node:net'

import { Inject, Injectable } from '@nestjs/common'
import {
  FILE_PURPOSE_RULES,
  QUESTION_IMPORT_CODE_ROW_MESSAGES as CODE_MSG,
  cappedText,
  QUESTION_IMPORT_ERROR_CSV_HEADER,
  QUESTION_IMPORT_MESSAGE_MAX,
  QUESTION_IMPORT_MAX_ROWS,
  QUESTION_IMPORT_MESSAGES as MSG,
  QUESTION_IMPORT_MIME_TYPES,
  QUESTION_IMPORT_PAGE_SIZE,
  QUESTION_IMPORT_MAX_BYTES,
  QUESTION_IMPORT_TEMPLATE_CSV,
  QuestionImportListQuerySchema,
  type QuestionImportFailure,
  type StimulusCreateRequest,
  questionImportRowPrefix,
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
import { inspectUpload } from '../../../files/content-inspect'
import { FILE_STORAGE, FilesService, type FileStorage } from '../../../files'
import { QuestionsRepository, StimuliService } from '../../index'
import type { WorkflowActor } from '../actor'
import { type ImportedQuestionInput, QuestionWorkflowPorts } from '../ports'
import type { CreateGateInput } from '../lifecycle'
import { QuestionWorkflowService } from '../question-workflow.service'
import { IMPORT_URL, IMPORT_ZIP } from './imports.constants'
import {
  buildCsv,
  type CodeLookups,
  type CsvRecord,
  type CurriculumFacts,
  type PlannedGroup,
  factsKey,
  GURU_IMPORT_CAPS,
  type ImportDefaults,
  type ImportLookups,
  imageKeyOf,
  isHttpsUrl,
  isLegacyHeader,
  NO_IMPORT_DEFAULTS,
  numberKey,
  parseCsv,
  planImport,
  readZipFiles,
  resolveSubjectLevel,
  ZipRefusedError,
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
    @Inject(StimuliService) private readonly stimuli: StimuliService,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
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

  async importAdmin(actor: WorkflowActor, file: UploadedCsv | undefined, body: unknown, zipFile?: UploadedCsv) {
    const fields: Record<string, string> = {}
    const text = readFile(file, fields)
    const images = readImages(zipFile, fields)
    const lookups = await this.lookups()
    const defaults = parseDefaults(body, lookups, fields)
    if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })

    const records = parseCsv(text as string)
    // https image URLs are fetched NOW, before the transaction opens, and kept in memory (S1-T05 part 4).
    await this.fetchImages(records, images)
    const plan = planImport(records, await this.withCodes(lookups, records, defaults, images.status), defaults)
    refuseUnusable(plan)
    const run = await this.execute(actor, file as UploadedCsv, plan, defaults, 'draft', null, images.bytes)
    return {
      data: runView(run),
      status: MSG.imported(run.importedCount, run.failedCount),
      ...(plan.warnings.length === 0 ? {} : { warnings: plan.warnings }),
    }
  }

  /** How a URL is fetched; tests replace these (a stubbed resolver, a private-address allowance, a self-signed CA). Production uses the defaults. */
  fetchOptions: FetchGuardOptions = {}

  /**
   * Fetches the distinct https URLs of the `stimulus_image` columns (new header only), at most `IMPORT_URL.concurrency` at a time, and adds
   * each image that passed the checks to `images` under `url:<cell>`. A URL that failed is simply not added (the row then gets the Q-11
   * "cannot be downloaded" text); one that is not a JPG, PNG or WebP of at most 2 MB is added as `bad`. More than `maxUrls` distinct URLs refuses
   * the WHOLE file (422 on `csvFile`, ERR-REQ-01): an arbitrary subset of rows failing by file order would be a worse outcome, and it matches the
   * ZIP entry cap.
   */
  private async fetchImages(records: CsvRecord[], images: { status: Map<string, 'ok' | 'bad'>; bytes: Map<string, Buffer> }): Promise<void> {
    const [header, ...data] = records
    if (!header || isLegacyHeader(header)) return
    const at = ['stimulus_image', 'stimulus2_image', 'stimulus3_image'].map((c) => header.cells.findIndex((n) => n.trim().toLowerCase() === c)).filter((i) => i >= 0)
    const urls = new Set<string>()
    for (const rec of data) for (const i of at) {
      const cell = (rec.cells[i] ?? '').trim() // trimmed before the set, so " https://a/x.png" and "https://a/x.png" are one URL
      if (isHttpsUrl(cell)) urls.add(cell)
    }
    if (urls.size > IMPORT_URL.maxUrls) throw ApiError.of('VALIDATION_ERROR', { fields: { csvFile: CODE_MSG.requestInvalid } })
    const queue = [...urls]
    // One budget for all the fetches of this import (`IMPORT_URL.totalBudgetMs`, `fetchOptions.budgetMs` in tests): when it runs out, the controller
    // aborts every fetch in flight (its socket is destroyed) and no new fetch starts. A URL not fetched in time is simply not in `images`, so its row
    // gets the same "cannot be downloaded" error as any other fetch failure, and the import goes on with the rest.
    const budget = new AbortController()
    const timer = setTimeout(() => budget.abort(), this.fetchOptions.budgetMs ?? IMPORT_URL.totalBudgetMs)
    const worker = async (): Promise<void> => {
      for (let url = queue.shift(); url !== undefined && !budget.signal.aborted; url = queue.shift()) {
        const got = await fetchImageBytes(url, { ...this.fetchOptions, signal: budget.signal })
        if (!got.ok) continue
        const kind = classifyImage(got.bytes)
        images.status.set(imageKeyOf(url), kind)
        if (kind === 'ok') images.bytes.set(imageKeyOf(url), got.bytes)
      }
    }
    try {
      await Promise.all(Array.from({ length: Math.min(IMPORT_URL.concurrency, queue.length) }, worker))
    } finally {
      clearTimeout(timer)
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
  private async withCodes(lookups: ImportLookups, records: CsvRecord[], defaults: ImportDefaults, images?: ReadonlyMap<string, 'ok' | 'bad'>): Promise<ImportLookups> {
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
    const groups = new Map<string, { stimuli: ReadonlyMap<string, string> } | null>()
    const gi = names.get('group_id')
    for (const rec of gi === undefined ? [] : data) {
      const id = rec.cells[gi as number] ?? ''
      if (id !== '' && !groups.has(id)) groups.set(id, await this.usableGroup(id))
    }
    return { ...lookups, codes: { subjectsByCode, levelsByCode, facts, groups, ...(images === undefined ? {} : { images }) } }
  }

  /** A group a `group_id` row may join: it exists, is not a draft copy and no member is shown to pupils; else null. */
  private async usableGroup(id: string): Promise<{ stimuli: ReadonlyMap<string, string> } | null> {
    if (!/^[1-9]\d{0,17}$/.test(id)) return null
    try {
      const g = await this.stimuli.getGroup(id)
      if (g.draftOfGroupId != null || g.members.some((m) => m.servable)) return null
      return { stimuli: new Map(g.stimuli.flatMap((x) => (x.label === null ? [] : [[x.label, x.id] as const]))) }
    } catch (err) {
      if (err instanceof ApiError) return null
      throw err
    }
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

  /**
   * One valid group, inside the caller's transaction: its stimuli (S1-T01 `StimuliService.createStimulus`), then its members through the bank port
   * (the same create as every other row), then the group (`createGroup`, which takes its Subjek, Tingkatan and Kertas from the members) or, for a
   * `group_id` row, `addMember` on the existing group. Any `ApiError` is the caller's cue to skip the whole group.
   */
  private async createGroup(actor: WorkflowActor, group: PlannedGroup, status: 'draft' | 'review', zipBytes: ReadonlyMap<string, Buffer>, stored: string[], runKeys: string[]): Promise<void> {
    const bank = this.ports.questionBank
    const stimulusIds: string[] = []
    for (const s of group.stimuli) {
      // The image is stored in memory through the files module (purpose `question_image`, type decided from the bytes); no temp file.
      let imageFileId: string | undefined
      if (s.imageName !== null) {
        const bytes = zipBytes.get(s.imageName)
        if (bytes === undefined) throw ApiError.of('VALIDATION_ERROR', { fields: { stimulus_image: CODE_MSG.stimulusImage } })
        const file = await this.files.storeManaged({ ownerUserId: actor.userId, purpose: 'question_image', bytes })
        // The object's key is recorded at once: files are not transactional, so a rollback of the rows must be followed by deleting the objects.
        const row = await this.prisma.client.file.findUnique({ where: { publicId: file.publicId }, select: { storageKey: true } })
        if (row !== null) {
          stored.push(row.storageKey)
          runKeys.push(row.storageKey)
        }
        imageFileId = file.publicId
      }
      const made = await this.stimuli.createStimulus({
        kind: s.kind as StimulusCreateRequest['kind'],
        label: s.label,
        ...(s.caption === null ? {} : { caption: s.caption }),
        ...(s.bodyMs === null ? {} : { body: { ms: s.bodyMs, ...(s.bodyEn === null ? {} : { en: s.bodyEn }) } }),
        ...(s.alt === null ? {} : { alt: s.alt }),
        ...(s.sourceCitation === null ? {} : { sourceCitation: s.sourceCitation }),
        ...(s.tableData === null ? {} : { tableData: s.tableData }),
        ...(imageFileId === undefined ? {} : { imageFileId }),
      })
      stimulusIds.push(made.result.id)
    }
    const questionIds: string[] = []
    for (const m of group.members) {
      const partId = m.partStimulusIndex === undefined ? undefined : stimulusIds[m.partStimulusIndex]
      const input: ImportedQuestionInput = { ...m.input, ...(partId === undefined ? {} : { partStimulusId: partId }), createdById: actor.userId, status }
      this.workflow.assertCreateAllowed(gateInputOf(input, GATE_STATUS), actor)
      const id = await bank.create(input)
      await this.workflow.recordCreation(id, status, actor, 1)
      questionIds.push(id)
    }
    if (group.existingGroupId !== null) for (const id of questionIds) await this.stimuli.addMember(group.existingGroupId, id)
    else await this.stimuli.createGroup({ stimulusIds, questionIds })
  }

  /** Creates the valid rows and stores the run in ONE transaction: nothing partial is kept on an error. */
  private execute(
    actor: WorkflowActor,
    file: UploadedCsv,
    plan: ReturnType<typeof planImport>,
    defaults: ImportDefaults,
    status: 'draft' | 'review',
    templateVersion: string | null,
    zipBytes: ReadonlyMap<string, Buffer> = new Map(),
  ): Promise<QuestionImport> {
    const bank = this.ports.questionBank
    // Keys of every image object stored during this run. On ANY failure of the transaction (an error out of the callback or of the commit) they are
    // all deleted: the rows go with the rollback, the objects would not.
    const runKeys: string[] = []
    return this.prisma.transaction(async () => {
      for (const row of plan.rows) {
        const input: ImportedQuestionInput = { ...row.input, createdById: actor.userId, status }
        this.workflow.assertCreateAllowed(gateInputOf(input, GATE_STATUS), actor)
        const id = await bank.create(input)
        await this.workflow.recordCreation(id, status, actor, 1)
      }
      // Order of work: the single (ungrouped) questions above are created FIRST, then the groups below, whatever their place in the file. A group
      // can fail and be rolled back to its savepoint, so the questions made before it are kept; ids and creation times therefore do not follow
      // the file order across single questions and groups (the order inside a group is `group_order`).
      // A group is created whole or skipped whole (45 section 3.2): a savepoint per group keeps what the rest of the import made.
      const failures = [...plan.failures]
      let imported = plan.rows.length
      let failed = plan.failedQuestions
      for (const group of plan.groups) {
        await this.prisma.client.$executeRaw`SAVEPOINT import_group`
        const stored: string[] = []
        try {
          await this.createGroup(actor, group, status, zipBytes, stored, runKeys)
          await this.prisma.client.$executeRaw`RELEASE SAVEPOINT import_group`
          imported += group.members.length
        } catch (err) {
          if (!(err instanceof ApiError)) throw err
          // Files are not transactional: the rows of this group's images are rolled back below, but their stored objects would stay, so the
          // objects are deleted by key (a rolled-back group leaves neither a reference nor an orphan object).
          await this.deleteObjects(stored)
          await this.prisma.client.$executeRaw`ROLLBACK TO SAVEPOINT import_group`
          // The service text is BM and mostly fixed, but it can echo a file value: it is capped like every echoed value. The cap is 200
          // characters, not 40, because 40 would cut the sentence itself ("Subjek dan Tingkatan ahli mesti sama dengan kumpulan.").
          const text = cappedText(Object.values(err.fields ?? {})[0] ?? err.message, QUESTION_IMPORT_MESSAGE_MAX)
          failures.push({
            row: group.line,
            message: questionImportRowPrefix(group.line) + text,
            ...((group.key || group.members[0]?.questionKey) ? { questionKey: group.key || (group.members[0]?.questionKey as string) } : {}),
            field: 'group_key',
            code: 'GROUP_REJECTED',
          })
          failed += group.members.length
        }
      }
      failures.sort((a, b) => a.row - b.row)
      return this.prisma.client.questionImport.create({
        data: {
          fileName: file.originalname.slice(0, FILE_NAME_MAX),
          templateVersion,
          importedCount: imported,
          failedCount: failed,
          failures,
          defaultSubjectId: defaults.subjectId === null ? null : BigInt(defaults.subjectId),
          defaultEducationLevelId: defaults.educationLevelId === null ? null : BigInt(defaults.educationLevelId),
          defaultDifficulty: defaults.difficultyLevel,
          createdById: BigInt(actor.userId),
          createdAt: this.clock.now(),
          updatedAt: this.clock.now(),
        },
      })
    }, IMPORT_TX).catch(async (err: unknown) => {
      await this.deleteObjects(runKeys)
      throw err
    })
  }

  /** Deletes stored objects by key; never throws (a missing key is not an error). */
  private async deleteObjects(keys: readonly string[]): Promise<void> {
    for (const key of keys) await this.storage.delete(key).catch(() => undefined)
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

/**
 * The optional `zipFile` of the admin import: the files of the ZIP by base name, each marked `ok` (JPG, PNG or WebP by its bytes, within 2 MB, the
 * `question_image` rule and the same content inspection as `POST /files`) or `bad`. A non-ZIP, an empty file or a breached bomb limit is a 422 on
 * `zipFile` with ERR-REQ-01 (30 has no text for them). Nothing is stored here; the images of a valid group are stored when the group is created.
 */
function readImages(zip: UploadedCsv | undefined, fields: Record<string, string>): { status: Map<string, 'ok' | 'bad'>; bytes: Map<string, Buffer> } {
  const none = { status: new Map<string, 'ok' | 'bad'>(), bytes: new Map<string, Buffer>() }
  if (zip === undefined) return none
  if (zip.size === 0 || zip.size > IMPORT_ZIP.maxBytes || zip.buffer.length === 0) {
    fields.zipFile = CODE_MSG.requestInvalid
    return none
  }
  let files: Map<string, Buffer | null>
  try {
    files = readZipFiles(zip.buffer, IMPORT_ZIP)
  } catch (err) {
    if (!(err instanceof ZipRefusedError)) throw err
    fields.zipFile = CODE_MSG.requestInvalid
    return none
  }
  const out = { status: new Map<string, 'ok' | 'bad'>(), bytes: new Map<string, Buffer>() }
  for (const [name, bytes] of files) {
    const kind = bytes === null ? 'bad' : classifyImage(bytes)
    out.status.set(name, kind)
    if (kind === 'ok' && bytes !== null) out.bytes.set(name, bytes)
  }
  return out
}

/** `ok` when the BYTES are a JPG, PNG or WebP of at most 2 MB (the `question_image` rule, the same inspection as `POST /files`); the name and any Content-Type are ignored. */
export function classifyImage(bytes: Buffer): 'ok' | 'bad' {
  const rule = FILE_PURPOSE_RULES.question_image
  if (bytes.length === 0 || bytes.length > rule.maxBytes) return 'bad'
  const inspected = inspectUpload(bytes)
  return inspected !== null && (rule.mimes as readonly string[]).includes(inspected.mime) ? 'ok' : 'bad'
}

// --- fetching an https image URL (S1-T05 part 4, PO #11) -------------------------------------------

/**
 * Addresses the importer never connects to: this host's own network, private ranges, link-local (the cloud metadata address 169.254.169.254
 * included), CGNAT, multicast and reserved space, and the IPv6 equivalents. An IPv4-mapped IPv6 address is judged as its IPv4 address.
 */
const BLOCKED = new BlockList()
for (const [net, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) {
  BLOCKED.addSubnet(net, bits, 'ipv4')
}
for (const [net, bits] of [['::', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 32], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) {
  BLOCKED.addSubnet(net, bits, 'ipv6')
}

/** True when `ip` must not be connected to. Anything that is not an IP literal is blocked. */
export function isBlockedIp(ip: string): boolean {
  const family = isIP(ip)
  if (family === 0) return true
  if (family === 4) return BLOCKED.check(ip, 'ipv4')
  // ::ffff:a.b.c.d in any spelling (dotted or hex groups): the compact form from the URL parser always has hex groups.
  let compact = ip.toLowerCase()
  try {
    compact = new URL(`http://[${ip}]/`).hostname.slice(1, -1)
  } catch {
    return true
  }
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(compact)
  if (mapped) {
    const hi = parseInt(mapped[1] as string, 16)
    const lo = parseInt(mapped[2] as string, 16)
    return BLOCKED.check(`${String(hi >> 8)}.${String(hi & 255)}.${String(lo >> 8)}.${String(lo & 255)}`, 'ipv4')
  }
  return BLOCKED.check(compact, 'ipv6')
}

/** Test seams. `resolve` replaces DNS; `isBlocked` replaces the range check (a local test server is a private address); `ca` trusts a self-signed test certificate; `port` replaces 443. */
export interface FetchGuardOptions {
  resolve?: (host: string) => Promise<string[]>
  isBlocked?: (ip: string) => boolean
  ca?: string
  port?: number
  /** Aborts the fetch: the socket is destroyed and the result is `{ ok: false }`. Set by `fetchImages` from the import budget. */
  signal?: AbortSignal
  /** The total fetch budget of one import in ms (default `IMPORT_URL.totalBudgetMs`); tests set a short one. */
  budgetMs?: number
}

/** The Host header to set explicitly: an IPv6 literal in brackets (with the port unless it is 443); null for a name or an IPv4 literal (Node's own header is right). */
export function hostHeaderFor(host: string, port: number): string | null {
  return isIP(host) === 6 ? `[${host}]${port === 443 ? '' : `:${String(port)}`}` : null
}

export type FetchedImage = { ok: true; bytes: Buffer } | { ok: false }

const defaultResolve = async (host: string): Promise<string[]> => (await dnsLookup(host, { all: true })).map((a) => a.address)

/**
 * GET of one https image URL with the guard of the lead security review. Never throws; every failure is `{ ok: false }` and nothing about it
 * (URL, address, error text) leaves this function.
 * - https only, default port 443, no credentials in the URL; the WHATWG parser has already turned decimal, octal and hex IPv4 literals
 *   (`https://2130706433/`, `https://0x7f.1/`) into dotted form, which the range check then sees.
 * - DNS is resolved HERE and EVERY address must be allowed; the connection is pinned to the first one through the request's `lookup`, so a second
 *   DNS answer cannot swap the target between the check and the connect. The host name still goes into SNI, the Host header and certificate
 *   verification.
 * - No redirect is followed: any status other than 200 (3xx included) fails.
 * - A connect timeout and a total timeout; the body is streamed and cut off the moment it passes the 2 MB cap (never more is held).
 * The bytes are returned unjudged: the caller checks the magic bytes, the Content-Type is never read for the decision.
 */
export async function fetchImageBytes(raw: string, opts: FetchGuardOptions = {}): Promise<FetchedImage> {
  const no: FetchedImage = { ok: false }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return no
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || (url.port !== '' && url.port !== '443')) return no
  const host = url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname
  if (host === '') return no
  const aborted = (): boolean => opts.signal?.aborted === true
  if (aborted()) return no
  const blocked = opts.isBlocked ?? isBlockedIp
  let addresses: string[]
  try {
    addresses = isIP(host) !== 0 ? [host] : await (opts.resolve ?? defaultResolve)(host)
  } catch {
    return no
  }
  if (addresses.length === 0 || addresses.some((a) => blocked(a)) || aborted()) return no
  const pinned = addresses[0] as string
  const family = isIP(pinned)

  return new Promise<FetchedImage>((resolve) => {
    let done = false
    const finish = (r: FetchedImage): void => {
      if (done) return
      done = true
      clearTimeout(connectTimer)
      clearTimeout(totalTimer)
      opts.signal?.removeEventListener('abort', fail)
      resolve(r)
    }
    const req = httpsRequest({
      host,
      port: opts.port ?? 443,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      agent: false,
      // An IPv6 literal goes into the Host header in brackets (with the port when it is not 443), as RFC 3986 and the server expect.
      headers: {
        accept: 'image/jpeg, image/png, image/webp',
        'user-agent': 'PrestasiPlus-import',
        ...(hostHeaderFor(host, opts.port ?? 443) === null ? {} : { host: hostHeaderFor(host, opts.port ?? 443) as string }),
      },
      ...(isIP(host) === 0 ? { servername: host } : {}),
      ...(opts.ca === undefined ? {} : { ca: opts.ca }),
      lookup: (_h, options, cb) => {
        const result = { address: pinned, family }
        if ((options as { all?: boolean }).all === true) (cb as unknown as (e: null, a: unknown[]) => void)(null, [result])
        else cb(null, result.address, result.family)
      },
    })
    const fail = (): void => {
      finish(no)
      req.destroy()
    }
    opts.signal?.addEventListener('abort', fail, { once: true })
    const connectTimer = setTimeout(fail, IMPORT_URL.connectTimeoutMs)
    const totalTimer = setTimeout(fail, IMPORT_URL.totalTimeoutMs)
    req.on('socket', (socket) => {
      socket.once('secureConnect', () => clearTimeout(connectTimer))
    })
    req.on('error', fail)
    req.on('response', (res) => {
      const length = Number(res.headers['content-length'])
      if (res.statusCode !== 200 || (Number.isFinite(length) && length > IMPORT_URL.maxBytes)) return fail()
      const chunks: Buffer[] = []
      let total = 0
      res.on('data', (c: Buffer) => {
        total += c.length
        if (total > IMPORT_URL.maxBytes) return fail()
        chunks.push(c)
      })
      res.on('end', () => finish({ ok: true, bytes: Buffer.concat(chunks) }))
      res.on('error', fail)
      res.on('aborted', fail)
    })
    req.end()
  })
}
