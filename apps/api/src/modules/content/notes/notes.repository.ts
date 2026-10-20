import { Inject, Injectable } from '@nestjs/common'

import type { Prisma } from '../../../db/generated/client'
import { idFromString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'

const include = { author: { select: { id: true, name: true } } } satisfies Prisma.NoteInclude
export type NoteRow = Prisma.NoteGetPayload<{ include: typeof include }>

export interface NoteWrite {
  title: string
  summary: string | null
  content: string
  subject: string
  noteType: string
  grade: string
  isPublished: boolean
}

/** The only doorway to `notes`. */
@Injectable()
export class NotesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(f: { search: string; subject: string | null; noteType: string | null; skip: number; take: number }): Promise<{ rows: NoteRow[]; total: number }> {
    const where: Prisma.NoteWhereInput = {
      ...(f.subject ? { subject: f.subject } : {}),
      ...(f.noteType ? { noteType: f.noteType } : {}),
      ...(f.search ? { title: { contains: f.search, mode: 'insensitive' } } : {}),
    }
    const [rows, total] = await Promise.all([
      this.prisma.client.note.findMany({ where, orderBy: { id: 'asc' }, skip: f.skip, take: f.take, include }),
      this.prisma.client.note.count({ where }),
    ])
    return { rows, total }
  }

  get(id: string): Promise<NoteRow | null> {
    return this.prisma.client.note.findUnique({ where: { id: idFromString(id) }, include })
  }

  async create(authorId: string, data: NoteWrite): Promise<string> {
    const row = await this.prisma.client.note.create({ data: { ...data, authorId: idFromString(authorId) }, select: { id: true } })
    return row.id.toString()
  }

  /** Writes only the fields in `patch`; false when the row is gone. */
  async update(id: string, patch: Prisma.NoteUncheckedUpdateManyInput): Promise<boolean> {
    const r = await this.prisma.client.note.updateMany({ where: { id: idFromString(id) }, data: patch })
    return r.count === 1
  }

  async remove(id: string): Promise<boolean> {
    const r = await this.prisma.client.note.deleteMany({ where: { id: idFromString(id) } })
    return r.count === 1
  }
}
