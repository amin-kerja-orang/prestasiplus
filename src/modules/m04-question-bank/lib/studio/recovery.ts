/**
 * Draft recovery of the Studio wizard (V2 cloud-student-mechanism section 3.1 step 2; design S1.2): work not yet saved is kept in
 * the browser, and the next visit offers `Pulihkan` / `Buang` under "Terdapat kerja yang belum disimpan daripada sesi sebelum
 * ini." The snapshot is the form state only (text, ids, tokens of pictures already uploaded), read back with a strict shape
 * check so a damaged or foreign value is ignored. Pure over a storage-like object.
 */
import { ANSWER_SPACES, LEAF_MODES, POINT_CODES, SCRIPT_TYPES, blankLeaf, type LeafDraft, type PointCode, type StudioDraft } from './draft'
import { isCognitive } from './dskp-tags'

export const RECOVERY_MESSAGE = 'Terdapat kerja yang belum disimpan daripada sesi sebelum ini.'
/** 2: the draft holds Penjelasan and Jenis tulisan; an older snapshot would clear them on save. The part-B leaf fields are optional in a snapshot (absent = blank), so no bump. */
const VERSION = 2
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
export const contentOf = (d: StudioDraft): string => {
  // `inheritedTp` null / undefined / absent all mean "none", so they compare equal whatever the key order.
  const { inheritedTp, ...rest } = d
  return JSON.stringify({ ...rest, inheritedTp: inheritedTp ?? null, leaves: d.leaves.map((l) => ({ ...l, uid: '' })) })
}

export const sameDraft = (a: StudioDraft, b: StudioDraft): boolean => contentOf(a) === contentOf(b)

const isStr = (v: unknown): v is string => typeof v === 'string'
const isNullStr = (v: unknown): v is string | null => v === null || typeof v === 'string'
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function leafOf(v: unknown): LeafDraft | null {
  if (!isObj(v)) return null
  const mode = LEAF_MODES.find((m) => m.value === v.mode)?.value
  const num = isObj(v.numeric) ? v.numeric : null
  if (!mode || !isStr(v.label) || !isStr(v.prompt) || typeof v.marks !== 'number' || !Array.isArray(v.options) || !isStr(v.correct) || !isStr(v.accepted) || !num) return null
  if (!(v.tp === null || (typeof v.tp === 'number' && Number.isInteger(v.tp) && v.tp >= 1 && v.tp <= 6)) || !(v.cognitive === null || isCognitive(v.cognitive))) return null
  if (!isStr(num.value) || !isStr(num.tolerance) || !isStr(num.unit)) return null
  const options: LeafDraft['options'] = []
  for (const o of v.options) {
    if (!isObj(o) || !isStr(o.label) || !isStr(o.text) || !isNullStr(o.imageToken) || !(o.textEn === undefined || isNullStr(o.textEn))) return null
    options.push({ label: o.label, text: o.text, ...(o.textEn == null ? {} : { textEn: o.textEn }), imageToken: o.imageToken })
  }
  const leaf: LeafDraft = {
    ...blankLeaf(v.label, mode), label: v.label, prompt: v.prompt, marks: v.marks, tp: v.tp, cognitive: v.cognitive,
    options, correct: v.correct, accepted: v.accepted, numeric: { value: num.value, tolerance: num.tolerance, unit: num.unit },
  }
  return overlay(leaf, v)
}

const strList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr)
const absent = (v: unknown): boolean => v === undefined

/** The part-B fields of a snapshot leaf: each is checked when present, a missing one keeps its blank value. */
function overlay(leaf: LeafDraft, v: Record<string, unknown>): LeafDraft | null {
  const out = { ...leaf }
  if (!absent(v.promptEn)) { if (!isNullStr(v.promptEn)) return null; out.promptEn = v.promptEn }
  if (!absent(v.stimulusId)) { if (!isNullStr(v.stimulusId)) return null; out.stimulusId = v.stimulusId }
  if (!absent(v.exampleAnswer)) { if (!isNullStr(v.exampleAnswer)) return null; out.exampleAnswer = v.exampleAnswer }
  if (!absent(v.extra)) { if (!isObj(v.extra)) return null; out.extra = v.extra }
  if (!absent(v.modeConfigRest)) { if (!isObj(v.modeConfigRest)) return null; out.modeConfigRest = v.modeConfigRest }
  if (!absent(v.keyBase)) { if (v.keyBase !== null && !isObj(v.keyBase)) return null; out.keyBase = v.keyBase }
  for (const k of ['multi', 'bankUnique', 'hardLimit'] as const) if (!absent(v[k])) { if (typeof v[k] !== 'boolean') return null; out[k] = v[k] }
  for (const k of ['correctMulti', 'acceptedOptions'] as const) if (!absent(v[k])) { if (!strList(v[k])) return null; out[k] = v[k] }
  for (const k of ['keyNote', 'bankLetter'] as const) if (!absent(v[k])) { if (!isStr(v[k])) return null; out[k] = v[k] }
  if (!absent(v.answerSpace)) { if (v.answerSpace !== '' && !ANSWER_SPACES.some((a) => a.value === v.answerSpace)) return null; out.answerSpace = v.answerSpace as LeafDraft['answerSpace'] }
  if (!absent(v.words)) { if (!isObj(v.words) || !isStr(v.words.min) || !isStr(v.words.max)) return null; out.words = { min: v.words.min, max: v.words.max } }
  if (!absent(v.final)) {
    const f = v.final
    if (!isObj(f) || !isStr(f.display) || !isStr(f.accepted) || !isStr(f.tolerance) || !isStr(f.unit)) return null
    out.final = { display: f.display, accepted: f.accepted, tolerance: f.tolerance, unit: f.unit }
  }
  if (!absent(v.alternatives)) {
    if (!Array.isArray(v.alternatives)) return null
    const alts: LeafDraft['alternatives'] = []
    for (const a of v.alternatives) {
      if (!isObj(a) || !isStr(a.id) || !isStr(a.title) || !isStr(a.prompt) || !isNullStr(a.promptEn) || !isNullStr(a.stimulusId)) return null
      alts.push({ id: a.id, title: a.title, prompt: a.prompt, promptEn: a.promptEn, stimulusId: a.stimulusId })
    }
    out.alternatives = alts
  }
  if (!absent(v.points)) {
    if (!Array.isArray(v.points)) return null
    const pts: LeafDraft['points'] = []
    for (const p of v.points) {
      if (!isObj(p) || !isStr(p.id) || !POINT_CODES.includes(p.code as PointCode) || !isStr(p.label) || typeof p.marks !== 'number' || !isObj(p.rest)) return null
      pts.push({ id: p.id, code: p.code as PointCode, label: p.label, marks: p.marks, rest: p.rest })
    }
    out.points = pts
  }
  return out
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
  const inheritedTp = d.inheritedTp
  if (!(inheritedTp === undefined || inheritedTp === null || (typeof inheritedTp === 'number' && Number.isInteger(inheritedTp) && inheritedTp >= 1 && inheritedTp <= 6))) return null
  return {
    subjectId: d.subjectId, educationLevelId: d.educationLevelId, kertas: d.kertas as StudioDraft['kertas'], numberLabel: d.numberLabel, stem: d.stem,
    stemImageToken: d.stemImageToken, chapterId: d.chapterId, difficulty: d.difficulty, unitId: d.unitId, spIds: d.spIds, groupId: d.groupId,
    leaves: leaves as LeafDraft[],
    explanation: isStr(d.explanation) ? d.explanation : '',
    explanationEn: isStr(d.explanationEn) ? d.explanationEn : null,
    scriptType: SCRIPT_TYPES.find((k) => k.value === d.scriptType)?.value ?? 'rumi',
    ...(typeof inheritedTp === 'number' ? { inheritedTp } : {}),
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
