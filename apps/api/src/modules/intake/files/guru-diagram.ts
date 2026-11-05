import { z } from 'zod'

/**
 * S6-T18 part 2 (API-Q-21, DOC DEFECT 1 ruling): a teacher's diagram image for a question that needs one is an intake item of a
 * `source = 'guru'` batch with `payload.target`; the question is not touched. Pure helpers: the target, the payload and the open-item
 * lookups. The admin accept (`IntakeReviewService`) sets `stimuli.asset_file_id` on the EXISTING group stimulus.
 */

/** `payload.target`: which question and stimulus group the image is for, and the owned `question_image` file (internal id). */
export const DiagramTargetSchema = z.strictObject({
  kind: z.enum(['mcq', 'structured']),
  questionId: z.string().min(1).max(32),
  groupId: z.string().min(1).max(32),
  /** The bank stimulus of the group that receives the image on accept. */
  stimulusId: z.string().min(1).max(32),
  /** `files.id` of the teacher's upload. */
  imageFileId: z.string().min(1).max(32),
})
export type DiagramTarget = z.infer<typeof DiagramTargetSchema>

/** Ref of the batch stimulus of a diagram item: one image per group. */
export const diagramStimulusRef = (groupId: string): string => `group:${groupId}`

export const DIAGRAM_STIMULUS_LABEL = 'Gambar rajah'

/** The item states that count as "Menunggu Semakan" (the review OPEN set). */
export const DIAGRAM_OPEN_STATES = ['generated', 'needs_review', 'duplicate'] as const

/** The target of an item payload, or null when the item is not a diagram item (or the target is malformed). */
export function diagramTargetOf(payload: unknown): DiagramTarget | null {
  if (typeof payload !== 'object' || payload === null) return null
  const parsed = DiagramTargetSchema.safeParse((payload as { target?: unknown }).target)
  return parsed.success ? parsed.data : null
}

/** The stimulus that receives the image: the first non-passage stimulus of the group, else the first one. */
export function pickGroupStimulus<T extends { id: bigint; kind: string; position: number }>(rows: readonly T[]): T | null {
  const sorted = [...rows].sort((a, b) => a.position - b.position)
  return sorted.find((r) => r.kind !== 'passage') ?? sorted[0] ?? null
}

/** The intake payload of a diagram item (the review views parse it as any item; `target` carries the meaning). */
export function diagramPayloadOf(target: DiagramTarget, subjectName: string | null): Record<string, unknown> {
  return {
    stem: `${DIAGRAM_STIMULUS_LABEL} untuk soalan #${target.questionId}`,
    options: [],
    marks: 0,
    mode: 'short_text',
    parts: [],
    tag: {
      subject: (subjectName ?? '').trim().slice(0, 32) || 'UMUM',
      level: 'T4+T5',
      unit: null,
      unitLabel: '',
      sp: [],
      tp: 3,
      formOrigin: 'T1-T3',
    },
    target,
  }
}

export interface OpenDiagramRow {
  questionId: string
  groupId: string
}

/**
 * The questions of `asked` that wait for review: an open item targets the question itself, or the stimulus group it belongs to
 * (one image per group, so the whole group shows "Menunggu Semakan").
 */
export function pendingQuestionIds(asked: readonly { id: string; groupId: string | null }[], open: readonly OpenDiagramRow[]): Set<string> {
  const questions = new Set(open.map((o) => o.questionId))
  const groups = new Set(open.map((o) => o.groupId))
  return new Set(asked.filter((q) => questions.has(q.id) || (q.groupId !== null && groups.has(q.groupId))).map((q) => q.id))
}
