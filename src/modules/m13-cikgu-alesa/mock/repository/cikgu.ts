/**
 * `cikgu` repository (SRS M13 v1.1 §6, §7; BR-M13-01…23): the one owner contract of the M13 stores
 * (chat threads and messages, RPHs, essay markings, PBD tags, test-hook state). Every read of a record
 * list is scoped to its owner (BR-M13-01); a foreign or unknown id answers `undefined` (the handler
 * turns it into 404, FR-M13-48). Reads other owners' stores through their public contracts only: M01
 * users, M03 subjects, M05 answers, M10 classes (D12).
 */

import { dayRange, formatDate, formatDateKey, DAY_MS, toIsoMyt } from '@/lib/time'
import { defineRepository } from '@/mock/repository'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { practice } from '@/modules/m05-practice/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import {
  LEVEL_CODES,
  PAGE_SIZE,
  rubricOf,
  SP_LABELS,
  TIERS,
  type ChatTier,
  type LevelCode,
} from '../../api/settings'
import type {
  ChatSendResponse,
  EssayMarking,
  Rph,
  RphCreateRequest,
  RphSource,
  RollupResult,
} from '../../api/types'
import {
  cannedMarks,
  GENERAL_REPLY,
  markingReply,
  parseHandoff,
  parseRphRequest,
  PRACTICE_REPLY,
  rphConfirmation,
  rphContent,
  RPH_FOLLOW_UP,
  routeOf,
  skorOf,
  tokensIn,
  tokensOut,
  tpOf,
} from './canned'
import {
  essaysTable,
  messagesTable,
  pbdTagsTable,
  rphsTable,
  testStateTable,
  threadsTable,
} from '../tables/tables'
import type { ChatTool, PbdTag } from './types'

const RUNTIME_THREAD_FLOOR = 9_000_001
const iso = (ms: number): string => toIsoMyt(ms)
const ms = (isoTime: string): number => Date.parse(isoTime)

/** Malay, case-insensitive A→Z (BR-M13-13). */
const collator = new Intl.Collator('ms', { sensitivity: 'base' })

export type SendOutcome =
  { kind: 'blank' } | { kind: 'quota' } | { kind: 'ok'; body: ChatSendResponse }

export type RphResult = { ok: true; rph: Rph } | { ok: false; fields: Record<string, string> }

export interface RphDraft {
  subjectName: string
  level: LevelCode
  tajuk: string
  className: string | null
  lessonDate: string
  durationMinutes: number
  timeSlot: string | null
  tema: string | null
  pengajaranKeperluan: string | null
}

export const VALIDATION_MSG = {
  required: 'Medan ini diperlukan.',
  invalid: 'Medan ini tidak sah.',
  tooLong: (n: number) => `Medan ini tidak boleh melebihi ${String(n)} aksara.`,
  duration: 'Tempoh mesti antara 15 dan 240 minit.',
  date: 'Tarikh tidak sah.',
} as const

// --- helpers ------------------------------------------------------------------------------------

export function tierOf(role: string): { tier: ChatTier; dailyTurns: number } {
  if (role === 'admin') return TIERS.admin
  if (role === 'teacher') return TIERS.teacher
  return TIERS.other
}

const nameOf = (userId: number): string => users.get(userId)?.name ?? ''

const isDateKey = (v: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(`${v}T00:00:00+08:00`)) &&
  formatDateKey(Date.parse(`${v}T00:00:00+08:00`)) === v

const dateLabelOf = (key: string): string => formatDate(Date.parse(`${key}T12:00:00+08:00`))

function nextThreadId(): string {
  let max = RUNTIME_THREAD_FLOOR - 1
  for (const t of threadsTable.query().rows) {
    const n = /^thr-(\d+)$/.exec(t.id)
    if (n && Number(n[1]) > max) max = Number(n[1])
  }
  return `thr-${String(max + 1)}`
}

function testState(kind: 'nextReply' | 'turnsAdjust', userId: number | null) {
  return testStateTable.query({ where: { kind, userId } }).rows[0]
}

/** Today's user turns of `userId` (BR-M13-06), including the `cikguSetTurnsUsed` offset. */
function countedTurns(userId: number, now: number): number {
  const range = dayRange(now)
  let n = 0
  for (const t of threadsTable.query({ where: { userId } }).rows) {
    for (const m of messagesTable.query({ where: { threadId: t.id, role: 'user' } }).rows) {
      const at = ms(m.createdAt)
      if (at >= range.start && at < range.end) n++
    }
  }
  return n
}

function turnsUsed(userId: number, now: number): number {
  return Math.max(0, countedTurns(userId, now) + (testState('turnsAdjust', userId)?.adjust ?? 0))
}

// --- records ------------------------------------------------------------------------------------

function saveRph(
  userId: number,
  draft: RphDraft,
  source: RphSource,
  threadId: string | null,
  now: number,
): Rph {
  const content = rphContent({
    subjectName: draft.subjectName,
    level: draft.level,
    tajuk: draft.tajuk,
    className: draft.className,
    dateLabel: dateLabelOf(draft.lessonDate),
    durationMinutes: draft.durationMinutes,
    timeSlot: draft.timeSlot,
    tema: draft.tema,
    pengajaranKeperluan: draft.pengajaranKeperluan,
  })
  return rphsTable.insert({
    userId,
    ...draft,
    status: 'generated',
    source,
    content,
    threadId,
    createdAt: iso(now),
  })
}

const optional = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

/** BR-M13-12 server-side checks. */
export function validateRph(
  input: RphCreateRequest,
  now: number,
): { draft: RphDraft } | { fields: Record<string, string> } {
  const fields: Record<string, string> = {}
  const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

  const subjectName = text(input.subjectName)
  if (subjectName === '') fields.subjectName = VALIDATION_MSG.required
  else if ([...subjectName].length > 100) fields.subjectName = VALIDATION_MSG.tooLong(100)

  const level = text(input.level)
  if (level === '') fields.level = VALIDATION_MSG.required
  else if (!(LEVEL_CODES as readonly string[]).includes(level))
    fields.level = VALIDATION_MSG.invalid

  const tajuk = text(input.tajuk)
  if (tajuk === '') fields.tajuk = VALIDATION_MSG.required
  else if ([...tajuk].length > 200) fields.tajuk = VALIDATION_MSG.tooLong(200)

  let durationMinutes = 60
  if (input.durationMinutes !== undefined && input.durationMinutes !== null) {
    const d: unknown = input.durationMinutes
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 15 || d > 240) {
      fields.durationMinutes = VALIDATION_MSG.duration
    } else durationMinutes = d
  }

  let lessonDate = formatDateKey(now)
  const rawDate = text(input.lessonDate)
  if (rawDate !== '') {
    if (isDateKey(rawDate)) lessonDate = rawDate
    else fields.lessonDate = VALIDATION_MSG.date
  }

  const keperluan = optional(input.pengajaranKeperluan)
  if (keperluan !== null && [...keperluan].length > 500) {
    fields.pengajaranKeperluan = VALIDATION_MSG.tooLong(500)
  }
  const className = optional(input.className)
  if (className !== null && [...className].length > 100)
    fields.className = VALIDATION_MSG.tooLong(100)
  const timeSlot = optional(input.timeSlot)
  if (timeSlot !== null && [...timeSlot].length > 100) fields.timeSlot = VALIDATION_MSG.tooLong(100)
  const tema = optional(input.tema)
  if (tema !== null && [...tema].length > 100) fields.tema = VALIDATION_MSG.tooLong(100)

  if (Object.keys(fields).length > 0) return { fields }
  return {
    draft: {
      subjectName,
      level: level as LevelCode,
      tajuk,
      className,
      lessonDate,
      durationMinutes,
      timeSlot,
      tema,
      pengajaranKeperluan: keperluan,
    },
  }
}

const pageOf = <T>(rows: readonly T[], page: number): { rows: T[]; total: number } => ({
  rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  total: rows.length,
})

function pendingSorted(userId: number): PbdTag[] {
  return pbdTagsTable
    .query({ where: { userId, status: 'pending' } })
    .rows.sort(
      (a, b) =>
        ms(b.createdAt) - ms(a.createdAt) ||
        collator.compare(nameOf(a.studentId), nameOf(b.studentId)) ||
        a.id - b.id,
    )
}

export function csvCell(value: string | number): string {
  let s = String(value)
  // SEC-M13-04: neutralise spreadsheet formulas.
  if (/^[=+@-]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const cikguRepo = defineRepository({
  owner: 'M13',
  name: 'cikgu',
  store: threadsTable,
  stores: {
    messages: messagesTable,
    rphs: rphsTable,
    essays: essaysTable,
    pbdTags: pbdTagsTable,
    testState: testStateTable,
  },
  methods: ({ transaction }) => ({
    // --- seed phase ---------------------------------------------------------------------------
    /** Inserts the designed rows (SRS §6.8.3) with their literal ids. */
    seed(rows: {
      threads: Parameters<typeof threadsTable.insert>[0][]
      messages: Parameters<typeof messagesTable.insert>[0][]
      rphs: Parameters<typeof rphsTable.insert>[0][]
      essays: Parameters<typeof essaysTable.insert>[0][]
      pbdTags: Parameters<typeof pbdTagsTable.insert>[0][]
    }): void {
      transaction(() => {
        for (const r of rows.threads) threadsTable.insert(r)
        for (const r of rows.messages) messagesTable.insert(r)
        for (const r of rows.rphs) rphsTable.insert(r)
        for (const r of rows.essays) essaysTable.insert(r)
        for (const r of rows.pbdTags) pbdTagsTable.insert(r)
      })
    },

    // --- chat (#1) ----------------------------------------------------------------------------
    /** Today's quota used by the user (BR-M13-06). */
    turnsUsed: (userId: number, now: number): number => turnsUsed(userId, now),

    /** `cikguSetTurnsUsed(userId, n)`: reads as `n` today; later turns count on top. */
    setTurnsUsed(userId: number, n: number, now: number): void {
      transaction(() => {
        const adjust = n - countedTurns(userId, now)
        const row = testState('turnsAdjust', userId)
        if (row) testStateTable.update(row.id, { adjust })
        else testStateTable.insert({ kind: 'turnsAdjust', userId, text: null, adjust })
      })
    },

    /** `cikguNextReply(text)`: overrides the text of the next reply; `null` clears it. */
    setNextReply(text: string | null): void {
      transaction(() => {
        const row = testState('nextReply', null)
        if (text === null) {
          if (row) testStateTable.remove(row.id)
        } else if (row) testStateTable.update(row.id, { text })
        else testStateTable.insert({ kind: 'nextReply', userId: null, text, adjust: 0 })
      })
    },

    /** One chat turn (FR-M13-24…28, BR-M13-03…07). */
    send(input: {
      userId: number
      role: string
      message: string
      threadId: string | null
      now: number
    }): SendOutcome {
      const message = input.message.trim()
      if (message === '') return { kind: 'blank' }
      return transaction((): SendOutcome => {
        const { tier, dailyTurns } = tierOf(input.role)
        const used = turnsUsed(input.userId, input.now)
        if (used >= dailyTurns) return { kind: 'quota' }

        const at = iso(input.now)
        const existing = input.threadId !== null ? threadsTable.get(input.threadId) : undefined
        const threadId = existing && existing.userId === input.userId ? existing.id : nextThreadId()
        if (threadId === existing?.id) threadsTable.update(threadId, { updatedAt: at })
        else
          threadsTable.insert({ id: threadId, userId: input.userId, createdAt: at, updatedAt: at })

        let reply: string
        let tool: ChatTool | null = null
        const route = routeOf(message)
        if (route === 'mark_essay') {
          const h = parseHandoff(message)
          const marks = cannedMarks(h.rubric.max)
          reply = markingReply(h.rubric, marks)
          tool = 'mark_essay'
          essaysTable.insert({
            userId: input.userId,
            rubricKey: h.rubric.key,
            subjectName: h.subject,
            level: h.level,
            studentName: h.student,
            essayTitle: h.title,
            essayText: h.essay,
            marks,
            maxMarks: h.rubric.max,
            comment: reply,
            threadId,
            createdAt: at,
          })
        } else if (route === 'rph') {
          const subjects = curriculum.subjects({ active: true }).map((s) => s.name)
          const p = parseRphRequest(message, subjects)
          if (p) {
            const today = formatDateKey(input.now)
            const lessonDate = p.tomorrow ? formatDateKey(input.now + DAY_MS) : today
            const rph = saveRph(
              input.userId,
              {
                subjectName: p.subject,
                level: p.level,
                tajuk: p.tajuk,
                className: null,
                lessonDate,
                durationMinutes: 60,
                timeSlot: null,
                tema: null,
                pengajaranKeperluan: null,
              },
              'chat',
              threadId,
              input.now,
            )
            reply = rphConfirmation(rph.tajuk, rph.subjectName, rph.level, dateLabelOf(lessonDate))
            tool = 'rph'
          } else reply = RPH_FOLLOW_UP
        } else if (route === 'practice') {
          reply = PRACTICE_REPLY
          tool = 'practice'
        } else reply = GENERAL_REPLY

        const override = testState('nextReply', null)
        if (override) {
          reply = override.text ?? ''
          testStateTable.remove(override.id)
        }

        const toolHops = tool === null ? 0 : 1
        const tIn = tokensIn(message)
        const tOut = tokensOut(reply)
        messagesTable.insert({
          threadId,
          role: 'user',
          text: message,
          tool: null,
          toolHops: 0,
          tokensIn: 0,
          tokensOut: 0,
          createdAt: at,
        })
        messagesTable.insert({
          threadId,
          role: 'bot',
          text: reply,
          tool,
          toolHops,
          tokensIn: tIn,
          tokensOut: tOut,
          createdAt: at,
        })
        return {
          kind: 'ok',
          body: {
            thread_id: threadId,
            reply,
            tier,
            turns_remaining: dailyTurns - (used + 1),
            tool_hops: toolHops,
            tokens: { in: tIn, out: tOut },
          },
        }
      })
    },

    // --- RPH (#2–#4) --------------------------------------------------------------------------
    rphList(userId: number, page: number): { rows: Rph[]; total: number } {
      const rows = rphsTable
        .query({ where: { userId } })
        .rows.sort((a, b) =>
          a.lessonDate < b.lessonDate ? 1 : a.lessonDate > b.lessonDate ? -1 : b.id - a.id,
        )
      return pageOf(rows, page)
    },

    rphGet(userId: number, id: number): Rph | undefined {
      const r = rphsTable.get(id)
      return r && r.userId === userId ? r : undefined
    },

    rphCreate(userId: number, input: RphCreateRequest, now: number): RphResult {
      const v = validateRph(input, now)
      if ('fields' in v) return { ok: false, fields: v.fields }
      return { ok: true, rph: transaction(() => saveRph(userId, v.draft, 'form', null, now)) }
    },

    // --- essays (#5, #6) ----------------------------------------------------------------------
    essayList(userId: number, page: number): { rows: EssayMarking[]; total: number } {
      const rows = essaysTable
        .query({ where: { userId } })
        .rows.sort((a, b) => ms(b.createdAt) - ms(a.createdAt) || b.id - a.id)
      return pageOf(rows, page)
    },

    essayGet(userId: number, id: number): EssayMarking | undefined {
      const e = essaysTable.get(id)
      return e && e.userId === userId ? e : undefined
    },

    // --- PBD (#7–#10) -------------------------------------------------------------------------
    pbdQueue(
      userId: number,
      page: number,
    ): { rows: (PbdTag & { studentName: string })[]; total: number } {
      const p = pageOf(pendingSorted(userId), page)
      return {
        total: p.total,
        rows: p.rows.map((t) => ({ ...t, studentName: nameOf(t.studentId) })),
      }
    },

    /** BR-M13-15: scans the M05 answers of the class's active students in the class subject. */
    rollup(userId: number, classroomId: number | null, now: number): RollupResult {
      const result: RollupResult = { created: 0, updated: 0, skipped: 0 }
      if (classroomId === null) return result
      const cls = classrooms.get('classroom', classroomId)
      if (!cls || cls.teacherId !== userId || cls.subjectId === null) return result
      const subjectName = curriculum.subject(cls.subjectId)?.name ?? ''
      const sp = (SP_LABELS as Record<string, string>)[subjectName] ?? SP_LABELS.default
      const at = iso(now)
      transaction(() => {
        for (const studentId of classrooms.memberIds('classroom', classroomId)) {
          const answers = practice.answers(studentId, { subjectId: cls.subjectId as number })
          if (answers.length === 0) continue
          const skor = skorOf(answers.filter((a) => a.isCorrect).length, answers.length)
          const tp = tpOf(skor)
          const tags = pbdTagsTable.query({ where: { userId, classroomId, studentId, sp } }).rows
          const pending = tags.find((t) => t.status === 'pending')
          if (pending) {
            pbdTagsTable.update(pending.id, { skor, tp, createdAt: at })
            result.updated++
          } else if (tags.length > 0) {
            result.skipped++
          } else {
            pbdTagsTable.insert({
              userId,
              classroomId,
              studentId,
              sp,
              skor,
              tp,
              status: 'pending',
              createdAt: at,
              approvedAt: null,
            })
            result.created++
          }
        }
      })
      return result
    },

    /** BR-M13-16: approves the caller's pending tags among `ids`. */
    approve(userId: number, ids: readonly number[], now: number): number {
      return transaction(() => {
        let approved = 0
        for (const id of new Set(ids)) {
          const t = pbdTagsTable.get(id)
          if (t && t.userId === userId && t.status === 'pending') {
            pbdTagsTable.update(id, { status: 'approved', approvedAt: iso(now) })
            approved++
          }
        }
        return approved
      })
    },

    /** BR-M13-17: the CSV text (header line only when nothing is approved). */
    exportCsv(userId: number): string {
      const rows = pbdTagsTable
        .query({ where: { userId, status: 'approved' } })
        .rows.sort(
          (a, b) =>
            ms(a.approvedAt ?? a.createdAt) - ms(b.approvedAt ?? b.createdAt) ||
            collator.compare(nameOf(a.studentId), nameOf(b.studentId)) ||
            a.id - b.id,
        )
      const lines = ['pelajar,kelas,sp,skor,tp,tarikh_lulus']
      for (const t of rows) {
        lines.push(
          [
            nameOf(t.studentId),
            classrooms.get('classroom', t.classroomId)?.name ?? '',
            t.sp,
            t.skor.toFixed(1),
            t.tp,
            formatDateKey(ms(t.approvedAt ?? t.createdAt)),
          ]
            .map(csvCell)
            .join(','),
        )
      }
      return `${lines.join('\n')}\n`
    },

    /** The rubric of a key (BR-M13-08 fallback to the first). */
    rubric: rubricOf,

    /** Day total of the caller's threads (tests). */
    threadsOf: (userId: number) => threadsTable.query({ where: { userId } }).rows,
    messagesOf: (threadId: string) => messagesTable.query({ where: { threadId } }).rows,
  }),
})
