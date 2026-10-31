<script setup lang="ts">
/**
 * S1 summary (FR-M04-02..04), v2 admin-list pattern: a KPI strip (Jumlah, Diluluskan, Belum lulus,
 * Subjek Teras, Subjek Elektif) and a collapsible, sortable per-subject table with full names. Each
 * subject links `?subject_id={id}`; the active one is marked, with the link that clears it.
 * Numbers are computed from the summary payload only.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'

import { DsPanel, DsStatRow, type StatItem } from '@/ds'
import { formatCount } from '@/lib/number'

import type { QuestionSummary, QuestionSummarySubject } from '../api/questions'
import { QUESTIONS_LIST_PATH } from '../lib/question-list'

const props = defineProps<{
  summary: QuestionSummary | null
  /** Subject id -> M03 colour (kept in the contract; the staff theme does not use it). */
  colors?: Record<number, string>
  activeSubjectId: number | null
}>()

type SortKey = 'name' | 'total' | 'approved' | 'rate' | 'group'
const STORAGE_KEY = 'pp_questions_summary_open'

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
const expanded = ref(readOpen())
function toggle(): void {
  expanded.value = !expanded.value
  try {
    window.localStorage.setItem(STORAGE_KEY, expanded.value ? '1' : '0')
  } catch {
    /* storage unavailable */
  }
}

const sortKey = ref<SortKey>('total')
const sortDesc = ref(true)
function sortBy(key: SortKey): void {
  if (sortKey.value === key) sortDesc.value = !sortDesc.value
  else {
    sortKey.value = key
    sortDesc.value = key !== 'name'
  }
}

const rate = (s: QuestionSummarySubject): number => (s.total > 0 ? s.approved / s.total : 0)
const subjects = computed<QuestionSummarySubject[]>(() => props.summary?.subjects ?? [])
const sorted = computed(() => {
  const dir = sortDesc.value ? -1 : 1
  const key = sortKey.value
  return [...subjects.value]
    .sort((a, b) => {
      const diff =
        key === 'name'
          ? a.name.localeCompare(b.name, 'ms')
          : key === 'group'
            ? a.group.localeCompare(b.group)
          : key === 'rate'
            ? rate(a) - rate(b)
            : a[key] - b[key]
      return diff * dir || a.name.localeCompare(b.name, 'ms')
    })
    .map((s) => ({ ...s, rate: rate(s) }))
})

const approvedTotal = computed(() => subjects.value.reduce((n, s) => n + s.approved, 0))
const groupTotal = (g: 'teras' | 'elektif'): number =>
  subjects.value.filter((s) => s.group === g).reduce((n, s) => n + s.total, 0)
const groupCount = (g: 'teras' | 'elektif'): number =>
  subjects.value.filter((s) => s.group === g).length

const kpis = computed<StatItem[]>(() => [
  {
    key: 'total',
    label: 'Jumlah soalan',
    value: formatCount(props.summary?.total ?? 0),
    icon: 'i-ph-stack',
    accent: 'action',
  },
  {
    key: 'approved',
    label: 'Diluluskan',
    value: formatCount(approvedTotal.value),
    icon: 'i-ph-check-circle',
    accent: 'win',
  },
  {
    key: 'pending',
    label: 'Belum diluluskan',
    value: formatCount(Math.max((props.summary?.total ?? 0) - approvedTotal.value, 0)),
    icon: 'i-ph-hourglass',
    accent: 'trial',
  },
  {
    key: 'teras',
    label: `Subjek Teras (${String(groupCount('teras'))})`,
    value: formatCount(groupTotal('teras')),
    icon: 'i-ph-book-open',
    accent: 'friend',
  },
  {
    key: 'elektif',
    label: `Subjek Elektif (${String(groupCount('elektif'))})`,
    value: formatCount(groupTotal('elektif')),
    icon: 'i-ph-books',
    accent: 'heat',
  },
])

const GROUP_LABEL = { teras: 'Teras', elektif: 'Elektif' } as const
type Row = (typeof sorted.value)[number]

// Per-cell classes under the key `class`; computed so the class linter does not read the key as a list.
// eslint-disable-next-line pp/ds-class-allowlist -- an object key, not a class list
const META_CLASS = 'class'
const cell = (th: string, td = th): { meta: Record<string, unknown> } => ({
  meta: { [META_CLASS]: { th, td } },
})
const columns: TableColumn<Row>[] = [
  { accessorKey: 'name', header: 'Subjek' },
  { accessorKey: 'total', header: 'Jumlah', ...cell('text-end') },
  { accessorKey: 'approved', header: 'Lulus', ...cell('text-end') },
  { accessorKey: 'rate', header: '% Lulus', ...cell('text-end') },
  { accessorKey: 'group', header: 'Kumpulan', ...cell('hidden sm:table-cell') },
]
const SORTABLE: Record<string, SortKey> = {
  name: 'name',
  total: 'total',
  approved: 'approved',
  rate: 'rate',
  group: 'group',
}
const SORT_KEYS = ['name', 'total', 'approved', 'rate', 'group'] as const
const sortIcon = (key: string): string | undefined =>
  sortKey.value === SORTABLE[key]
    ? sortDesc.value
      ? 'i-ph-arrow-down'
      : 'i-ph-arrow-up'
    : undefined
const pct = (s: Row): string => (s.total > 0 ? `${String(Math.round(s.rate * 100))}%` : '-')
</script>

<template>
  <section
    class="flex flex-col gap-4 md:gap-6"
    aria-label="Ringkasan Bank Soalan"
    data-testid="questions-summary"
  >
    <DsStatRow
      v-if="summary === null"
      :items="kpis"
      loading
      data-testid="questions-tiles-skeleton"
    />
    <template v-else>
      <p class="sr-only" data-testid="questions-total">
        Jumlah: <strong>{{ formatCount(summary.total) }}</strong> soalan
      </p>
      <DsStatRow :items="kpis" density="roomy" data-testid="questions-kpis" />

      <DsPanel padding="none" title="Pecahan mengikut subjek" icon="i-ph-list-numbers">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="activeSubjectId !== null"
              :to="QUESTIONS_LIST_PATH"
              color="error"
              variant="link"
              icon="i-ph-x-circle"
              data-testid="questions-clear-subject"
              >Padam filter subjek — tunjuk semua</UButton
            >
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              :icon="expanded ? 'i-ph-caret-up' : 'i-ph-caret-down'"
              :aria-expanded="expanded"
              aria-controls="questions-subject-table"
              data-testid="questions-summary-toggle"
              @click="toggle"
              >{{ expanded ? 'Sembunyi' : `Tunjuk ${String(subjects.length)} subjek` }}</UButton
            >
          </div>
        </template>
        <UTable
          v-if="expanded"
          id="questions-subject-table"
          sticky
          :data="sorted"
          :columns="columns"
          :ui="{ root: 'max-h-96' }"
          caption="Pecahan soalan mengikut subjek"
          data-testid="questions-subject-table"
        >
          <template v-for="key in SORT_KEYS" :key="key" #[`${key}-header`]="{ column }">
            <UButton
              type="button"
              color="neutral"
              variant="link"
              size="sm"
              :trailing-icon="sortIcon(key)"
              :aria-label="`Isih ikut ${String(column.columnDef.header)}`"
              @click="sortBy(key)"
              >{{ column.columnDef.header }}</UButton
            >
          </template>
          <template #name-cell="{ row }">
            <div
              class="flex flex-wrap items-center gap-2"
              data-testid="questions-tile"
              :data-subject-id="row.original.id"
              :aria-current="row.original.id === activeSubjectId ? 'true' : undefined"
            >
              <ULink
                :to="{ path: QUESTIONS_LIST_PATH, query: { subject_id: String(row.original.id) } }"
                class="text-highlighted"
                >{{ row.original.name }}</ULink
              >
              <UBadge
                v-if="row.original.id === activeSubjectId"
                color="primary"
                variant="soft"
                size="sm"
                label="Dipilih"
              />
            </div>
          </template>
          <template #total-cell="{ row }">
            <span data-testid="questions-tile-total">{{ formatCount(row.original.total) }}</span>
          </template>
          <template #approved-cell="{ row }">
            <span v-if="row.original.approved > 0" data-testid="questions-tile-approved"
              >{{ formatCount(row.original.approved) }} lulus</span
            >
            <span v-else class="text-dimmed">0</span>
          </template>
          <template #rate-cell="{ row }">
            <span class="text-muted">{{ pct(row.original) }}</span>
          </template>
          <template #group-cell="{ row }">
            <UBadge
              color="neutral"
              variant="soft"
              size="sm"
              :label="GROUP_LABEL[row.original.group as keyof typeof GROUP_LABEL]"
              :data-testid="`questions-group-${row.original.group}`"
            />
          </template>
        </UTable>
      </DsPanel>
    </template>
  </section>
</template>
