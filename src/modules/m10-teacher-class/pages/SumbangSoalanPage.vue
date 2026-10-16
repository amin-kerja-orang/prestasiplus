<script setup lang="ts">
/**
 * S21 `/guru/soalan` "Sumbang Soalan" (M10-T6; FR-M10-91..98, 129): contribution stats, tiers and
 * subject breakdown (#51), CSV import, Audio KBAT and AI cards, "Soalan Saya" (#52, 20 per page,
 * `?page=`) with edit / delete (#56), and "Hantar Kertas Soalan kepada Admin". The list and the stats
 * reload after a delete or an import.
 */
import { Plus } from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { LaravelPager } from '@/components/data'
import { confirmNative, useApi, useFlash, usePrototypeScope } from '@/composables'

import {
  deleteContributedQuestion,
  fetchContributedQuestions,
  fetchContributions,
} from '../api/guru'
import AudioKbatCard from '../components/soalan/AudioKbatCard.vue'
import ContributionSummary from '../components/soalan/ContributionSummary.vue'
import HantarKertasCard from '../components/soalan/HantarKertasCard.vue'
import ImportCard from '../components/soalan/ImportCard.vue'
import { COPY } from '../components/soalan/lib'
import QuestionCard from '../components/soalan/QuestionCard.vue'

const route = useRoute()
const router = useRouter()
const flash = useFlash()
// Prototype scope (D43): the Audio KBAT card links to screens outside the matrix.
const { allows } = usePrototypeScope()

const page = computed(() => {
  const n = Number(route.query.page)
  return Number.isInteger(n) && n >= 1 ? n : 1
})

const summary = useApi((signal) => fetchContributions({ signal }))
const list = useApi((signal) => fetchContributedQuestions({ page: page.value }, { signal }), page)

const deleting = ref(false)
const deleteError = ref<string[]>([])

async function remove(id: number): Promise<void> {
  if (deleting.value || !confirmNative(COPY.confirmDelete(id))) return
  deleting.value = true
  deleteError.value = []
  try {
    await deleteContributedQuestion(id)
    flash.show({ type: 'success', message: COPY.deleted })
    await Promise.all([summary.reload(), list.reload()])
  } catch (err) {
    deleteError.value = [isApiError(err) ? err.message : COPY.saveFailed]
  } finally {
    deleting.value = false
  }
}

async function onImported(): Promise<void> {
  await Promise.all([summary.reload(), list.reload()])
}

function go(next: number): void {
  void router.push({ path: route.path, query: next > 1 ? { page: String(next) } : {} })
}

const retry = (): void => {
  void summary.reload()
  void list.reload()
}
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="soalan-page">
    <div
      v-if="summary.error.value"
      class="min-w-0 space-y-3 rounded-2xl bg-white p-4 shadow-sm"
      data-testid="soalan-error"
    >
      <AlertBox :messages="COPY.loadFailed" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
        data-testid="soalan-retry"
        @click="retry"
      >
        {{ COPY.retry }}
      </button>
    </div>
    <div
      v-else-if="!summary.data.value"
      class="flex justify-center rounded-2xl bg-white px-4 py-10 text-slate-400 shadow-sm"
      data-testid="soalan-loading"
    >
      <LoadingSpinner :size="24" />
    </div>
    <ContributionSummary v-else :summary="summary.data.value" />

    <ImportCard @imported="onImported" />
    <AudioKbatCard v-if="allows('/guru/audio-kbat')" />

    <section class="min-w-0 space-y-3" data-testid="soalan-saya">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-bold text-slate-800">Soalan Saya</h2>
        <RouterLink
          to="/guru/soalan/cipta"
          class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          data-testid="soalan-add"
        >
          <Plus class="h-4 w-4" />
          Tambah Soalan
        </RouterLink>
      </div>

      <AlertBox :messages="deleteError" data-testid="soalan-delete-error" />

      <div
        v-if="list.error.value"
        class="rounded-2xl bg-white p-4 shadow-sm"
        data-testid="soalan-list-error"
      >
        <AlertBox :messages="COPY.loadFailed" />
      </div>
      <div
        v-else-if="!list.data.value"
        class="flex justify-center rounded-2xl bg-white px-4 py-8 text-slate-400 shadow-sm"
      >
        <LoadingSpinner :size="24" />
      </div>
      <template v-else>
        <p
          v-if="list.data.value.data.length === 0 && page === 1"
          class="rounded-2xl bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm"
          data-testid="soalan-empty"
        >
          {{ COPY.listEmpty }}
        </p>
        <ul v-else class="grid min-w-0 grid-cols-1 gap-3" data-testid="soalan-list">
          <QuestionCard
            v-for="q in list.data.value.data"
            :key="q.id"
            :question="q"
            :deleting="deleting"
            @remove="remove"
          />
        </ul>
        <LaravelPager
          :page="page"
          :total="list.data.value.meta.totalItems"
          :per-page="list.data.value.meta.pageSize"
          :path="route.path"
          @change="go"
        />
      </template>
    </section>

    <HantarKertasCard />
  </div>
</template>
