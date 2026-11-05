/**
 * Double-submit guard (40 §X10.3.6, FR-ERR-10, AC-ERR-5).
 *
 * `createSubmitLock(fn)` wraps an async submit. While a call is running, and for `windowMs` (200 ms)
 * after it started, further calls are ignored and resolve to `undefined`: two presses within 200 ms
 * send exactly one request. `pending` is true until the request settles (success or failure); the
 * control shows `label` ("Menyimpan...") and sets `disabled` / `aria-busy` from it. Errors from
 * `fn` are re-thrown to the first caller after the lock is released.
 */
import { ref, type Ref } from 'vue'

/** Progressive label of a save control while its request runs (AC-ERR-5). */
export const SAVING_LABEL_BM = 'Menyimpan...'
/** Generic busy label when the screen has no progressive label of its own (FR-ERR-10). */
export const BUSY_LABEL_BM = 'Sedang diproses...'
/** Presses closer than this to the first one are ignored even if the request already settled. */
export const DOUBLE_PRESS_WINDOW_MS = 200

export interface SubmitLock<A extends unknown[], R> {
  /** Call from the click / submit handler. Resolves to `undefined` when the press was ignored. */
  run: (...args: A) => Promise<R | undefined>
  /** True from the first press until the request settles. */
  pending: Readonly<Ref<boolean>>
  /** `label` while pending, else `idleLabel`. */
  labelFor: (idleLabel: string) => string
}

export interface SubmitLockOptions {
  windowMs?: number
  /** Label while pending. Default "Menyimpan...". */
  label?: string
}

export function createSubmitLock<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  options: SubmitLockOptions = {},
): SubmitLock<A, R> {
  const windowMs = options.windowMs ?? DOUBLE_PRESS_WINDOW_MS
  const label = options.label ?? SAVING_LABEL_BM
  const pending = ref(false)
  let startedAt = Number.NEGATIVE_INFINITY

  async function run(...args: A): Promise<R | undefined> {
    const now = Date.now()
    if (pending.value || now - startedAt < windowMs) return undefined
    pending.value = true
    startedAt = now
    try {
      return await fn(...args)
    } finally {
      pending.value = false
    }
  }

  return {
    run,
    pending,
    labelFor: (idleLabel) => (pending.value ? label : idleLabel),
  }
}

/** Composable name for use in `<script setup>`; same as `createSubmitLock`. */
export const useSubmitLock = createSubmitLock
