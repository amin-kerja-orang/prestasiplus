import { describe, expect, it } from 'vitest'

import { envelopeOf } from '../../../common/envelope'
import { ErrorBodySchema } from '../../../common/error'
import { buildOpenApiDocument } from '../../../openapi'
import { z } from '../../../zod'
import { BIJAK_ATTEMPTS_COMPONENT_SCHEMAS } from '../paths'
import {
  BIJAK_ATTEMPTS_LIMITS,
  BIJAK_ATTEMPTS_MESSAGES,
  BijakAttemptHistoryRowSchema,
  BijakAttemptInProgressSchema,
  BijakAttemptNotSubmittedErrorSchema,
  BijakAttemptPaperViewSchema,
  BijakAttemptPartAnswerSchema,
  BijakAttemptPhotoSchema,
  BijakAttemptPhotoUploadSchema,
  BijakAttemptQuestionResultSchema,
  BijakAttemptResultViewSchema,
  BijakAttemptSavePayloadSchema,
  BijakAttemptSaveResultSchema,
  BijakAttemptStartRequestSchema,
  BijakAttemptStartResultSchema,
  BijakAttemptSubmitPayloadSchema,
  BijakAttemptSubmitResultSchema,
} from '../schema'

/* Payloads follow the m28 mock (BijakServer attempt methods over the seed registry), with the
 * contract wire conventions applied (ISO +08:00 instants, string ids). Fictitious practice content
 * only. */

const STARTED = '2026-10-19T09:00:00+08:00'
const DEADLINE = '2026-10-19T11:30:00+08:00'
const NOW = '2026-10-19T09:20:00+08:00'

const mcqQuestion = {
  id: 'mat-k1-q1',
  number: 1,
  sectionId: 'mat-k1-obj',
  topic: 'Pecahan',
  formOrigin: 'T1-T3',
  stem: 'Nilai bagi $\\frac{1}{2} + \\frac{1}{4}$ ialah',
  marks: 1,
  mcq: {
    options: [
      { id: 'A', text: '$\\frac{1}{6}$' },
      { id: 'B', text: '$\\frac{3}{4}$' },
      { id: 'C', text: '$\\frac{2}{4}$' },
      { id: 'D', text: '$1$' },
    ],
  },
}
const structuredQuestion = {
  id: 'mat-k2-q4',
  number: 4,
  sectionId: 'mat-k2-b',
  topic: 'Kecerunan',
  formOrigin: 'T4',
  groupId: 'grp-rajah-2',
  stem: 'Rajah 2 menunjukkan garis lurus AB.',
  marks: 5,
  parts: [
    {
      id: 'mat-k2-q4-a',
      label: '(a)',
      prompt: 'Hitung kecerunan garis AB.',
      marks: 2,
      answer: { kind: 'working' },
    },
    {
      id: 'mat-k2-q4-b',
      label: '(b)',
      prompt: 'Seterusnya',
      marks: 0,
      children: [
        {
          id: 'mat-k2-q4-b-i',
          label: '(i)',
          prompt: 'Nyatakan nilai $m$.',
          marks: 1,
          answer: { kind: 'numeric', unit: 'cm' },
        },
        {
          id: 'mat-k2-q4-b-ii',
          label: '(ii)',
          prompt: 'Terangkan jawapan anda.',
          marks: 2,
          answer: { kind: 'essay', wordRange: { min: 10, max: 60 } },
        },
      ],
    },
  ],
}
const stimulusGroup = {
  id: 'grp-rajah-2',
  stimulus: {
    id: 'stim-rajah-2',
    kind: 'diagram',
    label: 'Rajah 2',
    caption: 'Garis lurus AB',
    alt: 'Garis lurus AB pada satah Cartes.',
    svg: '<svg viewBox="0 0 10 10"><line x1="0" y1="10" x2="10" y2="0" stroke="currentColor"/></svg>',
  },
  from: 4,
  to: 4,
  questionIds: ['mat-k2-q4'],
}
const answerA = {
  answer: { steps: ['$m = \\frac{6-2}{4-2}$'], final: '2', plain: { steps: ['m = (6-2)/(4-2)'], final: '2' } },
  rev: 2,
  savedAt: NOW,
}
const attemptExam = {
  id: 'f3b6f0a2-6f1e-4b8e-9d7a-2c5b1e7a9c11',
  paperId: 'mat-k2-2025-a',
  paperKind: 'pilihan',
  title: 'Percubaan SPM Matematik Kertas 2 Set A',
  subject: 'MAT',
  kertas: 2,
  code: '1449/2',
  mode: 'exam',
  status: 'in_progress',
  startedAt: STARTED,
  deadline: DEADLINE,
  durationMin: 150,
  answers: { 'mat-k2-q4-a': answerA },
  flags: ['mat-k2-q4'],
  picks: { 'mat-k2-c': ['mat-k2-q5'] },
  position: 3,
  checked: [],
}
const sections = [
  {
    id: 'mat-k1-obj',
    label: 'Objektif',
    rule: { type: 'all' },
    questionIds: ['mat-k1-q1'],
    marks: 1,
    effectiveMarks: 1,
  },
  {
    id: 'mat-k2-b',
    label: 'Bahagian B',
    compulsory: true,
    instruction: 'Jawab semua soalan.',
    rule: { type: 'choose', n: 1 },
    questionIds: ['mat-k2-q4'],
    marks: 5,
    effectiveMarks: 5,
  },
]
const viewExam = {
  serverNow: NOW,
  attempt: attemptExam,
  sections,
  questions: [mcqQuestion, structuredQuestion],
  groups: [stimulusGroup],
  checks: [],
}

const partResultMcq = {
  partId: 'mat-k1-q1',
  label: '',
  prompt: mcqQuestion.stem,
  marks: 1,
  awarded: 0,
  status: 'salah',
  confidence: 'high',
  points: [],
  answer: { choice: 'C' },
  scheme: {
    marks: 1,
    correctOption: 'B',
    explanation: 'Samakan penyebut: $\\frac{2}{4} + \\frac{1}{4} = \\frac{3}{4}$.',
  },
}
const partResultWorking = {
  partId: 'mat-k2-q4-a',
  label: '(a)',
  prompt: 'Hitung kecerunan garis AB.',
  marks: 2,
  awarded: 2,
  status: 'betul',
  confidence: 'high',
  points: [
    { id: 'p1', code: 'K', tag: 'K1', label: 'Rumus kecerunan', marks: 1, awarded: 1, hit: true, reason: 'Langkah dijumpai.' },
    { id: 'p2', code: 'N', tag: 'N1', label: 'Jawapan akhir', marks: 1, awarded: 1, hit: true, reason: 'Jawapan akhir betul.' },
  ],
  ecf: 'Jawapan (a) dibawa ke (b)',
  answer: answerA.answer,
  scheme: { marks: 2, finalDisplay: '2', model: 'm = (6-2)/(4-2) = 2' },
}
const partResultEssay = {
  partId: 'mat-k2-q4-b-ii',
  label: '(ii)',
  prompt: 'Terangkan jawapan anda.',
  marks: 2,
  awarded: 0,
  status: 'belum_dimarkah',
  confidence: 'low',
  points: [
    { id: 'p3', code: 'B', tag: 'B1', manual: true, label: 'Penjelasan', marks: 2, awarded: 0, hit: false, reason: 'Menunggu semakan guru.' },
  ],
  answer: { text: 'Kecerunan tetap.', photos: [{ key: 'ph-1', name: 'kerja.png', size: 2048 }] },
  scheme: {
    marks: 2,
    rubric: {
      criteria: ['Ketepatan'],
      bands: [{ name: 'Baik', range: [2, 2], descriptor: 'Penjelasan tepat.' }],
      notes: ['Terima jawapan setara.'],
    },
    acceptedText: ['kecerunan tetap'],
  },
}
const questionResult = {
  questionId: 'mat-k2-q4',
  number: 4,
  sectionId: 'mat-k2-b',
  marks: 5,
  awarded: 2,
  counted: true,
  attempted: true,
  parts: [partResultWorking, partResultEssay],
}
const result = {
  score: 2,
  max: 6,
  percent: 33.3,
  provisional: true,
  pendingReview: 1,
  sections: [
    { sectionId: 'mat-k1-obj', label: 'Objektif', marks: 1, awarded: 0, counted: ['mat-k1-q1'] },
    { sectionId: 'mat-k2-b', label: 'Bahagian B', marks: 5, awarded: 2, chooseN: 1, counted: ['mat-k2-q4'] },
  ],
  questions: [
    { questionId: 'mat-k1-q1', number: 1, sectionId: 'mat-k1-obj', marks: 1, awarded: 0, counted: true, attempted: true, parts: [partResultMcq] },
    questionResult,
  ],
  coins: 4,
  points: 20,
}
const attemptSubmitted = {
  ...attemptExam,
  status: 'submitted',
  submittedAt: '2026-10-19T09:40:00+08:00',
  idempotencyKey: 'f3b6f0a2-hantar',
}
const viewResult = { ...viewExam, attempt: attemptSubmitted }
const resultView = { attempt: attemptSubmitted, result, paper: viewResult }

/** Keys that must never appear anywhere in the served paper (BE-16 AC 3, US-15). */
const FORBIDDEN_VIEW_KEYS = [
  'correct',
  'correctOption',
  'correctLetter',
  'accept',
  'accepted',
  'acceptedText',
  'scheme',
  'markScheme',
  'points',
  'explanation',
  'reason',
  'finalDisplay',
  'model',
  'rubric',
  'awarded',
  'hit',
  'tag',
  'confidence',
  'result',
]
function keysOf(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, out))
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      out.add(k)
      keysOf(v, out)
    }
  return out
}

describe('constants of the mock', () => {
  it('keeps the limits and BM messages of BijakServer and photo-store', () => {
    expect(BIJAK_ATTEMPTS_LIMITS).toEqual({
      graceSeconds: 300,
      lateSyncWindowMs: 86_400_000,
      maxChecksPerQuestion: 3,
      freshSeconds: 60,
      maxPhotoBytes: 5_242_880,
      maxPhotosPerPart: 3,
    })
    expect(BIJAK_ATTEMPTS_MESSAGES.attemptNotFound).toBe('Percubaan tidak ditemui')
    expect(BIJAK_ATTEMPTS_MESSAGES.forbidden).toBe('Akses ditolak')
    expect(BIJAK_ATTEMPTS_MESSAGES.schemeAfterSubmit).toBe('Skema hanya didedahkan selepas Hantar')
    expect(BIJAK_ATTEMPTS_MESSAGES.attemptClosed).toBe('Percubaan sudah tamat')
    expect(BIJAK_ATTEMPTS_MESSAGES.questionNotFound).toBe('Soalan tidak ditemui')
    expect(BIJAK_ATTEMPTS_MESSAGES.paperNotFound).toBe('Kertas tidak ditemui')
    expect(BIJAK_ATTEMPTS_MESSAGES.photoType).toBe('Gambar mesti JPG atau PNG, maksimum 5 MB.')
    expect(BIJAK_ATTEMPTS_MESSAGES.photoCount).toBe('Maksimum 3 gambar bagi setiap bahagian.')
  })
})

describe('start and resume (startAttempt, findInProgress)', () => {
  it('parses a start request in both modes with and without restart', () => {
    for (const mode of ['exam', 'latihan'])
      expect(BijakAttemptStartRequestSchema.safeParse({ paperId: 'mat-k2-2025-a', mode }).success).toBe(true)
    expect(
      BijakAttemptStartRequestSchema.safeParse({ paperId: 'mat-k2-2025-a', mode: 'exam', restart: true }).success,
    ).toBe(true)
  })

  it('rejects an unknown mode, a numeric paper id, a missing paper and extra keys', () => {
    expect(BijakAttemptStartRequestSchema.safeParse({ paperId: 'p', mode: 'ujian' }).success).toBe(false)
    expect(BijakAttemptStartRequestSchema.safeParse({ paperId: 12, mode: 'exam' }).success).toBe(false)
    expect(BijakAttemptStartRequestSchema.safeParse({ mode: 'exam' }).success).toBe(false)
    expect(BijakAttemptStartRequestSchema.safeParse({ paperId: 'p', mode: 'exam', deadline: DEADLINE }).success).toBe(false)
  })

  it('parses the start result and rejects a numeric attempt id', () => {
    expect(envelopeOf(BijakAttemptStartResultSchema).safeParse({ data: { attemptId: attemptExam.id } }).success).toBe(true)
    expect(BijakAttemptStartResultSchema.safeParse({ attemptId: 5 }).success).toBe(false)
  })

  it('parses InProgressInfo and data null for no open attempt', () => {
    const Env = envelopeOf(BijakAttemptInProgressSchema.nullable())
    const info = { attemptId: attemptExam.id, title: attemptExam.title, mode: 'exam', elapsedSeconds: 75, fresh: false }
    expect(Env.safeParse({ data: info }).success).toBe(true)
    expect(Env.safeParse({ data: null }).success).toBe(true)
    expect(Env.safeParse({ data: { ...info, elapsedSeconds: -1 } }).success).toBe(false)
    expect(Env.safeParse({ data: { ...info, fresh: 'ya' } }).success).toBe(false)
  })
})

describe('autosave payload (saveAnswers)', () => {
  const change = {
    partId: 'mat-k2-q4-a',
    answer: answerA.answer,
    rev: 3,
    savedAt: '2026-10-19T09:21:00+08:00',
  }

  it('parses a save with changes, flags, picks and position, and a metadata-only save', () => {
    expect(
      BijakAttemptSavePayloadSchema.safeParse({
        changes: [change],
        flags: ['mat-k2-q4'],
        picks: { 'mat-k2-c': ['mat-k2-q5'] },
        position: 2,
      }).success,
    ).toBe(true)
    expect(BijakAttemptSavePayloadSchema.safeParse({ changes: [], position: 0 }).success).toBe(true)
  })

  it('accepts a device time with another offset or Z, but not epoch milliseconds', () => {
    expect(BijakAttemptSavePayloadSchema.safeParse({ changes: [{ ...change, savedAt: '2026-10-19T01:21:00Z' }] }).success).toBe(true)
    expect(BijakAttemptSavePayloadSchema.safeParse({ changes: [{ ...change, savedAt: 1_792_000_000_000 }] }).success).toBe(false)
    expect(BijakAttemptSavePayloadSchema.safeParse({ changes: [{ ...change, savedAt: '19/10/2026' }] }).success).toBe(false)
  })

  it('rejects a negative or fractional revision, a missing part id and a missing changes list', () => {
    expect(BijakAttemptSavePayloadSchema.safeParse({ changes: [{ ...change, rev: -1 }] }).success).toBe(false)
    expect(BijakAttemptSavePayloadSchema.safeParse({ changes: [{ ...change, rev: 1.5 }] }).success).toBe(false)
    expect(BijakAttemptSavePayloadSchema.safeParse({ changes: [{ ...change, partId: '' }] }).success).toBe(false)
    expect(BijakAttemptSavePayloadSchema.safeParse({ flags: [] }).success).toBe(false)
  })

  it('rejects a client-sent verdict or unknown key (the client never sends marks)', () => {
    expect(BijakAttemptSavePayloadSchema.safeParse({ changes: [{ ...change, awarded: 2 }] }).success).toBe(false)
    expect(BijakAttemptSavePayloadSchema.safeParse({ changes: [], deadline: DEADLINE }).success).toBe(false)
    expect(BijakAttemptPartAnswerSchema.safeParse({ final: '2', correct: true }).success).toBe(false)
  })

  it('parses every answer shape: MCQ choice, working, text and photos', () => {
    expect(BijakAttemptPartAnswerSchema.safeParse({ choice: 'B' }).success).toBe(true)
    expect(BijakAttemptPartAnswerSchema.safeParse(answerA.answer).success).toBe(true)
    expect(BijakAttemptPartAnswerSchema.safeParse({ text: 'Kecerunan tetap.', unit: 'cm' }).success).toBe(true)
    expect(
      BijakAttemptPartAnswerSchema.safeParse({ photos: [{ key: 'ph-1', name: 'kerja.png', size: 2048 }] }).success,
    ).toBe(true)
    expect(BijakAttemptPartAnswerSchema.safeParse({ steps: [1, 2] }).success).toBe(false)
    expect(BijakAttemptPartAnswerSchema.safeParse({ photos: [{ key: 'ph-1', name: 'kerja.png' }] }).success).toBe(false)
  })

  it('parses SaveResult with closed and regraded, and rejects false flags and a numeric time', () => {
    const Env = envelopeOf(BijakAttemptSaveResultSchema)
    expect(Env.safeParse({ data: { savedAt: NOW } }).success).toBe(true)
    expect(Env.safeParse({ data: { savedAt: NOW, closed: true } }).success).toBe(true)
    expect(Env.safeParse({ data: { savedAt: NOW, closed: true, regraded: true } }).success).toBe(true)
    expect(Env.safeParse({ data: { savedAt: NOW, closed: false } }).success).toBe(false)
    expect(Env.safeParse({ data: { savedAt: 1_792_000_000_000 } }).success).toBe(false)
    expect(Env.safeParse({ data: { savedAt: NOW, scheme: {} } }).success).toBe(false)
  })
})

describe('submit (submit)', () => {
  const change = { partId: 'mat-k2-q4-a', answer: answerA.answer, rev: 3, savedAt: NOW }

  it('parses a submit with the device answer set and the auto flag', () => {
    const body = {
      idempotencyKey: 'f3b6f0a2-hantar',
      changes: [change],
      answers: { 'mat-k2-q4-a': { answer: answerA.answer, rev: 3, savedAt: NOW } },
      auto: true,
      flags: [],
      position: 4,
    }
    expect(BijakAttemptSubmitPayloadSchema.safeParse(body).success).toBe(true)
    expect(BijakAttemptSubmitPayloadSchema.safeParse({ idempotencyKey: 'k', changes: [] }).success).toBe(true)
  })

  it('requires a non-empty idempotency key and a changes list', () => {
    expect(BijakAttemptSubmitPayloadSchema.safeParse({ changes: [] }).success).toBe(false)
    expect(BijakAttemptSubmitPayloadSchema.safeParse({ idempotencyKey: '', changes: [] }).success).toBe(false)
    expect(BijakAttemptSubmitPayloadSchema.safeParse({ idempotencyKey: 'k' }).success).toBe(false)
    expect(BijakAttemptSubmitPayloadSchema.safeParse({ idempotencyKey: 'k', changes: [], answers: { p: { rev: 1 } } }).success).toBe(false)
  })

  it('parses SubmitResult: on time, late, replay (closed) and regraded', () => {
    const Env = envelopeOf(BijakAttemptSubmitResultSchema)
    expect(Env.safeParse({ data: { attemptId: attemptExam.id, late: 0 } }).success).toBe(true)
    expect(Env.safeParse({ data: { attemptId: attemptExam.id, late: 300 } }).success).toBe(true)
    expect(Env.safeParse({ data: { attemptId: attemptExam.id, late: 0, closed: true, regraded: true } }).success).toBe(true)
    expect(Env.safeParse({ data: { attemptId: attemptExam.id, late: -1 } }).success).toBe(false)
    expect(Env.safeParse({ data: { late: 0 } }).success).toBe(false)
    expect(Env.safeParse({ data: { attemptId: attemptExam.id, late: 0, result: result } }).success).toBe(false)
  })
})

describe('the served paper (getAttemptView)', () => {
  const Env = envelopeOf(BijakAttemptPaperViewSchema)

  it('parses an in-progress exam view with MCQ, nested parts and a stimulus group', () => {
    expect(Env.safeParse({ data: viewExam }).success).toBe(true)
  })

  it('parses a latihan view: no deadline, check counts and a revealed check', () => {
    const view = {
      ...viewExam,
      attempt: {
        ...attemptExam,
        mode: 'latihan',
        deadline: null,
        checked: ['mat-k2-q4'],
        checkCounts: { 'mat-k2-q4': 1 },
      },
      checks: [questionResult],
    }
    expect(Env.safeParse({ data: view }).success).toBe(true)
  })

  it('requires serverNow and +08:00 instants (never epoch milliseconds)', () => {
    const { serverNow: _s, ...noNow } = viewExam
    void _s
    expect(Env.safeParse({ data: noNow }).success).toBe(false)
    expect(Env.safeParse({ data: { ...viewExam, serverNow: 1_792_000_000_000 } }).success).toBe(false)
    expect(Env.safeParse({ data: { ...viewExam, serverNow: '2026-10-19T01:20:00Z' } }).success).toBe(false)
    expect(Env.safeParse({ data: { ...viewExam, attempt: { ...attemptExam, deadline: 1_792_000_000_000 } } }).success).toBe(false)
    expect(Env.safeParse({ data: { ...viewExam, attempt: { ...attemptExam, startedAt: '2026-10-19' } } }).success).toBe(false)
  })

  it('does not carry the numeric userId, the section snapshot or a result inside the attempt', () => {
    expect(Env.safeParse({ data: { ...viewExam, attempt: { ...attemptExam, userId: 7 } } }).success).toBe(false)
    expect(Env.safeParse({ data: { ...viewExam, attempt: { ...attemptExam, sections: [] } } }).success).toBe(false)
    expect(Env.safeParse({ data: { ...viewExam, attempt: { ...attemptExam, result } } }).success).toBe(false)
  })

  it('rejects an unknown status, mode, kind or rule type', () => {
    const bad = (patch: Record<string, unknown>) =>
      Env.safeParse({ data: { ...viewExam, attempt: { ...attemptExam, ...patch } } }).success
    expect(bad({ status: 'graded' })).toBe(false)
    expect(bad({ mode: 'ujian' })).toBe(false)
    expect(bad({ paperKind: 'rasmi' })).toBe(false)
    expect(
      Env.safeParse({ data: { ...viewExam, sections: [{ ...sections[0], rule: { type: 'choose' } }] } }).success,
    ).toBe(false)
  })

  it('rejects any answer key or scheme riding on a question, option, part or section', () => {
    const q = (patch: Record<string, unknown>) =>
      Env.safeParse({ data: { ...viewExam, questions: [{ ...mcqQuestion, ...patch }, structuredQuestion] } }).success
    expect(q({ correctOption: 'B' })).toBe(false)
    expect(q({ scheme: { kind: 'option', correct: 'B' } })).toBe(false)
    expect(q({ explanation: 'Samakan penyebut.' })).toBe(false)
    expect(q({ mcq: { options: mcqQuestion.mcq.options.map((o) => ({ ...o, correct: o.id === 'B' })) } })).toBe(false)
    expect(q({ mcq: { options: mcqQuestion.mcq.options, correct: 'B' } })).toBe(false)
    const withPart = (part: Record<string, unknown>) =>
      Env.safeParse({
        data: { ...viewExam, questions: [mcqQuestion, { ...structuredQuestion, parts: [part] }] },
      }).success
    expect(withPart({ ...structuredQuestion.parts[0], scheme: { marks: 2 } })).toBe(false)
    expect(withPart({ ...structuredQuestion.parts[0], answer: { kind: 'working', accept: ['2'] } })).toBe(false)
    // the leak is caught at any depth of the recursive part tree
    const deep = structuredQuestion.parts[1]!
    expect(
      withPart({
        ...deep,
        children: [{ ...deep.children![0], children: [{ ...deep.children![1], model: 'm = 2' }] }],
      }),
    ).toBe(false)
    expect(withPart({ ...deep, children: [{ ...deep.children![0], finalDisplay: '2' }] })).toBe(false)
    expect(
      Env.safeParse({ data: { ...viewExam, sections: [{ ...sections[0], answers: { 'mat-k1-q1': 'B' } }] } }).success,
    ).toBe(false)
    expect(
      Env.safeParse({
        data: { ...viewExam, groups: [{ ...stimulusGroup, stimulus: { ...stimulusGroup.stimulus, model: 'x' } }] },
      }).success,
    ).toBe(false)
  })

  it('carries no forbidden key anywhere in a served exam or latihan view (recursive key scan)', () => {
    const latihan = {
      ...viewExam,
      attempt: { ...attemptExam, mode: 'latihan', deadline: null },
      checks: [],
    }
    const keys = keysOf([{ data: viewExam }, { data: latihan }])
    for (const bad of FORBIDDEN_VIEW_KEYS) expect(keys.has(bad), bad).toBe(false)
    expect(keys.has('serverNow')).toBe(true)
  })

  it('shows a scheme only inside checks (latihan, per question) or in the result view', () => {
    const withCheck = { ...viewExam, checks: [questionResult] }
    const checkKeys = keysOf(withCheck.checks)
    expect(checkKeys.has('scheme')).toBe(true)
    const keysWithoutChecks = keysOf({ ...withCheck, checks: [] })
    expect(keysWithoutChecks.has('scheme')).toBe(false)
  })
})

describe('marking and results (checkQuestion, getResult)', () => {
  it('parses a checked question with points, ECF, rubric and the revealed scheme', () => {
    expect(envelopeOf(BijakAttemptQuestionResultSchema).safeParse({ data: questionResult }).success).toBe(true)
    expect(
      envelopeOf(BijakAttemptQuestionResultSchema).safeParse({
        data: { questionId: 'mat-k1-q1', number: 1, sectionId: 'mat-k1-obj', marks: 1, awarded: 0, counted: true, attempted: true, parts: [partResultMcq] },
      }).success,
    ).toBe(true)
  })

  it('accepts all five part statuses and rejects another', () => {
    for (const status of ['betul', 'separa', 'salah', 'kosong', 'belum_dimarkah'])
      expect(
        BijakAttemptQuestionResultSchema.safeParse({ ...questionResult, parts: [{ ...partResultWorking, status }] }).success,
      ).toBe(true)
    expect(
      BijakAttemptQuestionResultSchema.safeParse({ ...questionResult, parts: [{ ...partResultWorking, status: 'lulus' }] }).success,
    ).toBe(false)
    expect(
      BijakAttemptQuestionResultSchema.safeParse({ ...questionResult, parts: [{ ...partResultWorking, confidence: 'medium' }] }).success,
    ).toBe(false)
  })

  it('accepts the mark-point letters of the mock and rejects another', () => {
    for (const code of ['K', 'N', 'P', 'B', 'M', 'F', 'C'])
      expect(
        BijakAttemptQuestionResultSchema.safeParse({
          ...questionResult,
          parts: [{ ...partResultWorking, points: [{ ...partResultWorking.points[0], code }] }],
        }).success,
      ).toBe(true)
    expect(
      BijakAttemptQuestionResultSchema.safeParse({
        ...questionResult,
        parts: [{ ...partResultWorking, points: [{ ...partResultWorking.points[0], code: 'X' }] }],
      }).success,
    ).toBe(false)
  })

  it('rejects an unknown key inside a scheme', () => {
    expect(
      BijakAttemptQuestionResultSchema.safeParse({
        ...questionResult,
        parts: [{ ...partResultWorking, scheme: { ...partResultWorking.scheme, hidden: true } }],
      }).success,
    ).toBe(false)
  })

  it('parses the result view: attempt, stored result and the paper with empty checks', () => {
    const Env = envelopeOf(BijakAttemptResultViewSchema)
    expect(Env.safeParse({ data: resultView }).success).toBe(true)
    expect(Env.safeParse({ data: { ...resultView, result: { ...result, percent: 'x' } } }).success).toBe(false)
    expect(Env.safeParse({ data: { ...resultView, result: { ...result, sections: undefined } } }).success).toBe(false)
    expect(Env.safeParse({ data: { attempt: attemptSubmitted, result } }).success).toBe(false)
  })

  it('keeps late sync and sweep fields: lateBySeconds and auto_submitted', () => {
    const attempt = { ...attemptSubmitted, status: 'auto_submitted', lateBySeconds: 300 }
    expect(
      envelopeOf(BijakAttemptResultViewSchema).safeParse({ data: { ...resultView, attempt, paper: { ...viewResult, attempt } } }).success,
    ).toBe(true)
  })

  it('has the NOT_SUBMITTED error body of the result route and the generic bodies of the mock errors', () => {
    expect(
      BijakAttemptNotSubmittedErrorSchema.safeParse({
        error: { code: 'NOT_SUBMITTED', message: 'Skema hanya didedahkan selepas Hantar' },
      }).success,
    ).toBe(true)
    expect(
      BijakAttemptNotSubmittedErrorSchema.safeParse({ error: { code: 'CONFLICT', message: 'Skema hanya didedahkan selepas Hantar' } }).success,
    ).toBe(false)
    for (const [code, message] of [
      ['NOT_FOUND', BIJAK_ATTEMPTS_MESSAGES.attemptNotFound],
      ['NOT_FOUND', BIJAK_ATTEMPTS_MESSAGES.questionNotFound],
      ['FORBIDDEN', BIJAK_ATTEMPTS_MESSAGES.forbidden],
      ['FORBIDDEN', BIJAK_ATTEMPTS_MESSAGES.schemeAfterSubmit],
      ['CONFLICT', BIJAK_ATTEMPTS_MESSAGES.attemptClosed],
    ])
      expect(ErrorBodySchema.safeParse({ error: { code, message } }).success).toBe(true)
  })
})

describe('history (history)', () => {
  const rows = [
    {
      attemptId: attemptExam.id,
      title: attemptExam.title,
      subject: 'MAT',
      subjectName: 'Matematik',
      kertas: 2,
      kind: 'pilihan',
      mode: 'exam',
      status: 'submitted',
      startedAt: STARTED,
      durationSeconds: 2400,
      score: 18,
      max: 21,
    },
    {
      attemptId: 'a2',
      title: 'Kertas Jana Sains Kertas 2 (#1)',
      subject: 'SN',
      subjectName: 'Sains',
      kertas: 2,
      kind: 'jana',
      mode: 'latihan',
      status: 'in_progress',
      startedAt: NOW,
      durationSeconds: 0,
    },
    {
      attemptId: 'a3',
      title: 'Percubaan SPM Sejarah Kertas 2 (Contoh Pendek)',
      subject: 'SEJ',
      subjectName: 'Sejarah',
      kertas: 2,
      kind: 'pilihan',
      mode: 'exam',
      status: 'abandoned',
      startedAt: STARTED,
      durationSeconds: 12,
    },
  ]
  const Env = envelopeOf(z.array(BijakAttemptHistoryRowSchema))

  it('parses submitted, in-progress and abandoned rows, and an empty list', () => {
    expect(Env.safeParse({ data: rows }).success).toBe(true)
    expect(Env.safeParse({ data: [] }).success).toBe(true)
  })

  it('rejects an epoch start, a negative duration, a bad status and a leaked result', () => {
    expect(Env.safeParse({ data: [{ ...rows[0], startedAt: 1_792_000_000_000 }] }).success).toBe(false)
    expect(Env.safeParse({ data: [{ ...rows[0], durationSeconds: -3 }] }).success).toBe(false)
    expect(Env.safeParse({ data: [{ ...rows[0], status: 'graded' }] }).success).toBe(false)
    expect(Env.safeParse({ data: [{ ...rows[0], result }] }).success).toBe(false)
  })
})

describe('working photo upload', () => {
  const png = (bytes = 10) => new Blob([new Uint8Array(bytes)], { type: 'image/png' })

  it('accepts JPEG and PNG up to 5 MB with a part id', () => {
    expect(BijakAttemptPhotoUploadSchema.safeParse({ partId: 'mat-k2-q4-a', file: png() }).success).toBe(true)
    expect(
      BijakAttemptPhotoUploadSchema.safeParse({
        partId: 'mat-k2-q4-a',
        file: new Blob([new Uint8Array(5 * 1024 * 1024)], { type: 'image/jpeg' }),
      }).success,
    ).toBe(true)
  })

  it('rejects other types, files over 5 MB, a missing file and a missing part id', () => {
    expect(
      BijakAttemptPhotoUploadSchema.safeParse({ partId: 'p', file: new Blob(['x'], { type: 'image/gif' }) }).success,
    ).toBe(false)
    expect(
      BijakAttemptPhotoUploadSchema.safeParse({ partId: 'p', file: new Blob(['x'], { type: 'application/pdf' }) }).success,
    ).toBe(false)
    expect(
      BijakAttemptPhotoUploadSchema.safeParse({
        partId: 'p',
        file: new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' }),
      }).success,
    ).toBe(false)
    expect(BijakAttemptPhotoUploadSchema.safeParse({ partId: 'p' }).success).toBe(false)
    expect(BijakAttemptPhotoUploadSchema.safeParse({ file: png() }).success).toBe(false)
  })

  it('parses the 201 photo metadata and rejects a photo over 5 MB', () => {
    const Env = envelopeOf(BijakAttemptPhotoSchema)
    expect(Env.safeParse({ data: { key: 'ph-1', name: 'kerja.png', size: 2048 } }).success).toBe(true)
    expect(Env.safeParse({ data: { key: 'ph-1', name: 'kerja.png', size: 5 * 1024 * 1024 + 1 } }).success).toBe(false)
    expect(Env.safeParse({ data: { key: 'ph-1', name: 'kerja.png', size: 2048, url: 'https://x' } }).success).toBe(false)
  })
})

/* ------------------------------------------------------------------------------------ OpenAPI */

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const doc = buildOpenApiDocument() as Json
const paths = doc.paths as Record<string, Record<string, Json>>
const schemas = doc.components.schemas as Record<string, Json>
const ops = Object.entries(paths).flatMap(([path, item]) =>
  Object.entries(item)
    .filter(([, op]) => (op.tags as string[] | undefined)?.includes('bijak-attempts'))
    .map(([method, op]) => ({ method, path, op })),
)
const MUTATIONS = ops.filter((o) => o.method !== 'get')

describe('OpenAPI document', () => {
  it('registers exactly the ten attempt routes of the card', () => {
    const got = ops.map((o) => `${o.method.toUpperCase()} ${o.path}`).sort()
    expect(got).toEqual(
      [
        'GET /bijak/papers/{paperId}/in-progress',
        'POST /bijak/attempts',
        'GET /bijak/attempts/{id}',
        'PUT /bijak/attempts/{id}/answers',
        'POST /bijak/attempts/{id}/submit',
        'POST /bijak/attempts/{id}/abandon',
        'POST /bijak/attempts/{id}/questions/{questionId}/check',
        'GET /bijak/attempts/{id}/result',
        'GET /bijak/history',
        'POST /bijak/attempts/{id}/photos',
      ].sort(),
    )
    expect(ops).toHaveLength(10)
  })

  it('has no clash with the papers routes of BE-15', () => {
    for (const p of ['/bijak/papers', '/bijak/papers/{id}', '/bijak/contracts', '/bijak/subjects', '/bijak/papers/generate'])
      expect(paths[p]).toBeDefined()
    expect(ops.some((o) => o.path === '/bijak/papers/generate')).toBe(false)
  })

  it('registers every component of this card, all prefixed BijakAttempt', () => {
    const ids = Object.keys(BIJAK_ATTEMPTS_COMPONENT_SCHEMAS)
    expect(ids.length).toBeGreaterThan(30)
    for (const id of ids) {
      expect(id.startsWith('BijakAttempt'), id).toBe(true)
      expect(schemas[id], id).toBeDefined()
    }
    for (const bare of ['Attempt', 'Answer', 'Result', 'AttemptResult', 'PhotoMeta', 'HistoryRow'])
      expect(schemas[bare], bare).toBeUndefined()
  })

  it('requires X-CSRF-Token and describes CSRF_INVALID on every mutation, and on no read', () => {
    expect(MUTATIONS).toHaveLength(6)
    for (const { method, path, op } of MUTATIONS) {
      const headers = (op.parameters as Json[]).filter((p) => p.in === 'header').map((p) => p.name)
      expect(headers, `${method} ${path}`).toContain('X-CSRF-Token')
      expect(op.responses['403'].description, `${method} ${path}`).toContain('CSRF_INVALID')
    }
    for (const { method, path, op } of ops.filter((o) => o.method === 'get')) {
      const headers = ((op.parameters ?? []) as Json[]).filter((p) => p.in === 'header')
      expect(headers, `${method} ${path}`).toHaveLength(0)
      expect(op.responses['403'].description, `${method} ${path}`).not.toContain('CSRF_INVALID')
    }
  })

  it('answers 401 and 403 on every route', () => {
    for (const { method, path, op } of ops) {
      expect(op.responses['401'], `${method} ${path}`).toBeDefined()
      expect(op.responses['403'], `${method} ${path}`).toBeDefined()
    }
  })

  it('documents 429 RATE_LIMITED with retryAfter and a Retry-After header on every write route (D57a)', () => {
    expect(MUTATIONS).toHaveLength(6)
    for (const { method, path, op } of MUTATIONS) {
      const r = op.responses['429']
      expect(r, `${method} ${path}`).toBeDefined()
      expect(r.description, `${method} ${path}`).toContain('RATE_LIMITED')
      expect(r.description, `${method} ${path}`).toContain('retryAfter')
      expect(r.headers['Retry-After'], `${method} ${path}`).toBeDefined()
      expect(r.headers['Retry-After'].schema.type).toBe('integer')
      expect(r.content['application/json'].schema.$ref).toBe('#/components/schemas/ErrorBody')
    }
    // the generic error payload carries retryAfter
    expect(schemas.ErrorPayload!.properties.retryAfter).toBeDefined()
  })

  it('sends no credential or token on any route of the card, so none needs Cache-Control: no-store (D57b)', () => {
    for (const { method, path, op } of ops)
      for (const [status, r] of Object.entries(op.responses as Record<string, Json>))
        expect(Object.keys(r.headers ?? {}), `${method} ${path} ${status}`).not.toContain('Cache-Control')
  })

  it('answers 403 "Akses ditolak" for another student attempt (D54b) and 404 for an unknown one', () => {
    const owned = ops.filter((o) => o.path.includes('{id}'))
    expect(owned).toHaveLength(7)
    for (const { method, path, op } of owned) {
      expect(op.responses['403'].description, `${method} ${path}`).toContain('Akses ditolak')
      expect(op.responses['403'].description, `${method} ${path}`).toContain('D54b')
      expect(op.responses['404'].description, `${method} ${path}`).toContain('Percubaan tidak ditemui')
    }
  })

  it('has the status codes and messages of the mock error mapping', () => {
    const find = (m: string, p: string) => ops.find((o) => o.method === m && o.path === p)!.op
    const check = find('post', '/bijak/attempts/{id}/questions/{questionId}/check')
    expect(check.responses['403'].description).toContain('Skema hanya didedahkan selepas Hantar')
    expect(check.responses['409'].description).toContain('Percubaan sudah tamat')
    expect(check.responses['404'].description).toContain('Soalan tidak ditemui')
    expect(check.description).toContain('MAX_CHECKS_PER_QUESTION')
    const result = find('get', '/bijak/attempts/{id}/result')
    expect(result.responses['409'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/BijakAttemptNotSubmittedError',
    )
    expect(find('post', '/bijak/attempts').responses['404'].description).toContain('Kertas tidak ditemui')
    const photo = find('post', '/bijak/attempts/{id}/photos')
    expect(photo.responses['422'].description).toContain('Gambar mesti JPG atau PNG, maksimum 5 MB.')
    expect(photo.responses['422'].description).toContain('Maksimum 3 gambar bagi setiap bahagian.')
  })

  it('returns 200 for a resumed attempt and 201 for a new one; abandon is 204 without a body', () => {
    const start = ops.find((o) => o.method === 'post' && o.path === '/bijak/attempts')!.op
    expect(start.responses['200']).toBeDefined()
    expect(start.responses['201']).toBeDefined()
    const abandon = ops.find((o) => o.path.endsWith('/abandon'))!.op
    expect(abandon.responses['204'].content).toBeUndefined()
  })

  it('sends the photo as multipart/form-data with a binary file part', () => {
    const photo = ops.find((o) => o.path.endsWith('/photos'))!.op
    const content = photo.requestBody.content
    expect(Object.keys(content)).toEqual(['multipart/form-data'])
    const upload = schemas.BijakAttemptPhotoUpload!
    expect(upload.properties.file.format).toBe('binary')
    expect(upload.required).toEqual(['partId', 'file'])
    expect(photo.responses['201']).toBeDefined()
  })

  it('wires the view, result view, save and submit results to their components', () => {
    const ref = (op: Json, status: string) =>
      op.responses[status].content['application/json'].schema.properties.data
    const byPath = (m: string, p: string) => ops.find((o) => o.method === m && o.path === p)!.op
    expect(ref(byPath('get', '/bijak/attempts/{id}'), '200').$ref).toBe('#/components/schemas/BijakAttemptPaperView')
    expect(ref(byPath('get', '/bijak/attempts/{id}/result'), '200').$ref).toBe('#/components/schemas/BijakAttemptResultView')
    expect(ref(byPath('put', '/bijak/attempts/{id}/answers'), '200').$ref).toBe('#/components/schemas/BijakAttemptSaveResult')
    expect(ref(byPath('post', '/bijak/attempts/{id}/submit'), '200').$ref).toBe('#/components/schemas/BijakAttemptSubmitResult')
    expect(ref(byPath('post', '/bijak/attempts/{id}/questions/{questionId}/check'), '200').$ref).toBe(
      '#/components/schemas/BijakAttemptQuestionResult',
    )
    expect(ref(byPath('get', '/bijak/history'), '200').items.$ref).toBe('#/components/schemas/BijakAttemptHistoryRow')
  })

  it('makes the body of the check route optional (it carries an autosave payload)', () => {
    const check = ops.find((o) => o.path.endsWith('/check'))!.op
    expect(check.requestBody.required).not.toBe(true)
    expect(check.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/BijakAttemptSavePayload',
    )
  })

  it('has no answer key or scheme property reachable from the attempt view except through checks (schema scan)', () => {
    const seen = new Set<string>()
    const names = new Set<string>()
    const walk = (node: unknown, skipChecks: boolean): void => {
      if (Array.isArray(node)) return node.forEach((n) => walk(n, skipChecks))
      if (!node || typeof node !== 'object') return
      const obj = node as Json
      if (typeof obj.$ref === 'string') {
        const id = obj.$ref.replace('#/components/schemas/', '')
        if (seen.has(id)) return
        seen.add(id)
        return walk(schemas[id], skipChecks)
      }
      if (obj.properties)
        for (const [k, v] of Object.entries(obj.properties as Json)) {
          if (skipChecks && k === 'checks') continue
          names.add(k)
          walk(v, skipChecks)
        }
      for (const [k, v] of Object.entries(obj)) if (k !== 'properties') walk(v, skipChecks)
    }
    walk(schemas.BijakAttemptPaperView, true)
    for (const bad of FORBIDDEN_VIEW_KEYS) expect(names.has(bad), bad).toBe(false)
    expect(names.has('serverNow')).toBe(true)
    // the scheme exists in the result schema, proving the scan can see it
    seen.clear()
    names.clear()
    walk(schemas.BijakAttemptResultView, false)
    expect(names.has('scheme')).toBe(true)
    expect(names.has('correctOption')).toBe(true)
  })
})
