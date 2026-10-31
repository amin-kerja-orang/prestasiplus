/**
 * Draft recovery of the Studio wizard (V2 cloud-student-mechanism section 3.1 step 2; design S1.2): work not yet saved is kept in
 * the browser, and the next visit offers `Pulihkan` / `Buang` under "Terdapat kerja yang belum disimpan daripada sesi sebelum
 * ini." The snapshot is the form state only (text, ids, tokens of pictures already uploaded), read back with a strict shape
 * check so a damaged or foreign value is ignored. Pure over a storage-like object.
 */
import { LEAF_MODES, newUid, type LeafDraft, type StudioDraft } from './draft'
import { isCognitive } from './dskp-tags'

export const RECOVERY_MESSAGE = 'Terdapat kerja yang belum disimpan daripada sesi sebelum ini.'
const VERSION = 1
/** `pp:draft:` is the prefix the session store clears at sign-out; the user id keeps one person's draft from another's. */
const PREFIX = 'pp:draft:studio:'

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const recoveryKey = (userId: string, questionId?: string): string =>
  `${PREFIX}${userId}:${questionId === undefined ? 'baharu' : `soalan-${questionId}`}`

/** The state without the local row keys, so two drafts compare by content. */
export const contentOf = (d: StudioDraft): string => JSON.stringify({ ...d, leaves: d.leaves.map((l) => ({ ...l, uid: '' })) })

export const sameDraft = (a: StudioDraft, b: StudioDraft): boolean => contentOf(a) === contentOf(b)

const isStr = (v: unknown): v is string => typeof v === 'string'
const isNullStr = (v: unknown): v is string | null => v === null || typeof v === 'string'
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function leafOf(v: unknown): LeafDraft | null {
  if (!isObj(v)) return null
  const mode = LEAF_MODES.find((m) => m.value === v.mode)?.value
  const num = isObj(v.numeric) ? v.numeric : null
  if (!mode || !isStr(v.label) || !isStr(v.prompt) || typeof v.marks !== 'number' || !Array.isArray(v.options) || !isStr(v.correct) || !isStr(v.accepted) || !num) return null
  if (!(v.tp === null || (typeof v.tp === 'number' && v.tp >= 1 && v.tp <= 6)) || !(v.cognitive === null || isCognitive(v.cognitive))) return null
  if (!isStr(num.value) || !isStr(num.tolerance) || !isStr(num.unit)) return null
  const options = []
  for (const o of v.options) {
    if (!isObj(o) || !isStr(o.label) || !isStr(o.text) || !isNullStr(o.imageToken)) return null
    options.push({ label: o.label, text: o.text, imageToken: o.imageToken })
  }
  return {
    uid: newUid(), label: v.label, mode, prompt: v.prompt, marks: v.marks, tp: v.tp, cognitive: v.cognitive,
    options, correct: v.correct, accepted: v.accepted, numeric: { value: num.value, tolerance: num.tolerance, unit: num.unit },
  }
}

/** The draft in a stored value, or null when it is missing, from another version or not of the expected shape. */
export function parseSnapshot(text: string | null): StudioDraft | null {
  if (text === null) return null
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!isObj(raw) || raw.v !== VERSION || !isObj(raw.draft) || raw.draft.leaves === undefined || !Array.isArray(raw.draft.leaves)) return null
  const d = raw.draft
  if (!isStr(d.subjectId) || !isStr(d.educationLevelId) || !isStr(d.stem) || !isStr(d.numberLabel) || !isStr(d.chapterId) || typeof d.difficulty !== 'number') return null
  if (!isNullStr(d.stemImageToken) || !isNullStr(d.unitId) || !isNullStr(d.groupId) || !['', '1', '2', '3'].includes(d.kertas as string)) return null
  if (!Array.isArray(d.spIds) || !d.spIds.every(isStr) || d.spIds.length > 3) return null
  const leaves = (d.leaves as unknown[]).map(leafOf)
  if (leaves.some((l) => l === null) || leaves.length > 26) return null
  return {
    subjectId: d.subjectId, educationLevelId: d.educationLevelId, kertas: d.kertas as StudioDraft['kertas'], numberLabel: d.numberLabel, stem: d.stem,
    stemImageToken: d.stemImageToken, chapterId: d.chapterId, difficulty: d.difficulty, unitId: d.unitId, spIds: d.spIds, groupId: d.groupId,
    leaves: leaves as LeafDraft[],
  }
}

export function saveSnapshot(store: KeyValueStore, key: string, draft: StudioDraft, now: Date = new Date()): void {
  try {
    store.setItem(key, JSON.stringify({ v: VERSION, savedAt: now.toISOString(), draft }))
  } catch {
    /* storage full or blocked: recovery is a convenience, never an error */
  }
}

export function loadSnapshot(store: KeyValueStore, key: string): StudioDraft | null {
  try {
    return parseSnapshot(store.getItem(key))
  } catch {
    return null
  }
}

export function clearSnapshot(store: KeyValueStore, key: string): void {
  try {
    store.removeItem(key)
  } catch {
    /* ignore */
  }
}
