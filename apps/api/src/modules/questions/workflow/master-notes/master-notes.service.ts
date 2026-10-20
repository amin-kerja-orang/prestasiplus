import { Inject, Injectable } from '@nestjs/common'
import {
  MASTER_NOTE_PAGE_SIZE,
  MASTER_NOTE_TABS,
  type MasterNoteAction,
  type MasterNoteRow,
  type MasterNoteTab,
} from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { listMeta } from '../../../../common/http/respond'
import { toMytTimestamp } from '../../../../common/time/myt'
import { idFromString, idToString, isIdString } from '../../../../db/ids'
import type { MasterNote } from '../../../../db/generated/client'
import { PrismaService } from '../../../../db/prisma.service'
import { QuestionWorkflowPorts } from '../ports'
import { CANNED_NOTES, nextCannedIndex } from './canned-notes'

/** Master notes, S12 (BR-M04-23, FR-M04-102 to 105). `regen` never calls the network. */
@Injectable()
export class MasterNotesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuestionWorkflowPorts) private readonly ports: QuestionWorkflowPorts,
  ) {}

  async list(askedTab: string | undefined, page: number) {
    const tab: MasterNoteTab = (MASTER_NOTE_TABS as readonly string[]).includes(askedTab ?? '') ? (askedTab as MasterNoteTab) : 'flagged'
    const where = tab === 'flagged' ? { flagged: true } : tab === 'approved' ? { teacherApproved: true } : {}
    const db = this.prisma.client
    const [total, rows, flagged, teacherApproved, all] = await Promise.all([
      db.masterNote.count({ where }),
      db.masterNote.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * MASTER_NOTE_PAGE_SIZE, take: MASTER_NOTE_PAGE_SIZE }),
      db.masterNote.count({ where: { flagged: true } }),
      db.masterNote.count({ where: { teacherApproved: true } }),
      db.masterNote.count(),
    ])
    const briefs = await this.ports.questionBank.describe([...new Set(rows.map((r) => idToString(r.questionId)))])
    return {
      data: rows.map((r) => this.row(r, briefs.get(idToString(r.questionId)))),
      meta: { ...listMeta(page, MASTER_NOTE_PAGE_SIZE, total), activeTab: tab, summary: { flagged, teacherApproved, total: all } },
    }
  }

  private row(n: MasterNote, brief: { stemText: string; subjectName: string | null; chapterName: string | null } | undefined): MasterNoteRow {
    return {
      id: idToString(n.id),
      questionId: idToString(n.questionId),
      subjectName: brief?.subjectName ?? '—',
      chapter: n.chapterLabel ?? brief?.chapterName ?? null,
      model: n.model,
      tokens: n.tokens,
      confidence: n.confidence,
      questionText: brief?.stemText ?? '',
      noteText: n.noteText,
      trapText: n.trapText,
      flagged: n.flagged,
      teacherApproved: n.teacherApproved,
      createdAt: toMytTimestamp(n.createdAt),
    }
  }

  /** approve: approved and unflagged; unflag: unflagged; regen: the next canned note, flags kept. */
  async act(id: string, action: MasterNoteAction): Promise<{ ok: true }> {
    if (!isIdString(id)) throw ApiError.of('NOT_FOUND')
    const noteId = idFromString(id)
    await this.prisma.transaction(async (tx) => {
      const note = await tx.masterNote.findUnique({ where: { id: noteId } })
      if (!note) throw ApiError.of('NOT_FOUND')
      if (action === 'approve') await tx.masterNote.update({ where: { id: noteId }, data: { teacherApproved: true, flagged: false } })
      else if (action === 'unflag') await tx.masterNote.update({ where: { id: noteId }, data: { flagged: false } })
      else {
        const canned = CANNED_NOTES[nextCannedIndex(note.noteText)] as (typeof CANNED_NOTES)[number]
        await tx.masterNote.update({ where: { id: noteId }, data: { noteText: canned.noteText, trapText: canned.trapText, tokens: canned.tokens } })
      }
    })
    return { ok: true }
  }
}
