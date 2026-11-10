import { Inject, Injectable } from '@nestjs/common'

import type { PaperDocument, PaperDocumentPage } from '../../../db/generated/client'
import { PrismaService } from '../../../db/prisma.service'

export type DocumentWithPages = PaperDocument & { pages: (PaperDocumentPage & { file: { publicId: string } })[] }

export interface AdminDocumentFilter {
  subjectId?: bigint
  kertas?: number
  status?: 'draf' | 'terbit'
}

export interface SubjectRef {
  id: bigint
  code: string
  name: string
}

/** The only doorway to `paper_documents` and `paper_document_pages` (V2 parity, 0265). */
@Injectable()
export class DocumentsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Published documents, Kertas then Negeri (V2 order), without pages. */
  listPublished(): Promise<PaperDocument[]> {
    return this.prisma.client.paperDocument.findMany({
      where: { publishedAt: { not: null } },
      orderBy: [{ kertas: 'asc' }, { negeri: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
    })
  }

  findWithPages(id: bigint): Promise<DocumentWithPages | null> {
    return this.prisma.client.paperDocument.findUnique({
      where: { id },
      include: { pages: { include: { file: { select: { publicId: true } } }, orderBy: [{ kind: 'asc' }, { position: 'asc' }] } },
    })
  }

  async listAdmin(filter: AdminDocumentFilter, skip: number, take: number): Promise<{ rows: PaperDocument[]; total: number }> {
    const where = {
      ...(filter.subjectId === undefined ? {} : { subjectId: filter.subjectId }),
      ...(filter.kertas === undefined ? {} : { kertas: filter.kertas }),
      ...(filter.status === 'terbit' ? { publishedAt: { not: null } } : filter.status === 'draf' ? { publishedAt: null } : {}),
    }
    const [rows, total] = await Promise.all([
      this.prisma.client.paperDocument.findMany({
        where,
        orderBy: [{ subjectId: { sort: 'asc', nulls: 'last' } }, { kertas: 'asc' }, { negeri: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.client.paperDocument.count({ where }),
    ])
    return { rows, total }
  }

  /** The three V2 tiles over the whole set. */
  async counts(): Promise<{ total: number; published: number; withScheme: number }> {
    const [total, published, withScheme] = await Promise.all([
      this.prisma.client.paperDocument.count(),
      this.prisma.client.paperDocument.count({ where: { publishedAt: { not: null } } }),
      this.prisma.client.paperDocument.count({ where: { schemePageCount: { gt: 0 } } }),
    ])
    return { total, published, withScheme }
  }

  async subjectsByIds(ids: readonly bigint[]): Promise<Map<string, SubjectRef>> {
    const unique = [...new Set(ids.map((i) => i.toString()))].map((i) => BigInt(i))
    if (unique.length === 0) return new Map()
    const rows = await this.prisma.client.subject.findMany({ where: { id: { in: unique } }, select: { id: true, code: true, name: true } })
    return new Map(rows.map((r) => [r.id.toString(), r]))
  }

  async subjectByCode(code: string): Promise<SubjectRef | null> {
    return this.prisma.client.subject.findFirst({ where: { code: code.toUpperCase() }, select: { id: true, code: true, name: true } })
  }

  /** Locks the row so two admins flipping the same document do not race. */
  async lock(id: bigint): Promise<PaperDocument | null> {
    const rows = await this.prisma.client.$queryRaw<{ id: bigint }[]>`SELECT id FROM paper_documents WHERE id = ${id} FOR UPDATE`
    if (rows.length === 0) return null
    return this.prisma.client.paperDocument.findUnique({ where: { id } })
  }

  setPublished(id: bigint, publishedAt: Date | null, now: Date): Promise<PaperDocument> {
    return this.prisma.client.paperDocument.update({ where: { id }, data: { publishedAt, updatedAt: now } })
  }
}
