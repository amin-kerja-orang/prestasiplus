import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import type { ChatTool } from './rules'

/** A decimal-string id as bigint, or null when it is not a canonical id (an unknown id, never an error). */
const idOf = (id: string): bigint | null => (isIdString(id) ? idFromString(id) : null)

export interface RphRecord {
  id: string
  userId: string
  subjectName: string
  level: string
  tajuk: string
  className: string | null
  /** `YYYY-MM-DD`. */
  lessonDate: string
  durationMinutes: number
  timeSlot: string | null
  tema: string | null
  pengajaranKeperluan: string | null
  status: string
  source: string
  content: string
  threadId: string | null
  createdAt: Date
}

export interface NewRph {
  userId: string
  subjectName: string
  level: string
  tajuk: string
  className: string | null
  lessonDate: string
  durationMinutes: number
  timeSlot: string | null
  tema: string | null
  pengajaranKeperluan: string | null
  source: 'form' | 'chat'
  content: string
  threadId: string | null
  isTest: boolean
  now: Date
}

export interface EssayRecord {
  id: string
  userId: string
  rubricKey: string
  subjectName: string | null
  level: string | null
  studentName: string | null
  essayTitle: string | null
  essayText: string
  marks: number
  maxMarks: number
  comment: string
  threadId: string
  createdAt: Date
}

export interface NewEssay {
  userId: string
  rubricKey: string
  subjectName: string | null
  level: string | null
  studentName: string | null
  essayTitle: string | null
  essayText: string
  marks: number
  maxMarks: number
  comment: string
  threadId: string
  isTest: boolean
  now: Date
}

export type PbdStatus = 'pending' | 'approved'

export interface PbdTagRecord {
  id: string
  userId: string
  classroomId: string
  studentId: string
  sp: string
  skor: number
  tp: number
  status: PbdStatus
  createdAt: Date
  approvedAt: Date | null
}

export interface NewPbdTag {
  userId: string
  classroomId: string
  studentId: string
  sp: string
  skor: number
  tp: number
  isTest: boolean
  now: Date
}

export interface NewMessage {
  threadId: string
  userId: string
  role: 'user' | 'bot'
  text: string
  tool: ChatTool | null
  toolHops: 0 | 1
  tokensIn: number
  tokensOut: number
  isTest: boolean
  now: Date
}

export interface StoredMessage {
  id: string
  threadId: string
  userId: string
  role: 'user' | 'bot'
  tool: ChatTool | null
  toolHops: number
  tokensIn: number
  tokensOut: number
  createdAt: Date
}

const dateKey = (d: Date): string => d.toISOString().slice(0, 10)

/**
 * The only doorway to the five Cikgu Alesa tables (`chat_threads`, `chat_messages`, `rph_plans`, `essay_markings`,
 * `pbd_tags`, ADR-0014). Every read of a record is scoped to its owner (BR-M13-01): a foreign or unknown id answers null.
 * Methods use the active transaction when the service opened one (`prisma.client`). It never logs and never returns
 * a legacy column.
 */
@Injectable()
export class CikguRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  // --- chat -----------------------------------------------------------------------------------------

  /**
   * Serialises the quota check and the inserts of one user: a transaction-scoped advisory lock keyed by user (BR-M13-06).
   * Must run inside `prisma.transaction(...)`; it is released at commit or rollback.
   */
  async lockUserChat(userId: string): Promise<void> {
    await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`cikgu.chat:${userId}`}, 0))`
  }

  /** Serialises the roll-up writes of one teacher (the unique key `(user, class, student, sp)` would otherwise race). Approval does not take it: it is one status-guarded UPDATE, and the roll-up refresh is status-guarded too. Inside a transaction. */
  async lockUserPbd(userId: string): Promise<void> {
    await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`cikgu.pbd:${userId}`}, 0))`
  }

  /** The user's `user` messages created in `[from, to)` (the day's turns used). Uses `ix_chat_messages_user_id_created_at`. */
  async countUserTurns(userId: string, from: Date, to: Date): Promise<number> {
    const key = idOf(userId)
    if (key === null) return 0
    return this.db.chatMessage.count({ where: { userId: key, role: 'user', createdAt: { gte: from, lt: to } } })
  }

  /** The id of the user's own thread, or null (unknown, malformed and foreign ids are indistinguishable). */
  async ownThreadId(userId: string, threadId: string): Promise<string | null> {
    const u = idOf(userId)
    const t = idOf(threadId)
    if (u === null || t === null) return null
    const row = await this.db.chatThread.findFirst({ where: { id: t, userId: u }, select: { id: true } })
    return row ? idToString(row.id) : null
  }

  async createThread(userId: string, isTest: boolean, now: Date): Promise<string> {
    const row = await this.db.chatThread.create({
      data: { userId: idFromString(userId), isTest, createdAt: now, updatedAt: now },
      select: { id: true },
    })
    return idToString(row.id)
  }

  async touchThread(threadId: string, now: Date): Promise<void> {
    await this.db.chatThread.update({ where: { id: idFromString(threadId) }, data: { updatedAt: now } })
  }

  async addMessage(input: NewMessage): Promise<void> {
    await this.db.chatMessage.create({
      data: {
        threadId: idFromString(input.threadId),
        userId: idFromString(input.userId),
        role: input.role,
        text: input.text,
        tool: input.tool,
        toolHops: input.toolHops,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
        isTest: input.isTest,
        createdAt: input.now,
      },
    })
  }

  /** Messages of a thread, oldest first (tests and the later history route). Text is not returned: only the facts. */
  async messageFacts(threadId: string): Promise<StoredMessage[]> {
    const key = idOf(threadId)
    if (key === null) return []
    const rows = await this.db.chatMessage.findMany({
      where: { threadId: key },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, threadId: true, userId: true, role: true, tool: true, toolHops: true, tokensIn: true, tokensOut: true, createdAt: true },
    })
    return rows.map((r) => ({
      id: idToString(r.id),
      threadId: idToString(r.threadId),
      userId: idToString(r.userId),
      role: r.role as 'user' | 'bot',
      tool: r.tool as ChatTool | null,
      toolHops: r.toolHops,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      createdAt: r.createdAt,
    }))
  }

  // --- RPH ------------------------------------------------------------------------------------------

  async createRph(input: NewRph): Promise<RphRecord> {
    const row = await this.db.rphPlan.create({
      data: {
        userId: idFromString(input.userId),
        subjectName: input.subjectName,
        level: input.level,
        tajuk: input.tajuk,
        className: input.className,
        lessonDate: new Date(`${input.lessonDate}T00:00:00Z`),
        durationMinutes: input.durationMinutes,
        timeSlot: input.timeSlot,
        tema: input.tema,
        pengajaranKeperluan: input.pengajaranKeperluan,
        status: 'generated',
        source: input.source,
        content: input.content,
        threadId: input.threadId === null ? null : idFromString(input.threadId),
        isTest: input.isTest,
        createdAt: input.now,
      },
    })
    return toRph(row)
  }

  /** The owner's RPHs, lesson date descending then id descending (mock order). */
  async rphPage(userId: string, page: number, pageSize: number): Promise<{ rows: RphRecord[]; total: number }> {
    const key = idOf(userId)
    if (key === null) return { rows: [], total: 0 }
    const where = { userId: key }
    const [rows, total] = await Promise.all([
      this.db.rphPlan.findMany({ where, orderBy: [{ lessonDate: 'desc' }, { id: 'desc' }], skip: skipOf(page, pageSize), take: pageSize }),
      this.db.rphPlan.count({ where }),
    ])
    return { rows: rows.map(toRph), total }
  }

  async rphOf(userId: string, id: string): Promise<RphRecord | null> {
    const u = idOf(userId)
    const key = idOf(id)
    if (u === null || key === null) return null
    const row = await this.db.rphPlan.findFirst({ where: { id: key, userId: u } })
    return row ? toRph(row) : null
  }

  // --- essays ---------------------------------------------------------------------------------------

  async createEssay(input: NewEssay): Promise<void> {
    await this.db.essayMarking.create({
      data: {
        userId: idFromString(input.userId),
        rubricKey: input.rubricKey,
        subjectName: input.subjectName,
        level: input.level,
        studentName: input.studentName,
        essayTitle: input.essayTitle,
        essayText: input.essayText,
        marks: input.marks,
        maxMarks: input.maxMarks,
        comment: input.comment,
        threadId: idFromString(input.threadId),
        isTest: input.isTest,
        createdAt: input.now,
      },
    })
  }

  /** The owner's markings, newest first then id descending. */
  async essayPage(userId: string, page: number, pageSize: number): Promise<{ rows: EssayRecord[]; total: number }> {
    const key = idOf(userId)
    if (key === null) return { rows: [], total: 0 }
    const where = { userId: key }
    const [rows, total] = await Promise.all([
      this.db.essayMarking.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: skipOf(page, pageSize), take: pageSize }),
      this.db.essayMarking.count({ where }),
    ])
    return { rows: rows.map(toEssay), total }
  }

  async essayOf(userId: string, id: string): Promise<EssayRecord | null> {
    const u = idOf(userId)
    const key = idOf(id)
    if (u === null || key === null) return null
    const row = await this.db.essayMarking.findFirst({ where: { id: key, userId: u } })
    return row ? toEssay(row) : null
  }

  // --- PBD tags -------------------------------------------------------------------------------------

  /** Every pending tag of the owner (the queue is sorted by student name in the service, which needs the names). */
  async pendingTags(userId: string): Promise<PbdTagRecord[]> {
    const key = idOf(userId)
    if (key === null) return []
    const rows = await this.db.pbdTag.findMany({ where: { userId: key, status: 'pending' }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] })
    return rows.map(toTag)
  }

  /** Every approved tag of the owner, by approval time (else roll-up time) then id; the service adds the name tie-break. */
  async approvedTags(userId: string): Promise<PbdTagRecord[]> {
    const key = idOf(userId)
    if (key === null) return []
    const rows = await this.db.pbdTag.findMany({ where: { userId: key, status: 'approved' }, orderBy: [{ id: 'asc' }] })
    return rows.map(toTag)
  }

  /** The owner's tags of one class and one `sp` for the given students (any status). */
  async tagsOf(userId: string, classroomId: string, studentIds: readonly string[], sp: string): Promise<PbdTagRecord[]> {
    const u = idOf(userId)
    const c = idOf(classroomId)
    const students = studentIds.flatMap((s) => (isIdString(s) ? [idFromString(s)] : []))
    if (u === null || c === null || students.length === 0) return []
    const rows = await this.db.pbdTag.findMany({ where: { userId: u, classroomId: c, studentId: { in: students }, sp } })
    return rows.map(toTag)
  }

  async createTag(input: NewPbdTag): Promise<void> {
    await this.db.pbdTag.create({
      data: {
        userId: idFromString(input.userId),
        classroomId: idFromString(input.classroomId),
        studentId: idFromString(input.studentId),
        sp: input.sp,
        skor: input.skor,
        tp: input.tp,
        status: 'pending',
        isTest: input.isTest,
        createdAt: input.now,
      },
    })
  }

  /** A re-run of the roll-up: the pending tag gets the new score and band and the roll-up time. */
  async refreshPendingTag(id: string, skor: number, tp: number, now: Date): Promise<boolean> {
    // Guarded by status: a tag approved meanwhile is left alone (the caller counts it as skipped).
    const res = await this.db.pbdTag.updateMany({ where: { id: idFromString(id), status: 'pending' }, data: { skor, tp, createdAt: now } })
    return res.count > 0
  }

  /** Approves the owner's PENDING tags among `ids` in one statement; returns how many changed. Foreign and non-pending ids are ignored. */
  async approve(userId: string, ids: readonly string[], now: Date): Promise<number> {
    const u = idOf(userId)
    const keys = [...new Set(ids)].flatMap((i) => (isIdString(i) ? [idFromString(i)] : []))
    if (u === null || keys.length === 0) return 0
    const res = await this.db.pbdTag.updateMany({ where: { id: { in: keys }, userId: u, status: 'pending' }, data: { status: 'approved', approvedAt: now } })
    return res.count
  }
}

const toRph = (r: {
  id: bigint
  userId: bigint
  subjectName: string
  level: string
  tajuk: string
  className: string | null
  lessonDate: Date
  durationMinutes: number
  timeSlot: string | null
  tema: string | null
  pengajaranKeperluan: string | null
  status: string
  source: string
  content: string
  threadId: bigint | null
  createdAt: Date
}): RphRecord => ({
  id: idToString(r.id),
  userId: idToString(r.userId),
  subjectName: r.subjectName,
  level: r.level,
  tajuk: r.tajuk,
  className: r.className,
  lessonDate: dateKey(r.lessonDate),
  durationMinutes: r.durationMinutes,
  timeSlot: r.timeSlot,
  tema: r.tema,
  pengajaranKeperluan: r.pengajaranKeperluan,
  status: r.status,
  source: r.source,
  content: r.content,
  threadId: r.threadId === null ? null : idToString(r.threadId),
  createdAt: r.createdAt,
})

const toEssay = (r: {
  id: bigint
  userId: bigint
  rubricKey: string
  subjectName: string | null
  level: string | null
  studentName: string | null
  essayTitle: string | null
  essayText: string
  marks: number
  maxMarks: number
  comment: string
  threadId: bigint
  createdAt: Date
}): EssayRecord => ({
  id: idToString(r.id),
  userId: idToString(r.userId),
  rubricKey: r.rubricKey,
  subjectName: r.subjectName,
  level: r.level,
  studentName: r.studentName,
  essayTitle: r.essayTitle,
  essayText: r.essayText,
  marks: r.marks,
  maxMarks: r.maxMarks,
  comment: r.comment,
  threadId: idToString(r.threadId),
  createdAt: r.createdAt,
})

const toTag = (r: {
  id: bigint
  userId: bigint
  classroomId: bigint
  studentId: bigint
  sp: string
  skor: { toNumber(): number }
  tp: number
  status: string
  createdAt: Date
  approvedAt: Date | null
}): PbdTagRecord => ({
  id: idToString(r.id),
  userId: idToString(r.userId),
  classroomId: idToString(r.classroomId),
  studentId: idToString(r.studentId),
  sp: r.sp,
  skor: r.skor.toNumber(),
  tp: r.tp,
  status: r.status as PbdStatus,
  createdAt: r.createdAt,
  approvedAt: r.approvedAt,
})

/** Rows to skip for a page; capped so a huge page number stays a valid OFFSET (the page is simply empty). */
function skipOf(page: number, pageSize: number): number {
  return Math.min((page - 1) * pageSize, 2_000_000_000)
}
