/**
 * School / state filter state of S1 (FN-M12-2.1.1) and, without the state, S4 (FN-M12-5.1.1). The select
 * values mirror the query, the applied filters become chips for `DsActiveFilters`, and `apply` hands the
 * values to the page, which navigates to its own prefix. The fields are drawn by the page inside
 * `DsFilterBar`.
 *
 * PROPOSED presentation: live has no filter form on the alias; the layout is the rebuild's.
 */
import { computed, ref, watch, type Ref } from 'vue'

import type { FilterOptions } from '../../../api/types'

export interface KirkpatrickFilterValue {
  schoolId: string
  state: string
}

export function useKirkpatrickFilters(
  options: Ref<FilterOptions | null>,
  query: { schoolId: Ref<string>; state?: Ref<string> },
  onApply: (value: KirkpatrickFilterValue) => void,
) {
  const school = ref(query.schoolId.value)
  const state = ref(query.state?.value ?? '')
  watch(
    () => [query.schoolId.value, query.state?.value ?? ''] as const,
    ([s, st]) => {
      school.value = s
      state.value = st
    },
  )

  const chips = computed(() => {
    const out: { key: 'school' | 'state'; label: string }[] = []
    const id = query.schoolId.value
    if (id !== '') {
      const name = options.value?.schools.find((s) => String(s.id) === id)?.name
      out.push({ key: 'school', label: `Sekolah: ${name ?? id}` })
    }
    if (query.state && query.state.value !== '')
      out.push({ key: 'state', label: `Negeri: ${query.state.value}` })
    return out
  })

  function apply(): void {
    onApply({ schoolId: school.value, state: query.state ? state.value : '' })
  }
  function removeChip(key: string): void {
    onApply({
      schoolId: key === 'school' ? '' : query.schoolId.value,
      state: key === 'state' ? '' : (query.state?.value ?? ''),
    })
  }
  return { school, state, chips, apply, removeChip }
}
