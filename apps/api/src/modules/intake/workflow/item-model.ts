import {
  IntakeQuestionSchema,
  intakeItemConfidenceBand,
  type IntakeDuplicateEntry,
  type IntakeDuplicateKind,
  type IntakeDuplicateStatus,
  type IntakeItemState,
  type IntakeQuestion,
  type IntakeRegion,
  type IntakeStimulus,
} from '@pp/contract'

import { z } from 'zod'
import { idToString } from '../../../db/ids'
import { Prisma } from '../../../db/generated/client'

/** The content columns of an item that live in the `payload` JSON (the rest of `IntakeQuestion` has its own columns). */
const PAYLOAD_KEYS = {
  stem: true,
  options: true,
  marks: true,
  mode: true,
  unit: true,
  wordRange: true,
  parts: true,
  scheme: true,
  tag: true,
} as const
export const PayloadSchema = IntakeQuestionSchema.pick(PAYLOAD_KEYS)
export type Payload = z.infer<typeof PayloadSchema>

/** Where the item came from as extracted; later edits of the label or the page do not change it (contract `provenance`). */
export const StoredPayloadSchema = PayloadSchema.extend({
  origin: z.strictObject({ label: z.string().max(32), page: z.number().int().min(1) }).optional(),
})
export type StoredPayload = z.infer<typeof StoredPayloadSchema>

/** What every query of an item loads. */
export const ITEM_INCLUDE = {
  batch: {
    select: {
      id: true,
      ownerUserId: true,
      subject: true,
      status: true,
      sourcePaperId: true,
      sourceText: true,
      rightsStatus: true,
      owner: { select: { id: true, name: true } },
    },
  },
  stimulus: true,
  run: { select: { id: true, provider: true, model: true } },
  duplicates: { orderBy: { id: 'asc' as const } },
} satisfies Prisma.IntakeItemInclude

export type ItemRow = Prisma.IntakeItemGetPayload<{ include: typeof ITEM_INCLUDE }>
export type StimulusRow = Prisma.IntakeStimulusGetPayload<Record<string, never>>
export type DuplicateRow = Prisma.DuplicateLinkGetPayload<Record<string, never>>

export function payloadOf(row: { payload: unknown }): StoredPayload {
  return StoredPayloadSchema.parse(row.payload)
}

export function fieldConfidenceOf(row: { fieldConfidence: unknown }): Record<string, number> {
  const parsed = z.record(z.string(), z.number().min(0).max(1)).safeParse(row.fieldConfidence)
  return parsed.success ? parsed.data : {}
}

export function regionOf(row: { region: unknown }): IntakeRegion | null {
  const parsed = z
    .strictObject({ page: z.number().int().min(1), x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1) })
    .safeParse(row.region)
  return parsed.success ? parsed.data : null
}

/** The editable question content of an item, in the prototype `IntakeQuestion` shape (what the gate reads). */
export function questionOf(row: ItemRow): IntakeQuestion {
  const { origin: _origin, ...p } = payloadOf(row)
  void _origin
  return {
    id: idToString(row.id),
    label: row.numberLabel,
    type: row.itemType as IntakeQuestion['type'],
    ...p,
    ...(row.stimulusId === null ? {} : { stimulusId: idToString(row.stimulusId) }),
    page: row.pageNo,
    lowFields: row.lowFields,
    confirmed: row.confirmedFields,
    ...(row.needsManual ? { needsManual: true } : {}),
  }
}

export function stimulusOf(row: StimulusRow): IntakeStimulus {
  const table = z
    .strictObject({ head: z.array(z.string()), rows: z.array(z.array(z.string())) })
    .safeParse(row.tableData)
  const region = regionOf({ region: row.region })
  return {
    id: idToString(row.id),
    kind: row.kind as IntakeStimulus['kind'],
    label: row.label,
    ...(row.caption === null ? {} : { caption: row.caption }),
    alt: row.altText,
    ...(row.body === null ? {} : { text: row.body }),
    ...(table.success ? { table: table.data } : {}),
    ...(row.pageNo === null ? {} : { page: row.pageNo }),
    figureId: row.figureId === null ? null : idToString(row.figureId),
    region,
  }
}

/** Duplicate entry status of the stored decision. */
export function entryStatus(decision: string): IntakeDuplicateStatus {
  if (decision === 'not_duplicate') return 'dismissed'
  if (decision === 'merged' || decision === 'linked_variant') return 'linked'
  return 'open'
}

export interface StateDuplicate {
  kind: IntakeDuplicateKind
  status: IntakeDuplicateStatus
}

export const stateDuplicates = (rows: ReadonlyArray<Pick<DuplicateRow, 'kind' | 'decision'>>): StateDuplicate[] =>
  rows.map((d) => ({ kind: d.kind as IntakeDuplicateKind, status: entryStatus(d.decision) }))

/**
 * Confidence band of an item: its lowest field. An AI-extracted item with no confidence data is `low` (fail closed: it
 * can never be bulk-accepted on missing data); "no data = high" holds only for a hand-added item.
 */
export const bandOf = (row: { fieldConfidence: unknown; sourceType: string }) => {
  const c = fieldConfidenceOf(row)
  return Object.keys(c).length === 0 && row.sourceType !== 'manual' ? ('low' as const) : intakeItemConfidenceBand(c)
}

export type { IntakeDuplicateEntry, IntakeItemState }
export { Prisma }
