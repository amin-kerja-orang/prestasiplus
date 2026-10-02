<script setup lang="ts">
/**
 * S11 "Indeks Kesukaran" tab (FR-M08-67…70): search, sort, the table with one expandable detail row per
 * question. Row numbers restart at 1 in the shown order; no match shows no rows and no message.
 */
import { ChevronDown, Frown, Meh, Smile, TriangleAlert, User, Users } from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { formatNumber } from '@/lib/number'

import type { ItemAnalysis } from '../../api/types'
import { LEVEL_PILL } from '../../lib/prestasi/format'
import {
  SORT_OPTIONS,
  accuracyClass,
  filterRows,
  index2,
  sortRows,
  topicLine,
  type SortKey,
} from '../../lib/prestasi/item-analysis'

const props = defineProps<{ analysis: ItemAnalysis }>()

const search = ref('')
const sort = ref<SortKey>('difficulty_desc')
const open = ref<ReadonlySet<number>>(new Set())

const rows = computed(() =>
  sortRows(filterRows(props.analysis.difficulty, search.value), sort.value),
)

function toggle(id: number): void {
  const next = new Set(open.value)
  if (!next.delete(id)) next.add(id)
  open.value = next
}

const ICON = { Sukar: Frown, Sederhana: Meh, Mudah: Smile } as const
const FIELD =
  'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none sm:w-auto'
</script>

<template>
  <div class="space-y-4" data-testid="difficulty-tab">
    <section
      v-if="analysis.questionCount === 0"
      class="rounded-2xl bg-white py-10 text-center shadow"
      data-testid="difficulty-empty"
    >
      <p class="text-4xl">📥</p>
      <h3 class="mt-3 text-lg font-bold text-slate-800">Tiada Data Lagi</h3>
      <p class="mx-auto mt-1 max-w-md text-sm text-slate-500">
        Pelajar dalam kelas ini belum menjawab sebarang soalan lagi.
      </p>
    </section>

    <template v-else>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          v-model="search"
          type="text"
          placeholder="Cari soalan..."
          :class="[FIELD, 'sm:flex-1']"
          data-testid="difficulty-search"
        />
        <select v-model="sort" :class="FIELD" data-testid="difficulty-sort">
          <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>

      <DataTableCard :min-width="560">
        <table :class="T.table" data-testid="difficulty-table">
          <thead>
            <tr style="background: linear-gradient(90deg, #eef2ff, #e0e7ff)">
              <th :class="[T.th, 'text-indigo-800']">#</th>
              <th :class="[T.th, 'text-indigo-800']">Soalan</th>
              <th :class="[T.th, 'hidden text-indigo-800 sm:table-cell']">Subjek / Topik</th>
              <th :class="[T.th, 'text-center text-indigo-800']">Percubaan</th>
              <th :class="[T.th, 'text-center text-indigo-800']">Ketepatan</th>
              <th :class="[T.th, 'text-center text-indigo-800']">Indeks</th>
              <th :class="[T.th, 'text-center text-indigo-800']">Tahap</th>
            </tr>
          </thead>
          <tbody
            v-for="(r, i) in rows"
            :key="r.questionId"
            :data-testid="`difficulty-group-${r.questionId}`"
          >
            <tr
              :class="[T.row, 'cursor-pointer hover:bg-slate-50']"
              :data-testid="`difficulty-row-${r.questionId}`"
              @click="toggle(r.questionId)"
            >
              <td :class="[T.td, 'text-slate-400']">{{ i + 1 }}</td>
              <td :class="[T.td, 'max-w-xs min-w-44']">
                <div class="flex items-start gap-2">
                  <button
                    type="button"
                    class="min-w-0 flex-1 text-left"
                    :data-testid="`difficulty-toggle-${r.questionId}`"
                  >
                    <span class="line-clamp-2 font-medium break-words text-slate-800">{{
                      r.text
                    }}</span>
                    <span class="mt-0.5 block text-xs text-slate-500 sm:hidden">{{
                      topicLine(r)
                    }}</span>
                    <span class="mt-1 flex items-center gap-1 text-xs text-red-500"
                      ><Users class="h-3 w-3" />{{ r.wrongStudents.length }} pelajar salah</span
                    >
                  </button>
                  <ChevronDown
                    :class="[
                      'mt-1 h-4 w-4 shrink-0 text-slate-400 transition',
                      open.has(r.questionId) ? 'rotate-180' : '',
                    ]"
                  />
                </div>
              </td>
              <td :class="[T.td, 'hidden text-xs text-slate-600 sm:table-cell']">
                <span class="line-clamp-3">{{ topicLine(r) }}</span>
              </td>
              <td :class="[T.td, 'text-center']">
                {{ r.attempts }}
                <span class="block text-xs text-slate-400">{{ r.students }} pelajar</span>
              </td>
              <td :class="[T.td, 'text-center font-semibold', accuracyClass(r.accuracy)]">
                {{ formatNumber(r.accuracy, { decimals: 1 }) }}%
              </td>
              <td :class="[T.td, 'text-center font-mono']">{{ index2(r.index) }}</td>
              <td :class="[T.td, 'text-center']">
                <span
                  :class="[
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    LEVEL_PILL[r.level],
                  ]"
                >
                  <component :is="ICON[r.level]" class="h-3.5 w-3.5" />{{ r.level }}
                </span>
              </td>
            </tr>
            <tr v-if="open.has(r.questionId)" :data-testid="`difficulty-detail-${r.questionId}`">
              <td colspan="7" class="px-4 py-3" style="background: rgb(255, 245, 245)">
                <div class="space-y-3 text-sm">
                  <div class="rounded-lg p-3" style="background: #dcfce7">
                    <p class="text-xs font-semibold text-green-800">Jawapan Betul</p>
                    <p class="mt-1 text-slate-800">
                      <span
                        class="mr-2 inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white"
                        style="background: #16a34a"
                        >{{ r.correctOption.letter }}</span
                      >{{ r.correctOption.text }}
                    </p>
                  </div>
                  <div v-if="r.popularWrong" class="rounded-lg p-3" style="background: #fef3c7">
                    <p class="text-xs font-semibold text-amber-800">
                      Jawapan Salah Popular ({{ r.popularWrong.times }}x dipilih)
                    </p>
                    <p class="mt-1 text-slate-800">
                      <span
                        class="mr-2 inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white"
                        style="background: #d97706"
                        >{{ r.popularWrong.letter }}</span
                      >{{ r.popularWrong.text }}
                    </p>
                  </div>
                  <div v-if="r.wrongStudents.length > 0">
                    <p class="mb-2 flex items-center gap-1 text-xs font-semibold text-slate-600">
                      <TriangleAlert class="h-3.5 w-3.5" />Pelajar Yang Salah
                    </p>
                    <div class="flex flex-wrap gap-2">
                      <RouterLink
                        v-for="s in r.wrongStudents"
                        :key="s.userId"
                        :to="`/prestasi/${s.userId}`"
                        class="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs"
                        style="background: #fee2e2; color: #991b1b"
                      >
                        <User class="h-3.5 w-3.5" />{{ s.name }}
                        <span class="rounded-full px-1.5" style="background: #fecaca"
                          >{{ s.times }}x salah</span
                        >
                      </RouterLink>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </DataTableCard>
    </template>
  </div>
</template>
