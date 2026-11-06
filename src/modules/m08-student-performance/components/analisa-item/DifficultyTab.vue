<script setup lang="ts">
/**
 * S11 "Indeks Kesukaran" tab (FR-M08-67…70): search, sort, the table with one expandable detail per
 * question (inline in the "Soalan" cell from `md`, a card list below). Row numbers restart at 1 in the
 * shown order; no match shows no rows and no message.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'

import { DsCluster, DsDataTable, DsEmptyState, DsFilterBar, DsPanel, DsText } from '@/ds'
import { useMedia } from '@/ds/useMedia'
import type { ItemAnalysis } from '../../api/types'
import { usePhIcon } from '../../lib/icons'
import { LEVEL_BADGE, LEVEL_ICON, pctWhole } from '../../lib/prestasi/format'
import {
  DEFAULT_SORT,
  SEARCH_TOO_SHORT,
  SORT_OPTIONS,
  accuracyClass,
  filterRows,
  index2,
  parseSort,
  searchTooShort,
  sortRows,
  topicLine,
  type SortKey,
} from '../../lib/prestasi/item-analysis'

import DifficultyDetail from './DifficultyDetail.vue'

const props = defineProps<{ analysis: ItemAnalysis }>()

const icon = usePhIcon()
const wide = useMedia('(min-width: 768px)')

const PAGE_SIZE = 25
const route = useRoute()
const router = useRouter()

// Search and sort live in the query string (`q`, `susun`; GLB-4). The refs answer at once, the URL follows.
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const sort = ref<SortKey>(parseSort(route.query.susun))
const open = ref<ReadonlySet<number>>(new Set())
const page = ref(1)
watch([search, sort], () => {
  page.value = 1
  const q = search.value.trim() === '' ? undefined : search.value
  const susun = sort.value === DEFAULT_SORT ? undefined : sort.value
  void router.replace({ query: { ...route.query, q, susun } })
})
const tooShort = computed(() => searchTooShort(search.value))

const found = computed(() =>
  sortRows(filterRows(props.analysis.difficulty, search.value), sort.value),
)

interface Row extends Record<string, unknown> {
  questionId: number
  index: number
  text: string
  topic: string
  attemptsText: string
  studentsText: string
  accuracy: number
  accuracyText: string
  indexText: string
  level: ItemAnalysis['difficulty'][number]['level']
  wrongText: string
  source: ItemAnalysis['difficulty'][number]
}
const rows = computed<Row[]>(() =>
  found.value.map((r, i) => ({
    questionId: r.questionId,
    index: i + 1,
    text: r.text,
    topic: topicLine(r),
    attemptsText: String(r.attempts),
    studentsText: `${r.students} pelajar`,
    accuracy: r.accuracy,
    accuracyText: pctWhole(r.accuracy),
    indexText: index2(r.index),
    level: r.level,
    wrongText: `${r.wrongStudents.length} pelajar salah`,
    source: r,
  })),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'text', header: 'Soalan' },
  { accessorKey: 'topic', header: 'Subjek / Topik' },
  { accessorKey: 'attemptsText', header: 'Percubaan' },
  { accessorKey: 'accuracyText', header: 'Ketepatan' },
  { accessorKey: 'indexText', header: 'Indeks' },
  { accessorKey: 'level', header: 'Tahap' },
]

type Level = ItemAnalysis['difficulty'][number]['level']
const levelColor = (l: Level) => LEVEL_BADGE[l]
const levelIcon = (l: Level): string => icon.value(LEVEL_ICON[l])

function toggle(id: number): void {
  const next = new Set(open.value)
  if (!next.delete(id)) next.add(id)
  open.value = next
}
function reset(): void {
  search.value = ''
  sort.value = DEFAULT_SORT
}

/** Below `md` the rows are a card list; it pages by 25 like the table. */
const pages = computed(() => Math.max(1, Math.ceil(rows.value.length / PAGE_SIZE)))
const pageRows = computed(() => {
  const from = (Math.min(page.value, pages.value) - 1) * PAGE_SIZE
  return rows.value.slice(from, from + PAGE_SIZE)
})
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4" data-testid="difficulty-tab">
    <div v-if="analysis.questionCount === 0" data-testid="difficulty-empty">
      <DsEmptyState
        title="Tiada Data Lagi"
        description="Pelajar dalam kelas ini belum menjawab sebarang soalan lagi."
        icon="tray"
      />
    </div>

    <template v-else>
      <DsFilterBar @apply="() => undefined" @reset="reset">
        <template #search>
          <UInput
            v-model="search"
            type="text"
            placeholder="Cari soalan..."
            aria-label="Cari soalan"
            size="lg"
            class="w-full sm:w-72"
            :color="tooShort ? 'error' : undefined"
            :aria-invalid="tooShort"
            aria-describedby="difficulty-search-hint"
            data-testid="difficulty-search"
          />
        </template>
        <USelect
          v-model="sort"
          :items="[...SORT_OPTIONS]"
          aria-label="Susunan soalan"
          size="lg"
          class="w-full sm:w-64"
          data-testid="difficulty-sort"
        />
      </DsFilterBar>

      <DsText
        v-if="tooShort"
        id="difficulty-search-hint"
        variant="caption"
        tone="error"
        role="status"
        data-testid="difficulty-search-hint"
      >
        {{ SEARCH_TOO_SHORT }}
      </DsText>

      <DsDataTable
        v-if="wide"
        :data="rows"
        :columns="columns"
        caption="Indeks kesukaran soalan"
        :page-size="PAGE_SIZE"
        data-testid="difficulty-table"
      >
        <template #text-cell="{ row }">
          <div
            class="flex max-w-sm min-w-44 flex-col gap-3"
            :data-testid="`difficulty-group-${row.original.questionId}`"
          >
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              class="h-auto min-h-11 justify-between text-start whitespace-normal"
              :trailing-icon="
                open.has(row.original.questionId) ? icon('caret-up') : icon('caret-down')
              "
              :aria-expanded="open.has(row.original.questionId)"
              :data-testid="`difficulty-toggle-${row.original.questionId}`"
              @click="toggle(row.original.questionId)"
            >
              <span class="flex min-w-0 flex-col gap-1">
                <span
                  class="line-clamp-2 text-label break-words text-highlighted"
                  :data-testid="`difficulty-row-${row.original.questionId}`"
                  >{{ row.original.text }}</span
                >
                <span class="text-caption text-error">{{ row.original.wrongText }}</span>
              </span>
            </UButton>
            <div
              v-if="open.has(row.original.questionId)"
              :data-testid="`difficulty-detail-${row.original.questionId}`"
            >
              <DifficultyDetail :row="row.original.source" />
            </div>
          </div>
        </template>
        <template #topic-cell="{ row }">
          <span class="line-clamp-3 text-caption text-muted">{{ row.original.topic }}</span>
        </template>
        <template #attemptsText-cell="{ row }">
          <span class="flex flex-col">
            <span>{{ row.original.attemptsText }}</span>
            <span class="text-caption text-dimmed">{{ row.original.studentsText }}</span>
          </span>
        </template>
        <template #accuracyText-cell="{ row }">
          <span :class="[accuracyClass(row.original.accuracy), 'text-label']">{{
            row.original.accuracyText
          }}</span>
        </template>
        <template #level-cell="{ row }">
          <UBadge
            :color="levelColor(row.original.level)"
            variant="subtle"
            :icon="levelIcon(row.original.level)"
            :label="row.original.level"
          />
        </template>
      </DsDataTable>

      <ul v-else class="flex flex-col gap-3" data-testid="difficulty-table">
        <li
          v-for="r in pageRows"
          :key="r.questionId"
          :data-testid="`difficulty-group-${r.questionId}`"
        >
          <DsPanel>
            <div class="flex flex-col gap-3">
              <div class="flex flex-wrap items-center gap-2">
                <span class="tabular text-label text-muted">#{{ r.index }}</span>
                <UBadge
                  :color="LEVEL_BADGE[r.level]"
                  variant="subtle"
                  :icon="icon(LEVEL_ICON[r.level])"
                  :label="r.level"
                />
              </div>
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                class="h-auto min-h-11 justify-between text-start whitespace-normal"
                :trailing-icon="open.has(r.questionId) ? icon('caret-up') : icon('caret-down')"
                :aria-expanded="open.has(r.questionId)"
                :data-testid="`difficulty-toggle-${r.questionId}`"
                @click="toggle(r.questionId)"
              >
                <span class="flex min-w-0 flex-col gap-1">
                  <span
                    class="text-label break-words text-highlighted"
                    :data-testid="`difficulty-row-${r.questionId}`"
                    >{{ r.text }}</span
                  >
                  <span class="text-caption text-muted">{{ r.topic }}</span>
                  <span class="text-caption text-error">{{ r.wrongText }}</span>
                </span>
              </UButton>
              <dl class="grid grid-cols-3 gap-2 text-center">
                <div>
                  <dt class="text-caption text-muted">Percubaan</dt>
                  <dd class="tabular text-body">{{ r.attemptsText }}</dd>
                </div>
                <div>
                  <dt class="text-caption text-muted">Ketepatan</dt>
                  <dd class="tabular text-label">
                    <span :class="accuracyClass(r.accuracy)">{{ r.accuracyText }}</span>
                  </dd>
                </div>
                <div>
                  <dt class="text-caption text-muted">Indeks</dt>
                  <dd class="tabular text-body">{{ r.indexText }}</dd>
                </div>
              </dl>
              <div v-if="open.has(r.questionId)" :data-testid="`difficulty-detail-${r.questionId}`">
                <DifficultyDetail :row="r.source" />
              </div>
            </div>
          </DsPanel>
        </li>
      </ul>
      <DsCluster
        v-if="!wide && pages > 1"
        as="nav"
        justify="between"
        wrap
        aria-label="Halaman"
        data-testid="difficulty-pager"
      >
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          size="lg"
          class="min-h-11"
          :disabled="page <= 1"
          label="Sebelum"
          @click="page -= 1"
        />
        <DsText as="span" variant="meta">Halaman {{ page }} daripada {{ pages }}</DsText>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          size="lg"
          class="min-h-11"
          :disabled="page >= pages"
          label="Seterusnya"
          @click="page += 1"
        />
      </DsCluster>
    </template>
  </div>
</template>
