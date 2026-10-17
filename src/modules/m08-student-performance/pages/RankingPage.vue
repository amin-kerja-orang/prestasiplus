<script setup lang="ts">
/**
 * S19 `/ranking` "Kedudukan" (M08-T4; FR-M08-108..112, BR-M08-27, DV-22, DV-23; FN-M08-7.1.*).
 *
 * - Hero "Kedudukan" with the scope label (Nasional, Negeri, Daerah, Sekolah, or the chosen state);
 *   the tab title is "Kedudukan {x}" (DV-22).
 * - Four scope pills in a scrolling row; each keeps the non-empty filters. An unknown `scope` activates
 *   no pill and ranks nationally.
 * - GET form: Subjek, Tingkatan and (negeri / daerah scopes) Negeri, submitting on change.
 * - Ranked rows (12-column grid) or the empty state; the footer only on the nasional scope.
 * - Names are plain text: the ranking entries are not linked (FR-M08-112), and a row without a user id
 *   must never become a `/pelajar/null` link.
 * - The query string is the state (a GET form on live).
 */
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, usePageMeta } from '@/composables'
import { DsEmptyState, DsPage } from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchRankings } from '../api/performance'
import {
  MEDALS,
  RANKING_PATH,
  SCOPE_PILLS,
  TINGKATAN_OPTIONS,
  activeScope,
  apiQuery,
  formQuery,
  readRankingState,
  scopeLabel,
  scopeQuery,
  tabTitle,
} from '../lib/ranking'
import { fetchSubjectOptions } from '../lib/subject-options'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()

const state = computed(() => readRankingState(route.query))
const active = computed(() => activeScope(state.value.scope))
const label = computed(() => scopeLabel(state.value))

const { data, error, reload } = useApi(
  (signal) => fetchRankings(apiQuery(state.value), { signal }),
  () => route.fullPath,
)
const { data: subjects } = useApi((signal) => fetchSubjectOptions(signal))

watchEffect(() => {
  pageMeta.setTitle(tabTitle(state.value))
})

const firstLoad = computed(() => data.value === null && error.value === null)
const rows = computed(() => data.value?.rows ?? [])
const footer = computed(() =>
  data.value?.showFooter === true ? { total: data.value.total } : null,
)
const showNegeri = computed(() => active.value === 'negeri' || active.value === 'daerah')
/** The hidden `scope` of the form: what the URL says, else the default. */
const formScope = computed(() => (state.value.scope === '' ? 'nasional' : state.value.scope))

const subjectId = ref(state.value.subjectId)
const tingkatan = ref(state.value.tingkatan)
const negeri = ref(state.value.negeri)
watch(state, (s) => {
  subjectId.value = s.subjectId
  tingkatan.value = s.tingkatan
  negeri.value = s.negeri
})

function submitForm(): void {
  void router.push({
    path: RANKING_PATH,
    query: formQuery(
      { subjectId: subjectId.value, tingkatan: tingkatan.value, negeri: negeri.value },
      formScope.value,
    ),
  })
}

const PILL_ICONS: Record<string, string> = {
  nasional: 'i-ph-globe',
  negeri: 'i-ph-map-pin-area',
  daerah: 'i-ph-map-pin',
  sekolah: 'i-ph-student',
}

/** A select cannot hold an empty value, so "no filter" travels as `all` and is query-less. */
const ALL = 'all'
const subjectItems = computed(() => [
  { label: 'Semua Subjek', value: ALL },
  ...(subjects.value ?? []).map((s) => ({ label: s.name, value: String(s.id) })),
])
const tingkatanItems = TINGKATAN_OPTIONS.map((o) => ({
  label: o.label,
  value: o.value === '' ? ALL : o.value,
}))
const negeriItems = computed(() => [
  { label: 'Pilih Negeri', value: ALL },
  ...(data.value?.states ?? []).map((n) => ({ label: n, value: n })),
])

function bindFilter(target: typeof subjectId) {
  return computed({
    get: () => (target.value === '' ? ALL : target.value),
    set: (v: string | undefined) => {
      target.value = v === undefined || v === ALL ? '' : v
      submitForm()
    },
  })
}
const subjectModel = bindFilter(subjectId)
const tingkatanModel = bindFilter(tingkatan)
const negeriModel = bindFilter(negeri)

</script>

<template>
  <DsPage title="Kedudukan" data-testid="ranking-page">
    <p class="-mt-3 text-body text-muted" data-testid="ranking-subtitle">{{ label }}</p>

    <!-- Scope pills -->
    <nav class="flex gap-2 overflow-x-auto pb-1" data-testid="ranking-pills">
      <UButton
        v-for="pill in SCOPE_PILLS"
        :key="pill.id"
        :to="{ path: RANKING_PATH, query: scopeQuery(state, pill.id) }"
        :color="active === pill.id ? 'primary' : 'neutral'"
        :variant="active === pill.id ? 'solid' : 'soft'"
        :icon="PILL_ICONS[pill.id]"
        :label="pill.label"
        size="lg"
        class="shrink-0"
        :data-testid="`ranking-pill-${pill.id}`"
        :data-active="active === pill.id ? 'true' : 'false'"
      />
    </nav>

    <!-- Filters (GET form) -->
    <UCard data-testid="ranking-filter">
      <form
        method="get"
        :action="RANKING_PATH"
        :class="showNegeri ? 'grid grid-cols-1 gap-4 sm:grid-cols-3' : 'grid grid-cols-2 gap-4'"
        @submit.prevent="submitForm"
      >
        <UFormField label="Subjek" for="ranking-subject" class="min-w-0">
          <USelect
            id="ranking-subject"
            v-model="subjectModel"
            name="subject_id"
            :items="subjectItems"
            size="lg"
            class="w-full"
            data-testid="ranking-subject"
          />
        </UFormField>
        <UFormField label="Tingkatan" for="ranking-tingkatan" class="min-w-0">
          <USelect
            id="ranking-tingkatan"
            v-model="tingkatanModel"
            name="tingkatan"
            :items="tingkatanItems"
            size="lg"
            class="w-full"
            data-testid="ranking-tingkatan"
          />
        </UFormField>
        <UFormField v-if="showNegeri" label="Negeri" for="ranking-negeri" class="min-w-0">
          <USelect
            id="ranking-negeri"
            v-model="negeriModel"
            name="negeri"
            :items="negeriItems"
            size="lg"
            class="w-full"
            data-testid="ranking-negeri"
          />
        </UFormField>
      </form>
    </UCard>

    <!-- Error -->
    <div v-if="error" class="flex flex-col items-start gap-3" data-testid="ranking-error">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        role="alert"
        :title="LOAD_ERROR"
        class="w-full"
      />
      <UButton
        color="neutral"
        variant="soft"
        size="lg"
        label="Cuba Semula"
        data-testid="ranking-retry"
        @click="reload()"
      />
    </div>

    <!-- Loading -->
    <div
      v-else-if="firstLoad"
      class="flex flex-col gap-2"
      aria-busy="true"
      data-testid="ranking-loading"
    >
      <USkeleton v-for="n in 3" :key="n" class="h-12 w-full" />
    </div>

    <!-- Empty -->
    <div v-else-if="rows.length === 0" data-testid="ranking-empty">
      <DsEmptyState
        title="Tiada data kedudukan"
        description="Mula menjawab soalan untuk muncul di papan kedudukan!"
        icon="i-ph-trophy"
        friend="aiman"
      >
        <template #actions>
          <UButton to="/practice" label="Mula Latihan" size="lg" data-testid="ranking-start" />
        </template>
      </DsEmptyState>
      <span class="sr-only">🏆</span>
    </div>

    <!-- List -->
    <UCard v-else :ui="{ body: 'p-0 sm:p-0' }" data-testid="ranking-list">
      <div role="table" aria-label="Kedudukan">
        <div
          role="row"
          class="grid grid-cols-12 items-center gap-2 bg-elevated px-3 py-3 text-overline text-muted sm:gap-3 sm:px-4"
          data-testid="ranking-head"
        >
          <div role="columnheader" class="col-span-1 text-center">#</div>
          <div role="columnheader" class="col-span-5">Pelajar</div>
          <div role="columnheader" class="col-span-2 text-center">Tahap</div>
          <div role="columnheader" class="col-span-2 text-center sm:col-span-2">Betul</div>
          <div role="columnheader" class="col-span-2 text-center sm:col-span-2">Tepat</div>
        </div>
        <div
          v-for="row in rows"
          :key="row.rank"
          role="row"
          class="grid min-h-14 grid-cols-12 items-center gap-2 px-3 py-3 odd:bg-soft sm:gap-3 sm:px-4"
          data-testid="ranking-row"
        >
          <div role="cell" class="col-span-1 flex justify-center" data-testid="ranking-rank">
            <UBadge
              v-if="MEDALS[row.rank]"
              color="primary"
              variant="solid"
              :label="MEDALS[row.rank]?.emoji"
            />
            <span v-else class="tabular text-label text-muted">{{ row.rank }}</span>
          </div>
          <div role="cell" class="col-span-5 min-w-0">
            <p class="truncate text-label text-highlighted" data-testid="ranking-name">
              {{ row.name }}
            </p>
            <p class="truncate text-caption text-muted" data-testid="ranking-school">
              {{ row.schoolName }}
            </p>
          </div>
          <div role="cell" class="col-span-2 text-center">
            <UBadge color="neutral" variant="subtle" size="sm" data-testid="ranking-tahap"
              >L{{ row.tahap }}</UBadge
            >
          </div>
          <div
            role="cell"
            class="tabular col-span-2 text-center text-label text-highlighted"
            data-testid="ranking-betul"
          >
            {{ formatNumber(row.correct) }}
          </div>
          <div
            role="cell"
            class="tabular col-span-2 text-center text-label"
            :class="row.accuracy >= 50 ? 'text-success' : 'text-error'"
            data-testid="ranking-tepat"
          >
            {{ row.accuracy.toFixed(2) }}%
          </div>
        </div>
        <div
          v-if="footer"
          class="bg-elevated px-4 py-3 text-center text-caption text-muted"
          data-testid="ranking-footer"
        >
          Menunjukkan {{ rows.length }} dari {{ footer.total }} pelajar
        </div>
      </div>
    </UCard>
  </DsPage>
</template>
