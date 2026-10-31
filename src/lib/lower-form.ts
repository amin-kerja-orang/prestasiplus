import { computed } from 'vue'

import { useSessionStore } from '@/stores/session'

/** v2 scope: learning content exists for Tingkatan 4 and 5 only (D54); Tingkatan 1-3 see "coming soon". */
export const LOWER_FORM_COPY = {
  title: 'Kandungan akan datang',
  description:
    'Kandungan untuk Tingkatan anda akan datang. Buat masa ini, latihan tersedia untuk Tingkatan 4 dan 5.',
} as const

/** `UserMe.grade` 7-9 = Tingkatan 1-3. Only a student is held back; staff keep the full pages. */
export function isLowerFormGrade(role: string | undefined, grade: number | null | undefined): boolean {
  return role === 'student' && typeof grade === 'number' && grade >= 7 && grade <= 9
}

export function useIsLowerForm() {
  const session = useSessionStore()
  return computed(() => isLowerFormGrade(session.user?.role, session.user?.grade))
}
