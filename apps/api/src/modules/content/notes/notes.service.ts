import { Inject, Injectable } from '@nestjs/common'
import {
  AdminNoteCreateRequestSchema,
  AdminNoteUpdateRequestSchema,
  CONTENT_FLASH,
  CONTENT_MESSAGES,
  NOTE_PAGE_SIZE,
  NOTE_SUBJECT_LABELS,
  NOTE_TYPE_FILTERS,
} from '@pp/contract'
import type { z } from 'zod'

import type { Prisma } from '../../../db/generated/client'
import { AuditService } from '../../../common/audit/audit.service'
import { listMeta } from '../../../common/http/respond'
import { toMytTimestamp } from '../../../common/time/myt'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { PrismaService } from '../../../db/prisma.service'
import { type Actor, auditBase, idOrNotFound, normaliseCodes, notFound, pageOf, searchOf, writeTx } from '../shared/content-support'
import { HTML_SANITIZER, type HtmlSanitizer } from '../shared/html-sanitizer'
import { NotesRepository, type NoteRow, type NoteWrite } from './notes.repository'

export const NOTE_AUDIT = { CREATED: 'content.note.created', UPDATED: 'content.note.updated', DELETED: 'content.note.deleted' } as const

const NOT_FOUND = CONTENT_MESSAGES.noteNotFound
type CreateBody = z.infer<typeof AdminNoteCreateRequestSchema>
type UpdateBody = z.infer<typeof AdminNoteUpdateRequestSchema>

const gradeLabel = (g: string): string => g.replace(/^DARJAH_(\d+)$/, 'Darjah $1')

function itemOf(n: NoteRow) {
  return {
    id: n.id.toString(),
    title: n.title,
    summary: n.summary,
    subject: n.subject,
    subjectLabel: (NOTE_SUBJECT_LABELS as Record<string, string>)[n.subject] ?? n.subject,
    noteType: n.noteType,
    grade: n.grade,
    gradeLabel: gradeLabel(n.grade),
    isPublished: n.isPublished,
    views: n.views,
    downloads: n.downloads,
    author: { id: n.author.id.toString(), name: n.author.name },
    createdAt: toMytTimestamp(n.createdAt),
    updatedAt: toMytTimestamp(n.updatedAt),
  }
}

@Injectable()
export class NotesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotesRepository) private readonly repo: NotesRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(HTML_SANITIZER) private readonly sanitizer: HtmlSanitizer,
  ) {}

  async list(q: { search?: string | undefined; subject?: string | undefined; noteType?: string | undefined; page?: string | undefined }) {
    const page = pageOf(q.page)
    const subject = q.subject?.trim() ?? ''
    // The type filter maps a filter value to a stored type; any other value is no filter.
    const noteType = (NOTE_TYPE_FILTERS as Record<string, string>)[q.noteType?.trim() ?? ''] ?? null
    const { rows, total } = await this.repo.list({
      search: searchOf(q.search),
      subject: subject === '' || subject === 'all' ? null : subject,
      noteType,
      skip: (page - 1) * NOTE_PAGE_SIZE,
      take: NOTE_PAGE_SIZE,
    })
    return { data: rows.map(itemOf), meta: listMeta(page, NOTE_PAGE_SIZE, total) }
  }

  async get(rawId: string) {
    const row = await this.repo.get(idOrNotFound(rawId, NOT_FOUND))
    if (!row) throw notFound(NOT_FOUND)
    return { ...itemOf(row), content: row.content }
  }

  async create(who: Actor, rawBody: unknown) {
    const body: CreateBody = new ZodValidationPipe(AdminNoteCreateRequestSchema).transform(normaliseCodes(rawBody ?? {}, ['noteType', 'grade'], ['subject']))
    const data: NoteWrite = {
      title: body.title,
      summary: body.summary || null,
      content: this.sanitizer.sanitize(body.content),
      subject: body.subject,
      noteType: body.noteType,
      grade: body.grade,
      isPublished: body.isPublished ?? false,
    }
    const detail = await writeTx(this.prisma, async (tx) => {
      const created = await this.repo.create(who.userId, data)
      await this.audit.record({ tx, ...auditBase(who, NOTE_AUDIT.CREATED), targetType: 'note', targetId: created, details: { isPublished: data.isPublished } })
      return this.get(created)
    })
    return { data: detail, status: CONTENT_FLASH.note.created }
  }

  /** Absent fields keep their value; counters and author never change. */
  async update(who: Actor, rawId: string, rawBody: unknown) {
    const id = idOrNotFound(rawId, NOT_FOUND)
    const current = await this.repo.get(id)
    if (!current) throw notFound(NOT_FOUND)
    const body: UpdateBody = new ZodValidationPipe(AdminNoteUpdateRequestSchema).transform(normaliseCodes(rawBody ?? {}, ['noteType', 'grade'], ['subject']))
    // Only the sent fields are written, so a concurrent change to another field is not overwritten.
    const patch: Prisma.NoteUncheckedUpdateManyInput = {}
    if (body.title !== undefined) patch.title = body.title
    if ('summary' in body) patch.summary = body.summary || null
    if (body.content !== undefined) patch.content = this.sanitizer.sanitize(body.content)
    if (body.subject !== undefined) patch.subject = body.subject
    if (body.noteType !== undefined) patch.noteType = body.noteType
    if (body.grade !== undefined) patch.grade = body.grade
    if (body.isPublished !== undefined) patch.isPublished = body.isPublished
    const detail = await writeTx(this.prisma, async (tx) => {
      if (!(await this.repo.update(id, patch))) throw notFound(NOT_FOUND)
      await this.audit.record({ tx, ...auditBase(who, NOTE_AUDIT.UPDATED), targetType: 'note', targetId: id, details: { fields: Object.keys(patch) } })
      return this.get(id)
    })
    return { data: detail, status: CONTENT_FLASH.note.updated }
  }

  async remove(who: Actor, rawId: string) {
    const id = idOrNotFound(rawId, NOT_FOUND)
    await writeTx(this.prisma, async (tx) => {
      if (!(await this.repo.remove(id))) throw notFound(NOT_FOUND)
      await this.audit.record({ tx, ...auditBase(who, NOTE_AUDIT.DELETED), targetType: 'note', targetId: id })
    })
    return { data: { deleted: 1 as const }, status: CONTENT_FLASH.note.deleted }
  }
}
