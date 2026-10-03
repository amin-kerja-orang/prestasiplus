import type { GuruDashboard } from '../../api/types'
import { GUIDE_STORAGE_KEY } from './copy'

/** BR-M10-05: done steps k of 3 and p = round(k ÷ 3 × 100). */
export function checklistProgress(c: GuruDashboard['checklist']): {
  done: number
  percent: number
} {
  const done = [c.hasClass, c.hasStudents, c.hasMission].filter(Boolean).length
  return { done, percent: Math.round((done / 3) * 100) }
}

/** FR-M10-08: the guide shows unless the key is "true"; storage failures are ignored (guide shown). */
export function readGuideHidden(): boolean {
  try {
    return localStorage.getItem(GUIDE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function writeGuideHidden(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(GUIDE_STORAGE_KEY, 'true')
    else localStorage.removeItem(GUIDE_STORAGE_KEY)
  } catch {
    /* ignored */
  }
}

/** Header subtitle of FN-M10-1.1.3. */
export const welcomeSubtitle = (name: string): string => `Selamat datang, ${name} 👩‍🏫`
