/** State shared by the lane pages: applied filters, chips, the current page and the load. */
import { computed, ref, watch } from 'vue'

import { useApi } from '@/composables/useApi'

import type { LanePage, LaneQuery } from './api'

export interface LaneFilters {
  subjectId: string
  status: string
  search: string
}

export const PAGE_SIZE = 25

export function useLane<T>(
  read: (q: LaneQuery) => Promise<LanePage<T>>,
  statusLabel: (code: string) => string,
) {
  const filters = ref<LaneFilters>({ subjectId: '', status: '', search: '' })
  const page = ref(1)
  const list = useApi(
    () =>
      read({
        ...(filters.value.subjectId ? { subjectId: filters.value.subjectId } : {}),
        ...(filters.value.status ? { status: filters.value.status } : {}),
        ...(filters.value.search.trim() ? { search: filters.value.search.trim() } : {}),
        page: page.value,
        pageSize: PAGE_SIZE,
      }),
    [filters, page],
  )
  watch(filters, () => (page.value = 1))

  /** The Subjek options come from the lane response (REQ-C-020), not from the bank summary. */
  const subjects = computed(() => list.data.value?.subjects ?? [])
  /** Null until the lane has answered: a load or a failure must not read as an empty lane. */
  const count = computed(() => list.data.value?.count ?? null)
  const chips = computed(() => [
    ...(filters.value.subjectId
      ? [{ key: 'subjectId', label: subjects.value.find((s) => s.id === filters.value.subjectId)?.name ?? filters.value.subjectId }]
      : []),
    ...(filters.value.status ? [{ key: 'status', label: statusLabel(filters.value.status) }] : []),
    ...(filters.value.search.trim() ? [{ key: 'search', label: `"${filters.value.search.trim()}"` }] : []),
  ])
  function removeChip(key: string): void {
    filters.value = { ...filters.value, [key]: '' }
  }
  return { filters, page, subjects, count, list, chips, removeChip }
}
