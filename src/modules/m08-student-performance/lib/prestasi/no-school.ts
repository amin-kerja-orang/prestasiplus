import type { SchoolItemAnalysis } from '../../api/types'

/**
 * S9 `/analisa-item/sekolah` for a viewer without a school (Admin Pusat): the real API answers 404 (no own
 * school), which would render the SPA 404 page. The page shows the S9 "Tiada Data Pelajar" empty state
 * instead, as an unknown `{id}` does (FR-M08-143; DV-M08-41).
 */
export function noSchoolAnalysis(tingkatan: 'T4' | 'T5' | null = null): SchoolItemAnalysis {
  return {
    school: { id: 0, name: '', code: null, type: '', district: null, state: '' },
    variant: 'own',
    tingkatan,
    students: 0,
    answers: 0,
    correct: 0,
    accuracy: null,
    difficulty: { mudah: 0, sederhana: 0, sukar: 0 },
    gps: { value: null, band: null, entries: 0, years: [] },
    subjects: [],
    questions: [],
  }
}
