/**
 * M13 designed seeds (SRS M13 v1.1 §6.8.3; ids 13101–13599). Nothing is generated: no live total was
 * observable (admin mirror: every list empty, §6.8.2), so the stores hold only the designed rows of
 * teacher 5 (`guru@demo.test`, SMK DEMO 900001). Scores of the PBD tags are the literal values the
 * M08 designed Kimia / Sejarah answers give (§6.8.3); a rollup recomputes them from the M05 answers.
 */

import { buildHandoffMessage, rubricOf } from '../../api/settings'
import type { EssayMarking, Rph } from '../../api/types'
import {
  cannedMarks,
  GENERAL_REPLY,
  markingReply,
  PRACTICE_REPLY,
  rphConfirmation,
  rphContent,
  tokensIn,
  tokensOut,
} from '../repository/canned'
import { cikguRepo } from '../repository/cikgu'
import type { ChatMessage, ChatThread, PbdTag } from '../repository/types'

export const TEACHER = 5

/** Neutral dummy essay text of exactly `length` characters (SEC-M13-03, NFR-M13-02). */
export function dummyEssay(length: number): string {
  const base = 'Karangan contoh ini ditulis sebagai teks neutral untuk tujuan paparan sahaja. '
  let s = base.repeat(Math.ceil(length / base.length)).slice(0, length)
  if (s.endsWith(' ')) s = `${s.slice(0, -1)}.`
  return s
}

const T = (day: string, time: string): string => `2026-${day}T${time}+08:00`

const rubric1 = rubricOf('spm_bm_karangan')
const rubric2 = rubricOf('sejarah_essay')
const essay1 = dummyEssay(312)
const essay2 = dummyEssay(268)
const marking1 = markingReply(rubric1, cannedMarks(rubric1.max))
const marking2 = markingReply(rubric2, cannedMarks(rubric2.max))
const handoff1 = buildHandoffMessage({
  rubric: rubric1.key,
  subject: 'Bahasa Melayu',
  level: 'T5',
  student: 'Murid Demo 01',
  title: 'Kepentingan Membaca',
  essay: essay1,
})
const handoff2 = buildHandoffMessage({
  rubric: rubric2.key,
  subject: 'Sejarah',
  level: 'T5',
  student: 'Murid Demo 02',
  title: 'Semangat Patriotisme',
  essay: essay2,
})
const RPH_CHAT_REQUEST = 'Tolong jana RPH untuk Sejarah T5 Ulang Kaji Bab 1 esok'
const GENERAL_QUESTION = 'Terangkan konsep mol dalam Kimia'
const PRACTICE_REQUEST = 'Minta latihan soalan konsep mol'

const rph1Base = {
  subjectName: 'Kimia',
  level: 'T5',
  tajuk: 'Elektrolisis Larutan Akueus',
  className: '5 MARIKH - Kimia',
  durationMinutes: 60,
  timeSlot: '8.00-9.00 pagi',
  tema: null,
  pengajaranKeperluan: null,
} as const
const rph2Base = {
  subjectName: 'Sejarah',
  level: 'T5',
  tajuk: 'Ulang Kaji Bab 1',
  className: null,
  durationMinutes: 60,
  timeSlot: null,
  tema: null,
  pengajaranKeperluan: null,
} as const

export const SEED_RPHS: Rph[] = [
  {
    id: 13101,
    userId: TEACHER,
    ...rph1Base,
    lessonDate: '2026-09-28',
    status: 'generated',
    source: 'form',
    content: rphContent({ ...rph1Base, dateLabel: '28/09/2026' }),
    threadId: null,
    createdAt: T('09-24', '21:10:00'),
  },
  {
    id: 13102,
    userId: TEACHER,
    ...rph2Base,
    lessonDate: '2026-09-25',
    status: 'generated',
    source: 'chat',
    content: rphContent({ ...rph2Base, dateLabel: '25/09/2026' }),
    threadId: 'thr-13401',
    createdAt: T('09-24', '20:30:00'),
  },
]

export const SEED_ESSAYS: EssayMarking[] = [
  {
    id: 13201,
    userId: TEACHER,
    rubricKey: rubric1.key,
    subjectName: 'Bahasa Melayu',
    level: 'T5',
    studentName: 'Murid Demo 01',
    essayTitle: 'Kepentingan Membaca',
    essayText: essay1,
    marks: 35,
    maxMarks: 50,
    comment: marking1,
    threadId: 'thr-13401',
    createdAt: T('09-23', '21:00:00'),
  },
  {
    id: 13202,
    userId: TEACHER,
    rubricKey: rubric2.key,
    subjectName: 'Sejarah',
    level: 'T5',
    studentName: 'Murid Demo 02',
    essayTitle: 'Semangat Patriotisme',
    essayText: essay2,
    marks: 14,
    maxMarks: 20,
    comment: marking2,
    threadId: 'thr-13401',
    createdAt: T('09-24', '21:00:00'),
  },
]

const tag = (
  id: number,
  classroomId: number,
  studentId: number,
  sp: string,
  skor: number,
  tp: number,
  createdAt: string,
  approvedAt: string | null = null,
): PbdTag => ({
  id,
  userId: TEACHER,
  classroomId,
  studentId,
  sp,
  skor,
  tp,
  status: approvedAt === null ? 'pending' : 'approved',
  createdAt,
  approvedAt,
})

const KIMIA_AT = T('09-24', '21:30:00')
export const SEED_PBD: PbdTag[] = [
  tag(13301, 2001, 3001, '5.1.1', 88.9, 5, KIMIA_AT),
  tag(13302, 2001, 3002, '5.1.1', 50.0, 3, KIMIA_AT),
  tag(13303, 2001, 3003, '5.1.1', 37.5, 2, KIMIA_AT),
  tag(13304, 2001, 3004, '5.1.1', 37.5, 2, KIMIA_AT),
  tag(13305, 2001, 3005, '5.1.1', 37.5, 2, KIMIA_AT),
  tag(13306, 2001, 3006, '5.1.1', 37.5, 2, KIMIA_AT),
  tag(13307, 2001, 3007, '5.1.1', 33.3, 2, KIMIA_AT),
  tag(13308, 2001, 3008, '5.1.1', 12.5, 1, KIMIA_AT),
  tag(13309, 2002, 3001, '1.1.1', 80.0, 5, T('09-24', '21:35:00'), T('09-24', '21:40:00')),
  tag(13310, 2002, 3002, '1.1.1', 60.0, 4, T('09-24', '21:35:00'), T('09-24', '21:40:00')),
  tag(13311, 2002, 3003, '1.1.1', 40.0, 3, T('09-24', '21:35:00')),
]

const user = (id: number, threadId: string, text: string, at: string): ChatMessage => ({
  id,
  threadId,
  role: 'user',
  text,
  tool: null,
  toolHops: 0,
  tokensIn: 0,
  tokensOut: 0,
  createdAt: at,
})
const bot = (
  id: number,
  threadId: string,
  userText: string,
  text: string,
  tool: ChatMessage['tool'],
  at: string,
): ChatMessage => ({
  id,
  threadId,
  role: 'bot',
  text,
  tool,
  toolHops: tool === null ? 0 : 1,
  tokensIn: tokensIn(userText.trim()),
  tokensOut: tokensOut(text),
  createdAt: at,
})

const RPH_CONFIRM = rphConfirmation('Ulang Kaji Bab 1', 'Sejarah', 'T5', '25/09/2026')

export const SEED_MESSAGES: ChatMessage[] = [
  user(13501, 'thr-13401', handoff1, T('09-23', '21:00:00')),
  bot(13502, 'thr-13401', handoff1, marking1, 'mark_essay', T('09-23', '21:00:05')),
  user(13503, 'thr-13401', RPH_CHAT_REQUEST, T('09-24', '20:30:00')),
  bot(13504, 'thr-13401', RPH_CHAT_REQUEST, RPH_CONFIRM, 'rph', T('09-24', '20:30:05')),
  user(13509, 'thr-13401', handoff2, T('09-24', '21:00:00')),
  bot(13510, 'thr-13401', handoff2, marking2, 'mark_essay', T('09-24', '21:00:05')),
  user(13505, 'thr-13402', GENERAL_QUESTION, T('09-25', '09:10:00')),
  bot(13506, 'thr-13402', GENERAL_QUESTION, GENERAL_REPLY, null, T('09-25', '09:10:05')),
  user(13507, 'thr-13402', PRACTICE_REQUEST, T('09-25', '09:12:00')),
  bot(13508, 'thr-13402', PRACTICE_REQUEST, PRACTICE_REPLY, 'practice', T('09-25', '09:12:05')),
]

export const SEED_THREADS: ChatThread[] = [
  {
    id: 'thr-13401',
    userId: TEACHER,
    createdAt: T('09-23', '21:00:00'),
    updatedAt: T('09-24', '21:00:05'),
  },
  {
    id: 'thr-13402',
    userId: TEACHER,
    createdAt: T('09-25', '09:10:00'),
    updatedAt: T('09-25', '09:12:05'),
  },
]

export function seedCikgu(): void {
  cikguRepo.seed({
    threads: SEED_THREADS,
    messages: SEED_MESSAGES,
    rphs: SEED_RPHS,
    essays: SEED_ESSAYS,
    pbdTags: SEED_PBD,
  })
}
