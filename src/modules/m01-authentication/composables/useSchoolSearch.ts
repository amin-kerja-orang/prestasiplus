/**
 * School picker logic shared by S2 (register, limit 15) and S8 (profile, limit 20) (FR-M01-22/43;
 * M01 endpoint #20 = M02 #38 `GET /api/schools/search`, public).
 *
 * The search runs when the query has >= 2 characters **or** a state is chosen; otherwise the
 * results stay empty. The call goes through M02's public `searchSchools` (ADR-0009; M02 owns the
 * endpoint), whose `SchoolSummary` is structurally the M01 `SchoolSummary`.
 */

import { ref, type Ref } from 'vue'

import { useSearchPicker, type SearchPicker } from '@/composables'
import { searchSchools } from '@/modules/m02-users-schools'

import type { SchoolSummary } from '../api'

export const SCHOOL_MIN_QUERY = 2

export interface SchoolSearch {
  picker: SearchPicker<SchoolSummary>
  /** Chosen state (full name) or `''` for none. */
  state: Ref<string>
  /** Changes the state filter and searches again (a state alone loads its schools). */
  setState: (value: string) => void
}

export function useSchoolSearch(options: {
  limit: number
  root: Ref<Element | null | undefined>
}): SchoolSearch {
  const state = ref('')

  const picker = useSearchPicker<SchoolSummary>({
    minChars: 0,
    root: options.root,
    search: async (term, signal) => {
      if (term.length < SCHOOL_MIN_QUERY && state.value === '') return []
      return searchSchools({
        ...(term.length > 0 ? { q: term } : {}),
        state: state.value === '' ? null : state.value,
        limit: options.limit,
        signal,
      })
    },
  })

  function setState(value: string): void {
    state.value = value
    picker.setTerm(picker.term.value)
  }

  return { picker, state, setState }
}
