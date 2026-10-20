import { Inject, Injectable } from '@nestjs/common'
import {
  DIAGRAM_AUDIT_EXCERPT_LENGTH,
  DIAGRAM_AUDIT_MESSAGES,
  DIAGRAM_AUDIT_PAGE_SIZE,
  DIAGRAM_AUDIT_PILL_COUNT,
  type DiagramAuditResponse,
} from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { idFromString, isIdString } from '../../../../db/ids'
import type { TxClient } from '../../../../db/client'
import { PrismaService } from '../../../../db/prisma.service'
import { FilesService } from '../../../files'
import type { AuthContext } from '../../../../common/scope/auth-context'
import type { DiagramCandidate } from '../ports'
import { QuestionWorkflowPorts } from '../ports'

export type DiagramKind = 'mcq' | 'structured'

export interface DiagramAuditFilters {
  subjectId?: string
  schoolId?: string
  mcqPage?: number
  strPage?: number
}

const cmpDesc = (a: string, b: string): number => (BigInt(a) < BigInt(b) ? 1 : BigInt(a) > BigInt(b) ? -1 : 0)

function excerpt(text: string): string {
  return text.length > DIAGRAM_AUDIT_EXCERPT_LENGTH ? `${text.slice(0, DIAGRAM_AUDIT_EXCERPT_LENGTH)}...` : text
}

function pageMeta(total: number, page: number) {
  const totalPages = Math.max(1, Math.ceil(total / DIAGRAM_AUDIT_PAGE_SIZE))
  const start = (page - 1) * DIAGRAM_AUDIT_PAGE_SIZE
  const from = start >= total ? null : start + 1
  const to = from === null ? null : Math.min(total, page * DIAGRAM_AUDIT_PAGE_SIZE)
  return { page, pageSize: DIAGRAM_AUDIT_PAGE_SIZE, totalItems: total, totalPages, from, to }
}

/** Diagram audit, S11 (BR-M04-19, FR-M04-95 to 101). */
@Injectable()
export class DiagramAuditService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuestionWorkflowPorts) private readonly ports: QuestionWorkflowPorts,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  /** Flagged candidates of `kind` minus the resolved ones, id descending. */
  private async open(kind: DiagramKind): Promise<DiagramCandidate[]> {
    const [all, resolved] = await Promise.all([
      this.ports.questionBank.listDiagramCandidates(kind),
      this.prisma.client.diagramAuditResolution.findMany({ where: { kind }, select: { questionId: true } }),
    ])
    const done = new Set(resolved.map((r) => r.questionId.toString()))
    return all.filter((c) => !done.has(c.id)).sort((a, b) => cmpDesc(a.id, b.id))
  }

  async list(filters: DiagramAuditFilters): Promise<DiagramAuditResponse> {
    const [mcqAll, strAll] = await Promise.all([this.open('mcq'), this.open('structured')])
    const subject = filters.subjectId
    // A malformed or unknown filter matches nothing (mock NO_MATCH): the compared ids simply differ.
    const bySubject = (c: DiagramCandidate): boolean => subject === undefined || c.subjectId === subject
    const mcqFiltered = mcqAll.filter((c) => bySubject(c) && (filters.schoolId === undefined || c.createdBy.schoolId === filters.schoolId))
    const strFiltered = strAll.filter(bySubject)

    const mcqPage = filters.mcqPage ?? 1
    const strPage = filters.strPage ?? 1
    const slice = <T,>(rows: T[], page: number): T[] => rows.slice((page - 1) * DIAGRAM_AUDIT_PAGE_SIZE, page * DIAGRAM_AUDIT_PAGE_SIZE)
    const subj = (c: DiagramCandidate) => (c.subjectId !== null ? { id: c.subjectId, name: c.subjectName ?? '' } : null)
    const who = (c: DiagramCandidate) => ({ id: c.createdBy.id, name: c.createdBy.name })

    const counts = new Map<string, { name: string; count: number }>()
    for (const c of mcqAll) {
      if (c.subjectId === null) continue
      const e = counts.get(c.subjectId) ?? { name: c.subjectName ?? '', count: 0 }
      e.count += 1
      counts.set(c.subjectId, e)
    }
    const pills = [...counts.entries()]
      .sort((a, b) => b[1].count - a[1].count || (BigInt(a[0]) < BigInt(b[0]) ? -1 : 1))
      .slice(0, DIAGRAM_AUDIT_PILL_COUNT)
      .map(([, e]) => ({ name: e.name, count: e.count }))

    return {
      data: {
        mcq: {
          items: slice(mcqFiltered, mcqPage).map((c) => ({
            id: c.id,
            questionText: c.text,
            subject: subj(c),
            createdBy: who(c),
            sourceFile: c.sourceFile,
            sourcePage: c.sourcePage,
          })),
          meta: pageMeta(mcqFiltered.length, mcqPage),
        },
        structured: {
          items: slice(strFiltered, strPage).map((c) => ({
            id: c.id,
            stimulusExcerpt: excerpt(c.text),
            subject: subj(c),
            createdBy: who(c),
            sourceFile: c.sourceFile,
            sourcePage: c.sourcePage,
          })),
          meta: pageMeta(strFiltered.length, strPage),
        },
      },
      meta: {
        stats: { mcq: mcqFiltered.length, structured: strFiltered.length, total: mcqFiltered.length + strFiltered.length },
        bySubject: pills,
        unfilteredMcq: mcqAll.length,
      },
    }
  }

  /** The candidate must exist in the bank's list for `kind` (resolved ones included: re-upload is allowed). */
  async assertExists(kind: DiagramKind, id: string): Promise<void> {
    await this.requireQuestion(kind, id)
  }

  private async requireQuestion(kind: DiagramKind, id: string): Promise<void> {
    if (!isIdString(id)) throw ApiError.of('NOT_FOUND')
    const status = await this.ports.questionBank.getStatus(id)
    if (!status) throw ApiError.of('NOT_FOUND')
    const flagged = await this.ports.questionBank.listDiagramCandidates(kind)
    const resolved = await this.prisma.client.diagramAuditResolution.findUnique({
      where: { kind_questionId: { kind, questionId: idFromString(id) } },
      select: { id: true },
    })
    if (!resolved && !flagged.some((c) => c.id === id)) throw ApiError.of('NOT_FOUND')
  }

  async uploadImage(
    auth: AuthContext,
    kind: DiagramKind,
    id: string,
    bytes: Buffer,
    who: { ip: string | null; requestId: string | null },
  ): Promise<{ data: { id: string; needsDiagram: false }; status: string }> {
    await this.requireQuestion(kind, id)
    // Confirm the bank still knows the question before a file is stored, so a failure leaves no orphan.
    if (!(await this.ports.questionBank.getStatus(id))) throw ApiError.of('NOT_FOUND')
    let publicId: string
    try {
      publicId = (await this.files.upload(auth, 'question_image', { buffer: bytes }, who)).id
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        throw ApiError.of('VALIDATION_ERROR', { fields: { image: DIAGRAM_AUDIT_MESSAGES.fileType } })
      }
      throw err
    }
    const file = await this.prisma.client.file.findUnique({ where: { publicId }, select: { id: true } })
    if (!file) throw ApiError.of('NOT_FOUND')
    await this.prisma.transaction(async (tx) => {
      if (!(await this.ports.questionBank.attachDiagram(id, file.id.toString()))) throw ApiError.of('NOT_FOUND')
      await this.resolve(tx, kind, id, 'image', file.id, auth.userId)
    })
    return { data: { id, needsDiagram: false }, status: DIAGRAM_AUDIT_MESSAGES.uploaded }
  }

  async dismiss(userId: string, kind: DiagramKind, id: string): Promise<{ data: { id: string; needsDiagram: false }; status: string }> {
    await this.requireQuestion(kind, id)
    await this.prisma.transaction((tx) => this.resolve(tx, kind, id, 'dismissed', null, userId))
    return { data: { id, needsDiagram: false }, status: DIAGRAM_AUDIT_MESSAGES.dismissed }
  }

  private async resolve(
    tx: TxClient,
    kind: DiagramKind,
    id: string,
    resolution: 'image' | 'dismissed',
    fileId: bigint | null,
    userId: string,
  ): Promise<void> {
    const questionId = idFromString(id)
    const data = { resolution, fileId, resolvedById: idFromString(userId) }
    await tx.diagramAuditResolution.upsert({
      where: { kind_questionId: { kind, questionId } },
      create: { kind, questionId, ...data },
      update: data,
    })
  }
}
