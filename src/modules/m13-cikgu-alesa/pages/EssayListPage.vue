<script setup lang="ts">
/**
 * S4 `/cikgu/essay` essay list (FR-M13-49, 50, 37; URS FT-M13-4.1; M13-T4). Same frame as S2; the
 * "Markah" column is centred; rows are PROPOSED.
 */
import { Plus } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { DataTableCard, LaravelPager, TABLE_CLASSES as T } from '@/components/data'
import { useApi } from '@/composables'

import { fetchEssayList } from '../api'
import { ESSAY_COPY as C } from '../components/teacher/copy'
import { orDash, pageOf, rubricShort } from '../components/teacher/lib'
import PageState from '../components/teacher/PageState.vue'

const route = useRoute()
const router = useRouter()
const page = computed(() => pageOf(route.query.page))

const { data, error, reload } = useApi((signal) => fetchEssayList(page.value, { signal }), page)

function goToPage(next: number): void {
  void router.push({ path: '/cikgu/essay', query: { page: String(next) } })
}

const CTA =
  'inline-flex min-h-11 min-w-0 shrink items-center justify-center gap-2 rounded-lg bg-purple-500 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-purple-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="essay-list-page">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="font-heading text-2xl font-bold text-slate-800">{{ C.title }}</h1>
        <p class="text-sm text-slate-500">{{ C.sub }}</p>
      </div>
      <RouterLink to="/cikgu/essay/baharu" :class="CTA" data-testid="essay-create">
        <Plus class="h-4 w-4 shrink-0" />{{ C.create }}
      </RouterLink>
    </div>

    <PageState
      :loaded="data !== null"
      :error="error !== null"
      :message="C.loadFailed"
      :retry-label="C.retry"
      @retry="reload"
    >
      <DataTableCard v-if="data" :min-width="640">
        <table :class="T.table" data-testid="essay-table">
          <thead class="bg-slate-50">
            <tr>
              <th
                v-for="(h, i) in C.headers"
                :key="h"
                :class="[T.th, i === 3 && 'text-center', i === 4 && 'text-right']"
              >
                {{ h }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="data.data.length === 0" data-testid="essay-empty">
              <td colspan="5" class="px-4 py-12 text-center text-slate-400">{{ C.empty }}</td>
            </tr>
            <tr v-for="row in data.data" :key="row.id" :class="T.row" data-testid="essay-row">
              <td :class="T.td">{{ orDash(row.studentName) }}</td>
              <td :class="T.td">{{ orDash(row.subjectName) }} / {{ rubricShort(row.rubricKey) }}</td>
              <td :class="T.td">{{ orDash(row.essayTitle) }}</td>
              <td :class="[T.td, 'text-center whitespace-nowrap']">
                {{ row.marks }}/{{ row.maxMarks }}
              </td>
              <td :class="[T.td, 'text-right']">
                <RouterLink
                  :to="`/cikgu/essay/${String(row.id)}`"
                  class="inline-flex min-h-11 items-center px-2 font-medium text-purple-600 hover:underline"
                  >{{ C.view }}</RouterLink
                >
              </td>
            </tr>
          </tbody>
        </table>
      </DataTableCard>

      <div v-if="data" class="mt-4" data-testid="essay-pager">
        <LaravelPager
          :page="data.meta.page"
          :total="data.meta.totalItems"
          :per-page="data.meta.pageSize"
          path="/cikgu/essay"
          @change="goToPage"
        />
      </div>
    </PageState>
  </div>
</template>
