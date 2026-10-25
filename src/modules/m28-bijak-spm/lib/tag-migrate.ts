/**
 * Migration of old-shape curriculum tags to `CurriculumTag` v2 (v2-dskp-integration 2.8). Nothing
 * in an old tag is a copy of a catalogue node (`MAT-T4-02` and free-text SP were prototype values),
 * so a tingkatan-bound tag with a unit or SP is never carried over or matched to "the closest" node
 * (AC-08.4): it is flagged for a person to tag again. Pure functions over plain data.
 */
import { KBAT_LEVELS } from '../domain/types'
import type { CurriculumTag, KbatLevel, TpLevel } from '../domain/types'

/** The persisted schema number after this migration (`state.schema`). */
export const TAG_STATE_SCHEMA = 2

/** Shape of a tag before v2: `level` and `unitLabel` identify it. */
interface LegacyTag {
  subject: string
  level?: string
  unit?: string | null
  unitLabel?: string
  sp?: string[]
  tp?: number
  formOrigin?: string
  kbat?: string | null
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Whether `v` is a tag in the old shape (carries `unitLabel` or `level`). */
export function isLegacyTag(v: unknown): v is LegacyTag {
  return isRecord(v) && ('unitLabel' in v || 'level' in v)
}

function legacyKbat(k: unknown): KbatLevel | null {
  if (typeof k !== 'string') return null
  const lower = k.toLowerCase()
  return (KBAT_LEVELS as readonly string[]).includes(lower) ? (lower as KbatLevel) : null
}

function legacyTp(tp: unknown): TpLevel | null {
  return typeof tp === 'number' && Number.isInteger(tp) && tp >= 1 && tp <= 6 ? (tp as TpLevel) : null
}

/**
 * Old tag to v2. Idempotent: a tag that is already v2 is returned as it is.
 * - T1-T3 keeps its tingkatan (no unit or SP by definition);
 * - T4/T5 loses the tingkatan, unit and SP, and is flagged `perlu-semakan` when it carried a unit,
 *   a unit label or an SP (an empty draft is simply untagged);
 * - TP 1 to 6 is kept (it cannot be told from a deliberate choice), anything else becomes null;
 * - a KBAT level is kept in its new lower-case form; `level` and `unitLabel` are dropped.
 */
export function legacyTagToV2(old: CurriculumTag | LegacyTag): CurriculumTag {
  if (!isLegacyTag(old)) return old
  const base = {
    subject: old.subject,
    unitId: null,
    spIds: [],
    tp: legacyTp(old.tp),
    kbat: legacyKbat(old.kbat),
    catalogueVersion: null,
  }
  if (old.formOrigin === 'T1-T3') return { ...base, formOrigin: 'T1-T3' }
  const claimed = Boolean(old.unit) || Boolean(old.unitLabel) || (old.sp?.length ?? 0) > 0
  return { ...base, formOrigin: null, ...(claimed ? { review: 'perlu-semakan' as const } : {}) }
}

/** The parts of the persisted server state that hold tags (see `server/store.ts` and `server/admin.ts`). */
export interface TagHoldingState {
  schema?: number
  intake?: Record<string, { questions?: { tag?: unknown }[] }>
  dynSeeds?: Record<string, { questions?: { curriculum?: unknown }[] }>
  review?: Record<
    string,
    {
      revision?: { content?: { question?: { curriculum?: unknown } } }
      live?: { question?: { curriculum?: unknown } }
    }
  >
}

/**
 * Migrate every old-shape tag in the persisted state, in place, and stamp `schema = 2`. Covers intake
 * batches, review units made from them (`dynSeeds`), and the revision and live content of reviewed
 * questions. Safe to run again. Returns how many tags were converted.
 */
export function migrateTagsInState(state: TagHoldingState): number {
  let n = 0
  const fix = <K extends string>(holder: Partial<Record<K, unknown>> | undefined, key: K): void => {
    if (holder && isLegacyTag(holder[key])) {
      holder[key] = legacyTagToV2(holder[key])
      n++
    }
  }
  for (const b of Object.values(state.intake ?? {})) for (const q of b.questions ?? []) fix(q, 'tag')
  for (const s of Object.values(state.dynSeeds ?? {}))
    for (const q of s.questions ?? []) fix(q, 'curriculum')
  for (const r of Object.values(state.review ?? {})) {
    fix(r.revision?.content?.question, 'curriculum')
    fix(r.live?.question, 'curriculum')
  }
  state.schema = TAG_STATE_SCHEMA
  return n
}
