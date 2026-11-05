/**
 * Unsaved-work drafts that survive a 401 re-login (40 FR-ERR-8, AC-ERR-2).
 *
 * A form writes its edits to `sessionStorage` under `pp.draft.{routeName}.{recordId|new}` (at most
 * 200 KB). After re-login the same form calls `restoreDraft`, which returns the values once, removes
 * the draft and carries the notice text to show. Drafts are removed after a successful save
 * (`clearDraft`) and on logout (`clearAllDrafts`). Every storage call is wrapped in try/catch, so
 * blocked or full storage never breaks the form. Passwords and files are never stored: secret-like
 * field names are dropped, and `File` / `Blob` / `FormData` values are skipped.
 */

export const DRAFT_KEY_PREFIX = 'pp.draft.'
/** Largest serialised draft that is written (FR-ERR-8). */
export const DRAFT_MAX_BYTES = 200 * 1024
export const DRAFT_NOTICE_BM = 'Terdapat kerja yang belum disimpan daripada sesi sebelum ini.'

export type DraftValues = Record<string, unknown>

export interface RestoredDraft {
  values: DraftValues
  /** Show in the same screen element for every restored draft. */
  notice: string
}

/** Field names never kept in a draft. */
const SECRET_NAME = /pass(word)?|kata[\s_-]?laluan|secret|token|otp|pin\b/i

export function draftKey(routeName: string, recordId?: string | number | null): string {
  const id =
    recordId === undefined || recordId === null || recordId === '' ? 'new' : String(recordId)
  return `${DRAFT_KEY_PREFIX}${routeName}.${id}`
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

function isBinary(value: unknown): boolean {
  return (
    (typeof File !== 'undefined' && value instanceof File) ||
    (typeof Blob !== 'undefined' && value instanceof Blob) ||
    (typeof FormData !== 'undefined' && value instanceof FormData)
  )
}

function clean(value: unknown, depth: number): unknown {
  if (isBinary(value) || typeof value === 'function' || typeof value === 'symbol') return undefined
  if (Array.isArray(value)) {
    if (depth > 8) return undefined
    return value.map((item) => clean(item, depth + 1)).filter((item) => item !== undefined)
  }
  if (value !== null && typeof value === 'object') {
    if (depth > 8) return undefined
    const out: DraftValues = {}
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_NAME.test(key)) continue
      const kept = clean(item, depth + 1)
      if (kept !== undefined) out[key] = kept
    }
    return out
  }
  return value
}

/** Writes the draft. Returns `false` when nothing was stored (too large, storage blocked or full). */
export function saveDraft(
  routeName: string,
  recordId: string | number | null | undefined,
  values: DraftValues,
): boolean {
  const store = storage()
  if (!store) return false
  try {
    const json = JSON.stringify({ savedAt: Date.now(), values: clean(values, 0) })
    if (new Blob([json]).size > DRAFT_MAX_BYTES) return false
    store.setItem(draftKey(routeName, recordId), json)
    return true
  } catch {
    return false
  }
}

function read(key: string): DraftValues | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(key)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object') {
      const values = (parsed as { values?: unknown }).values
      if (values !== null && typeof values === 'object' && !Array.isArray(values)) {
        return values as DraftValues
      }
    }
    return null
  } catch {
    return null
  }
}

/** Reads a draft without removing it. */
export function loadDraft(
  routeName: string,
  recordId?: string | number | null,
): DraftValues | null {
  return read(draftKey(routeName, recordId))
}

export function hasDraft(routeName: string, recordId?: string | number | null): boolean {
  return loadDraft(routeName, recordId) !== null
}

/** Removes one draft (after a successful save). */
export function clearDraft(routeName: string, recordId?: string | number | null): void {
  try {
    storage()?.removeItem(draftKey(routeName, recordId))
  } catch {
    // Storage blocked: nothing to remove.
  }
}

/** Removes every draft (logout). */
export function clearAllDrafts(): void {
  const store = storage()
  if (!store) return
  try {
    const keys: string[] = []
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i)
      if (key?.startsWith(DRAFT_KEY_PREFIX)) keys.push(key)
    }
    for (const key of keys) store.removeItem(key)
  } catch {
    // Storage blocked: nothing to remove.
  }
}

/** After re-login: returns the saved values and the notice once, and removes the draft. */
export function restoreDraft(
  routeName: string,
  recordId?: string | number | null,
): RestoredDraft | null {
  const values = loadDraft(routeName, recordId)
  if (values === null) return null
  clearDraft(routeName, recordId)
  return { values, notice: DRAFT_NOTICE_BM }
}
