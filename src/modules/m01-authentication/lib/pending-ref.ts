/**
 * Provisional referral carry (FR-M01-70, M14 XR-M14-02): `/register?ref={code}` keeps the code in
 * sessionStorage `pp.pendingRef` (in memory when storage is unavailable) until the register call
 * sends it as `referralCode`; a successful register clears it. The form itself never changes.
 */

export const PENDING_REF_KEY = 'pp.pendingRef'

let memory: string | null = null

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

export function setPendingRef(code: string): void {
  memory = code
  try {
    storage()?.setItem(PENDING_REF_KEY, code)
  } catch {
    // Storage blocked or full: the in-memory copy still serves this page.
  }
}

export function getPendingRef(): string | null {
  try {
    const stored = storage()?.getItem(PENDING_REF_KEY)
    if (stored) return stored
  } catch {
    // fall through to the in-memory copy
  }
  return memory
}

export function clearPendingRef(): void {
  memory = null
  try {
    storage()?.removeItem(PENDING_REF_KEY)
  } catch {
    // ignore
  }
}
