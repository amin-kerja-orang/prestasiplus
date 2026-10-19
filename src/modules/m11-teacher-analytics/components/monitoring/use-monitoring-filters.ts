/**
 * S2 filter state (FN-M11-3.2.1..3.2.2; FR-M11-30, 31): the three select values mirror the query, the
 * applied filters become chips for `DsActiveFilters`, and `submit` hands the values to the page, which
 * navigates with a dummy `_token` as live does (SEC-M11-01). The fields themselves are drawn by the page
 * inside `DsFilterBar`.
 */
import { computed, ref, watch, type Ref } from 'vue'

import type { MonitoringFilterQuery } from './monitoring-paths'

export const PERIODS = [
  ['', 'Semua Masa'],
  ['7d', '7 Hari'],
  ['30d', '30 Hari'],
  ['3m', '3 Bulan'],
] as const
export const STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Kuala Lumpur',
  'Melaka',
  'Pahang',
  'Perak',
  'Sabah',
  'Selangor',
  'Terengganu',
]
export const TAHAPS = ['Cemerlang', 'Sederhana', 'Rendah', 'Kritikal', 'Tiada Langsung']

const LABEL: Record<keyof MonitoringFilterQuery, string> = {
  period: 'Tempoh',
  state: 'Negeri',
  tahap: 'Tahap',
}

export function useMonitoringFilters(
  query: Ref<MonitoringFilterQuery>,
  apply: (next: MonitoringFilterQuery) => void,
) {
  const period = ref(query.value.period)
  const state = ref(query.value.state)
  const tahap = ref(query.value.tahap)
  watch(query, (q) => {
    period.value = q.period
    state.value = q.state
    tahap.value = q.tahap
  })

  const chips = computed(() => {
    const out: { key: keyof MonitoringFilterQuery; label: string }[] = []
    const p = PERIODS.find(([v]) => v === query.value.period)
    if (query.value.period !== '')
      out.push({ key: 'period', label: `${LABEL.period}: ${p ? p[1] : query.value.period}` })
    if (query.value.state !== '')
      out.push({ key: 'state', label: `${LABEL.state}: ${query.value.state}` })
    if (query.value.tahap !== '')
      out.push({ key: 'tahap', label: `${LABEL.tahap}: ${query.value.tahap}` })
    return out
  })

  function submit() {
    apply({ period: period.value, state: state.value, tahap: tahap.value })
  }
  function removeChip(key: string) {
    apply({ ...query.value, [key]: '' })
  }
  return { period, state, tahap, chips, submit, removeChip }
}
