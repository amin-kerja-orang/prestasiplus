<script setup lang="ts">
/**
 * S21 `/guru/soalan` "Sumbang Soalan" (M10-T6; FR-M10-91..98, 129): contribution stats, tiers and
 * subject breakdown (#51), CSV import, Audio KBAT and AI cards, "Soalan Saya" (#52, 20 per page,
 * `?page=`) with edit / delete (#56), and "Hantar Kertas Soalan kepada Admin". The list and the stats
 * reload after a delete or an import.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { useApi, useFlash, usePrototypeScope } from '@/composables'
import { DsPage, useConfirm } from '@/ds'

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
const confirm = useConfirm()
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
  if (deleting.value || !(await confirm({ message: COPY.confirmDelete(id), tone: 'danger' })))
    return
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

/** Pager line, BM copy of the design-system table pager (range shown, then the total). */
const pagerText = computed(() => {
  const meta = list.data.value?.meta
  const rows = list.data.value?.data.length ?? 0
  if (!meta) return ''
  const from = rows === 0 ? 0 : (page.value - 1) * meta.pageSize + 1
  const to = rows === 0 ? 0 : (page.value - 1) * meta.pageSize + rows
  return `Menunjukkan ${String(from)}-${String(to)} daripada ${String(meta.totalItems)} hasil`
})

const retry = (): void => {
  void summary.reload()
  void list.reload()
}
</script>

<template>
  <DsPage data-testid="soalan-page">
    <UCard v-if="summary.error.value" data-testid="soalan-error">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle-duotone"
        :title="COPY.loadFailed"
        role="alert"
      />
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        class="mt-3 min-h-11"
        data-testid="soalan-retry"
        @click="retry"
        >{{ COPY.retry }}</UButton
      >
    </UCard>
    <div
      v-else-if="!summary.data.value"
      class="grid grid-cols-2 gap-3 md:grid-cols-4"
      aria-busy="true"
      data-testid="soalan-loading"
    >
      <USkeleton v-for="n in 4" :key="n" class="h-28 w-full" />
    </div>
    <ContributionSummary v-else :summary="summary.data.value" />

    <ImportCard @imported="onImported" />
    <AudioKbatCard v-if="allows('/guru/audio-kbat')" />

    <section class="flex min-w-0 flex-col gap-3" data-testid="soalan-saya">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-heading text-highlighted">Soalan Saya</h2>
        <UButton
          to="/guru/soalan/cipta"
          icon="i-ph-plus-circle-duotone"
          class="min-h-11"
          data-testid="soalan-add"
          >Tambah Soalan</UButton
        >
      </div>

      <UAlert
        v-if="deleteError.length"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle-duotone"
        role="alert"
        data-testid="soalan-delete-error"
      >
        <template #description>
          <p v-for="(m, i) in deleteError" :key="i">{{ m }}</p>
        </template>
      </UAlert>

      <UCard v-if="list.error.value" data-testid="soalan-list-error">
        <UAlert
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle-duotone"
          :title="COPY.loadFailed"
          role="alert"
        />
      </UCard>
      <div v-else-if="!list.data.value" class="flex flex-col gap-3" aria-busy="true">
        <USkeleton v-for="n in 3" :key="n" class="h-20 w-full" />
      </div>
      <template v-else>
        <UCard v-if="list.data.value.data.length === 0 && page === 1" data-testid="soalan-empty">
          <div class="flex flex-col items-center gap-2 py-6 text-center">
            <UIcon name="i-ph-note-pencil-duotone" class="size-12 text-dimmed" />
            <p class="text-body text-muted">{{ COPY.listEmpty }}</p>
          </div>
        </UCard>
        <ul v-else class="grid min-w-0 grid-cols-1 gap-3" data-testid="soalan-list">
          <QuestionCard
            v-for="q in list.data.value.data"
            :key="q.id"
            :question="q"
            :deleting="deleting"
            @remove="remove"
          />
        </ul>
        <div
          v-if="list.data.value.meta.totalItems > list.data.value.meta.pageSize"
          class="flex flex-wrap items-center justify-between gap-3"
          data-testid="soalan-pager"
        >
          <p class="text-caption text-muted" role="status" data-testid="soalan-pager-text">
            {{ pagerText }}
          </p>
          <UPagination
            :page="page"
            :total="list.data.value.meta.totalItems"
            :items-per-page="list.data.value.meta.pageSize"
            :prev="{ 'aria-label': 'Sebelum' }"
            :next="{ 'aria-label': 'Seterusnya' }"
            @update:page="go"
          />
        </div>
      </template>
    </section>

    <HantarKertasCard />
  </DsPage>
</template>
