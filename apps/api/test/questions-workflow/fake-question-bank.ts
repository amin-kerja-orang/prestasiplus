import { ApiError } from '../../src/common/errors/api-error'
import type { QuestionWorkflowStatus } from '@pp/contract'

import type {
  DiagramCandidate,
  ExplanationSource,
  ImportedQuestionInput,
  QualityQuestion,
  QuestionBankPort,
  QuestionBrief,
  QuestionGateData,
  QuestionStatusInfo,
  SetStatusOptions,
} from '../../src/modules/questions/workflow/ports'

/** One question of the fake bank. Only `id` is required; every other field has a passing default. */
export interface FakeQuestion {
  id: string
  status: QuestionWorkflowStatus
  latestVersionNo: number
  liveVersionNo: number | null
  isActive: boolean
  createdById: string | null
  gate: QuestionGateData
  brief: QuestionBrief
  quality: QualityQuestion
  diagram: DiagramCandidate | null
  explanationSource: ExplanationSource
  sourcePaperId: string | null
  diagramFileId: string | null
  /** Live versions archived through `target: 'live'` (for tests). */
  archivedLive: number[]
}

export interface FakeSeed {
  id: string
  status?: QuestionWorkflowStatus
  createdById?: string | null
  latestVersionNo?: number
  liveVersionNo?: number | null
  isActive?: boolean
  sourcePaperId?: string | null
  /** Overrides of the gate data (a passing question by default). */
  gate?: Partial<QuestionGateData>
  brief?: Partial<QuestionBrief>
  quality?: Partial<QualityQuestion>
  diagram?: DiagramCandidate | null
  explanation?: string | null
}

/** A leaf part with a key, marks 1: enough for `checkKeysGate` to pass. */
function passingGate(id: string): QuestionGateData {
  return {
    id,
    parts: [],
    marks: 0,
    subjectId: '1',
    educationLevelId: '1',
    chapterId: '1',
    unitId: '1',
    spIds: ['1'],
    tp: 3,
    rightsStatus: 'own',
    hasSourceDeclaration: true,
    unconfirmedLowConfidenceFields: [],
    hasOpenDuplicateFlag: false,
    mediaResolved: true,
    missingRequiredFields: [],
    lastEditedByAi: false,
  }
}

/**
 * In-memory `QuestionBankPort` (a Map), for the tests of this module. It follows the behaviour the
 * contract of the port describes: unknown ids answer null / false, `setStatus` on `published`
 * makes the latest version live (and a previous live version superseded), a withdraw clears the live
 * version. It does NOT re-check the transition table: BE-10 decides that before calling.
 *
 * Failure injection: `failNextSetStatus` makes the next `setStatus` throw once (used by the
 * "forced failure leaves n live" test).
 */
export class FakeQuestionBank implements QuestionBankPort {
  readonly questions = new Map<string, FakeQuestion>()
  readonly calls: { method: string; args: unknown[] }[] = []
  private nextId = 9_000_000
  failNextSetStatus: Error | null = null

  /** Adds (or replaces) a question and returns it. */
  seed(input: FakeSeed): FakeQuestion {
    const status = input.status ?? 'draft'
    const gate = { ...passingGate(input.id), ...input.gate }
    const q: FakeQuestion = {
      id: input.id,
      status,
      latestVersionNo: input.latestVersionNo ?? 1,
      liveVersionNo: input.liveVersionNo !== undefined ? input.liveVersionNo : status === 'published' ? (input.latestVersionNo ?? 1) : null,
      isActive: input.isActive ?? true,
      createdById: input.createdById ?? null,
      gate,
      brief: {
        id: input.id,
        stemText: `Soalan ${input.id}`,
        type: 'mcq',
        status,
        subjectId: gate.subjectId,
        subjectName: 'Matematik',
        educationLevelId: gate.educationLevelId,
        levelName: 'Tingkatan 4',
        chapterName: null,
        ...input.brief,
      },
      quality: {
        id: input.id,
        stemText: `Soalan ${input.id} yang cukup panjang untuk markah penuh`,
        explanation: input.explanation === undefined ? 'Penjelasan.' : input.explanation,
        untagged: false,
        sourceType: 'manual',
        quarantinedOrRejected: false,
        isLegacy: false,
        subjectId: gate.subjectId,
        subjectName: 'Matematik',
        educationLevelId: gate.educationLevelId,
        levelName: 'Tingkatan 4',
        sourceSet: null,
        ...input.quality,
      },
      diagram: input.diagram ?? null,
      explanationSource: {
        id: input.id,
        type: 'mcq',
        stemText: `Soalan ${input.id}`,
        options: [
          { label: 'A', text: 'Pilihan A', isCorrect: true },
          { label: 'B', text: 'Pilihan B', isCorrect: false },
        ],
        answerText: null,
        explanation: input.explanation === undefined ? null : input.explanation,
      },
      sourcePaperId: input.sourcePaperId ?? null,
      diagramFileId: null,
      archivedLive: [],
    }
    this.questions.set(input.id, q)
    return q
  }

  private record(method: string, ...args: unknown[]): void {
    this.calls.push({ method, args })
  }

  private info(q: FakeQuestion): QuestionStatusInfo {
    return { id: q.id, status: q.status, latestVersionNo: q.latestVersionNo, liveVersionNo: q.liveVersionNo, isActive: q.isActive, createdById: q.createdById }
  }

  async getStatus(id: string): Promise<QuestionStatusInfo | null> {
    const q = this.questions.get(id)
    return q ? this.info(q) : null
  }

  async getForGates(id: string): Promise<QuestionGateData | null> {
    return this.questions.get(id)?.gate ?? null
  }

  async setStatus(id: string, to: QuestionWorkflowStatus, actorId: string, options: SetStatusOptions = {}): Promise<QuestionStatusInfo | null> {
    this.record('setStatus', id, to, actorId, options)
    if (this.failNextSetStatus) {
      const e = this.failNextSetStatus
      this.failNextSetStatus = null
      throw e
    }
    const q = this.questions.get(id)
    if (!q) return null
    if (options.target !== 'live' && options.expectedFrom !== undefined && q.status !== options.expectedFrom) throw ApiError.of('CONFLICT')
    if (options.target === 'live') {
      // Archive/withdraw the live version only; a newer latest version keeps its own status.
      if (q.liveVersionNo === null) return this.info(q)
      if (q.liveVersionNo === q.latestVersionNo) {
        q.status = to
        q.brief.status = to
      }
      q.archivedLive.push(q.liveVersionNo)
      q.liveVersionNo = null
      return this.info(q)
    }
    if (to === 'published') {
      q.liveVersionNo = q.latestVersionNo
    } else if (q.status === 'published') {
      q.liveVersionNo = null
    }
    q.status = to
    q.brief.status = to
    return this.info(q)
  }

  async deactivate(id: string): Promise<boolean> {
    this.record('deactivate', id)
    const q = this.questions.get(id)
    if (!q) return false
    q.isActive = false
    return true
  }

  async reactivate(id: string): Promise<boolean> {
    this.record('reactivate', id)
    const q = this.questions.get(id)
    if (!q) return false
    q.isActive = true
    return true
  }

  async create(input: ImportedQuestionInput): Promise<string> {
    this.record('create', input)
    const id = String(++this.nextId)
    this.seed({ id, status: input.status, createdById: input.createdById, explanation: input.explanation, gate: { subjectId: input.subjectId, educationLevelId: input.educationLevelId }, brief: { stemText: input.stemMs } })
    return id
  }

  async listIdsBySourcePaper(sourcePaperId: string): Promise<string[]> {
    return [...this.questions.values()].filter((q) => q.sourcePaperId === sourcePaperId).map((q) => q.id)
  }

  async describe(ids: readonly string[]): Promise<ReadonlyMap<string, QuestionBrief>> {
    const out = new Map<string, QuestionBrief>()
    for (const id of ids) {
      const q = this.questions.get(id)
      if (q) out.set(id, q.brief)
    }
    return out
  }

  async forEachQualityBatch(visit: (batch: QualityQuestion[]) => Promise<void>, size = 200): Promise<void> {
    const all = await this.listForQuality()
    for (let i = 0; i < all.length; i += size) await visit(all.slice(i, i + size))
  }

  async listForQuality(): Promise<QualityQuestion[]> {
    return [...this.questions.values()].sort((a, b) => Number(a.id) - Number(b.id)).map((q) => q.quality)
  }

  async listDiagramCandidates(kind: 'mcq' | 'structured'): Promise<DiagramCandidate[]> {
    return [...this.questions.values()]
      .filter((q) => q.diagram !== null && q.diagram.kind === kind)
      .sort((a, b) => Number(b.id) - Number(a.id))
      .map((q) => q.diagram as DiagramCandidate)
  }

  async attachDiagram(id: string, fileId: string): Promise<boolean> {
    this.record('attachDiagram', id, fileId)
    const q = this.questions.get(id)
    if (!q) return false
    q.diagramFileId = fileId
    return true
  }

  async getExplanationSource(id: string): Promise<ExplanationSource | null> {
    return this.questions.get(id)?.explanationSource ?? null
  }

  async setExplanation(id: string, text: string): Promise<boolean> {
    this.record('setExplanation', id, text)
    const q = this.questions.get(id)
    if (!q) return false
    q.explanationSource.explanation = text
    q.quality.explanation = text
    return true
  }
}
