<script setup lang="ts">
/**
 * S11 "Indeks Kesukaran" tab (FR-M08-67…70): search, sort, the table with one expandable detail per
 * question (inline in the "Soalan" cell from `md`, a card list below). Row numbers restart at 1 in the
 * shown order; no match shows no rows and no message.
 */
import { computed, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import { DsDataTable, DsEmptyState, DsFilterBar, DsPanel } from '@/ds'
import { useMedia } from '@/ds/useMedia'
import { formatNumber } from '@/lib/number'

import type { ItemAnalysis } from '../../api/types'
import { usePhIcon } from '../../lib/icons'
import { LEVEL_BADGE, LEVEL_ICON } from '../../lib/prestasi/format'
import {
  SORT_OPTIONS,
  accuracyClass,
  filterRows,
  index2,
  sortRows,
  topicLine,
  type SortKey,
} from '../../lib/prestasi/item-analysis'


import DifficultyDetail from './DifficultyDetail.vue'

const props = defineProps<{ analysis: ItemAnalysis }>()

const icon = usePhIcon()
const wide = useMedia('(min-width: 768px)')

const search = ref('')
const sort = ref<SortKey>('difficulty_desc')
const open = ref<ReadonlySet<number>>(new Set())

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
    accuracyText: `${formatNumber(r.accuracy, { decimals: 1 })}%`,
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
  sort.value = 'difficulty_desc'
}
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

      <DsDataTable
        v-if="wide"
        :data="rows"
        :columns="columns"
        caption="Indeks kesukaran soalan"
        :page-size="1000"
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
        <li v-for="r in rows" :key="r.questionId" :data-testid="`difficulty-group-${r.questionId}`">
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
    </template>
  </div>
</template>
