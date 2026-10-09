<script setup lang="ts">
/**
 * S2 `/cikgu/rph` RPH list (FR-M13-34..37; URS FT-M13-3.1; M13-T3). The header row never stacks (the
 * h1 wraps instead, as live); the table scrolls inside its card (DV-M13-04). Rows are PROPOSED.
 */
import { Bot } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { DataTableCard, LaravelPager, TABLE_CLASSES as T } from '@/components/data'
import { useApi } from '@/composables'

import { fetchRphList } from '../api'
import { RPH_COPY as C } from '../components/teacher/copy'
import { dmy, pageOf } from '../components/teacher/lib'
import PageState from '../components/teacher/PageState.vue'

const route = useRoute()
const router = useRouter()
const page = computed(() => pageOf(route.query.page))

const { data, error, reload } = useApi((signal) => fetchRphList(page.value, { signal }), page)

function goToPage(next: number): void {
  void router.push({ path: '/cikgu/rph', query: { page: String(next) } })
}

const CTA =
  'inline-flex min-h-11 min-w-0 shrink items-center justify-center gap-2 rounded-lg bg-linear-to-r from-purple-500 to-pink-500 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="rph-list-page">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="font-heading text-2xl font-bold text-slate-800">{{ C.title }}</h1>
        <p class="text-sm text-slate-500">{{ C.sub }}</p>
      </div>
      <RouterLink to="/cikgu/rph/baharu" :class="CTA" data-testid="rph-create">
        <Bot class="h-4 w-4 shrink-0" />{{ C.create }}
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
        <table :class="T.table" data-testid="rph-table">
          <thead class="bg-slate-50">
            <tr>
              <th v-for="(h, i) in C.headers" :key="h" :class="[T.th, i === 4 && 'text-right']">
                {{ h }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="data.data.length === 0" data-testid="rph-empty">
              <td colspan="5" class="px-4 py-12 text-center text-slate-400">
                {{ C.emptyBefore }}<em>{{ C.emptyExample }}</em
                >.
              </td>
            </tr>
            <tr v-for="row in data.data" :key="row.id" :class="T.row" data-testid="rph-row">
              <td :class="[T.td, 'whitespace-nowrap']">{{ dmy(row.lessonDate) }}</td>
              <td :class="T.td">{{ row.subjectName }} / {{ row.level }}</td>
              <td :class="T.td">{{ row.tajuk }}</td>
              <td :class="T.td">{{ C.statusGenerated }}</td>
              <td :class="[T.td, 'text-right']">
                <RouterLink
                  :to="`/cikgu/rph/${String(row.id)}`"
                  class="inline-flex min-h-11 items-center px-2 font-medium text-purple-600 hover:underline"
                  >{{ C.view }}</RouterLink
                >
              </td>
            </tr>
          </tbody>
        </table>
      </DataTableCard>

      <div v-if="data" class="mt-4" data-testid="rph-pager">
        <LaravelPager
          :page="data.meta.page"
          :total="data.meta.totalItems"
          :per-page="data.meta.pageSize"
          path="/cikgu/rph"
          @change="goToPage"
        />
      </div>
    </PageState>
  </div>
</template>
