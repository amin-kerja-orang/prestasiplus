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
import { Globe, MapPin, MapPinned, School, Trophy } from '@lucide/vue'
import { computed, ref, watch, watchEffect, type Component } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { FORM_SELECT_CLASS } from '@/components/form'
import { useApi, usePageMeta } from '@/composables'
import { formatNumber } from '@/lib/number'

import { fetchRankings } from '../api/performance'
import {
  MEDALS,
  RANKING_PATH,
  SCOPE_PILLS,
  TINGKATAN_OPTIONS,
  accuracyClass,
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

const PILL_ICONS: Record<string, Component> = {
  nasional: Globe,
  negeri: MapPinned,
  daerah: MapPin,
  sekolah: School,
}

const GRID = 'grid grid-cols-12 items-center gap-2 px-3 sm:gap-3 sm:px-4'
</script>

<template>
  <div class="space-y-4 sm:space-y-5" data-testid="ranking-page">
    <!-- Hero -->
    <section
      class="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-5 text-white shadow-lg sm:p-6"
      data-testid="ranking-hero"
    >
      <div
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 sm:h-14 sm:w-14"
      >
        <Trophy class="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
      </div>
      <div class="min-w-0">
        <h1 class="font-heading text-2xl font-bold text-white sm:text-3xl">Kedudukan</h1>
        <p class="truncate text-sm text-white/80" data-testid="ranking-subtitle">{{ label }}</p>
      </div>
    </section>

    <!-- Scope pills -->
    <nav class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-testid="ranking-pills">
      <RouterLink
        v-for="pill in SCOPE_PILLS"
        :key="pill.id"
        :to="{ path: RANKING_PATH, query: scopeQuery(state, pill.id) }"
        :class="[
          'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap shadow-sm transition',
          active === pill.id
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-slate-700 hover:bg-slate-50',
        ]"
        :data-testid="`ranking-pill-${pill.id}`"
        :data-active="active === pill.id ? 'true' : 'false'"
      >
        <component :is="PILL_ICONS[pill.id]" class="h-4 w-4" aria-hidden="true" />
        {{ pill.label }}
      </RouterLink>
    </nav>

    <!-- Filters (GET form) -->
    <form
      method="get"
      :action="RANKING_PATH"
      :class="[
        'grid gap-3 rounded-2xl bg-white p-4 shadow sm:gap-4 sm:p-5',
        showNegeri ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2',
      ]"
      data-testid="ranking-filter"
      @submit.prevent="submitForm"
    >
      <input type="hidden" name="scope" :value="formScope" />
      <div class="min-w-0">
        <label for="ranking-subject" class="mb-1 block text-xs text-slate-500">Subjek</label>
        <select
          id="ranking-subject"
          v-model="subjectId"
          name="subject_id"
          :class="[FORM_SELECT_CLASS, 'min-h-11']"
          data-testid="ranking-subject"
          @change="submitForm"
        >
          <option value="">Semua Subjek</option>
          <option v-for="s in subjects ?? []" :key="s.id" :value="String(s.id)">
            {{ s.name }}
          </option>
        </select>
      </div>
      <div class="min-w-0">
        <label for="ranking-tingkatan" class="mb-1 block text-xs text-slate-500">Tingkatan</label>
        <select
          id="ranking-tingkatan"
          v-model="tingkatan"
          name="tingkatan"
          :class="[FORM_SELECT_CLASS, 'min-h-11']"
          data-testid="ranking-tingkatan"
          @change="submitForm"
        >
          <option v-for="o in TINGKATAN_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
      </div>
      <div v-if="showNegeri" class="min-w-0">
        <label for="ranking-negeri" class="mb-1 block text-xs text-slate-500">Negeri</label>
        <select
          id="ranking-negeri"
          v-model="negeri"
          name="negeri"
          :class="[FORM_SELECT_CLASS, 'min-h-11']"
          data-testid="ranking-negeri"
          @change="submitForm"
        >
          <option value="">Pilih Negeri</option>
          <option v-for="n in data?.states ?? []" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
    </form>

    <!-- Error -->
    <div v-if="error" class="space-y-3" data-testid="ranking-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
        data-testid="ranking-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <!-- Loading -->
    <div
      v-else-if="firstLoad"
      class="space-y-2 rounded-2xl bg-white p-4 shadow"
      data-testid="ranking-loading"
    >
      <div v-for="n in 3" :key="n" class="h-10 animate-pulse rounded-lg bg-slate-100"></div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="rows.length === 0"
      class="rounded-2xl bg-white px-4 py-12 text-center shadow"
      data-testid="ranking-empty"
    >
      <div class="text-5xl" aria-hidden="true">🏆</div>
      <h2 class="mt-3 font-heading text-lg font-bold text-slate-700">Tiada data kedudukan</h2>
      <p class="mt-1 text-sm text-slate-500">
        Mula menjawab soalan untuk muncul di papan kedudukan!
      </p>
      <RouterLink
        to="/practice"
        class="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        data-testid="ranking-start"
      >
        Mula Latihan
      </RouterLink>
    </div>

    <!-- List -->
    <div v-else class="overflow-hidden rounded-2xl bg-white shadow" data-testid="ranking-list">
      <div
        :class="[
          GRID,
          'border-b border-slate-900 bg-slate-50 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase',
        ]"
        data-testid="ranking-head"
      >
        <div class="col-span-1 text-center">#</div>
        <div class="col-span-5">Pelajar</div>
        <div class="col-span-2 text-center">Tahap</div>
        <div class="col-span-2 text-center sm:col-span-2">Betul</div>
        <div class="col-span-2 text-center sm:col-span-2">Tepat</div>
      </div>
      <div
        v-for="row in rows"
        :key="row.rank"
        :class="[GRID, 'border-b border-slate-900 py-3']"
        data-testid="ranking-row"
      >
        <div
          class="col-span-1 text-center text-base font-bold text-slate-500 sm:text-lg"
          data-testid="ranking-rank"
        >
          <span v-if="MEDALS[row.rank]" :class="MEDALS[row.rank]?.cls">{{
            MEDALS[row.rank]?.emoji
          }}</span>
          <template v-else>{{ row.rank }}</template>
        </div>
        <div class="col-span-5 min-w-0">
          <p class="truncate text-sm font-semibold text-slate-800" data-testid="ranking-name">
            {{ row.name }}
          </p>
          <p class="truncate text-xs text-slate-400" data-testid="ranking-school">
            {{ row.schoolName }}
          </p>
        </div>
        <div class="col-span-2 text-center">
          <span
            class="inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700"
            data-testid="ranking-tahap"
            >L{{ row.tahap }}</span
          >
        </div>
        <div
          class="col-span-2 text-center text-xs font-bold text-slate-800 sm:text-sm"
          data-testid="ranking-betul"
        >
          {{ formatNumber(row.correct) }}
        </div>
        <div
          :class="[
            'col-span-2 text-center text-xs font-semibold sm:text-sm',
            accuracyClass(row.accuracy),
          ]"
          data-testid="ranking-tepat"
        >
          {{ row.accuracy.toFixed(2) }}%
        </div>
      </div>
      <div
        v-if="footer"
        class="bg-gray-50 px-4 py-3 text-center text-xs text-gray-400"
        data-testid="ranking-footer"
      >
        Menunjukkan {{ rows.length }} dari {{ footer.total }} pelajar
      </div>
    </div>
  </div>
</template>
