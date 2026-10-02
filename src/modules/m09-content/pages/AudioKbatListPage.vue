<script setup lang="ts">
/**
 * S21 `/audio-kbat` "Audio KBAT" (M09; FR-M09-72..74, student, user shell). Header title only, no
 * subtitle (DV-M09-08). Dark gradient hero with readable text (DV-M09-09), GET filter (level, subject
 * A–Z, "Tapis" slate-900 with white text; values kept from the URL), approved sets only. Empty:
 * `fa-headphones` "Belum ada set Audio KBAT yang approved.". Each set links to the provisional player
 * (L-3: title, level, subject).
 */
import { Headphones, Search } from '@lucide/vue'
import { computed, reactive, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchAudioSets } from '../api'
import type { AudioSetListQuery } from '../api'
import { fetchLevelOptions, fetchSubjectOptions } from '../api/admin-media'
import { COPY } from '../lib/admin-media/common'
import {
  AUDIO_KBAT_PATH,
  AUDIO_KBAT_ROUTES,
  LIST_COPY,
  queryId,
  queryString,
  sortByName,
} from '../lib/audio-kbat'

const route = useRoute()
const router = useRouter()

const { data: levels } = useApi((signal) => fetchLevelOptions({ signal }))
const { data: subjects } = useApi((signal) => fetchSubjectOptions({ signal }))
const subjectOptions = computed(() => sortByName(subjects.value?.data ?? []))

/** The URL filter (live names `education_level_id`, `subject_id`). */
const applied = computed(() => ({
  education_level_id: queryString(route.query.education_level_id),
  subject_id: queryString(route.query.subject_id),
}))

const filter = reactive({ ...applied.value })
watch(applied, (next) => Object.assign(filter, next))

function apiQuery(): AudioSetListQuery {
  const q: AudioSetListQuery = {}
  const level = queryId(route.query.education_level_id)
  const subject = queryId(route.query.subject_id)
  if (level !== undefined) q.educationLevelId = level
  if (subject !== undefined) q.subjectId = subject
  return q
}

const { data, error, loading } = useApi(
  (signal) => fetchAudioSets(apiQuery(), { signal }),
  () => route.fullPath,
)

/** The filter is a GET form: "Tapis" goes to the same path with the non-empty values. */
function apply(): void {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(filter)) if (value !== '') query[key] = value
  void router.push({ path: AUDIO_KBAT_PATH, query })
}

const CONTROL =
  'min-h-11 w-full min-w-0 rounded-xl border-0 bg-transparent px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-amber-400'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="audio-kbat-page">
    <section
      class="rounded-3xl bg-gradient-to-br from-slate-950 via-amber-900 to-orange-700 p-6 text-white shadow-xl sm:p-8"
      data-testid="audio-intro"
    >
      <span
        class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"
      >
        <Headphones class="h-3.5 w-3.5" aria-hidden="true" />
        {{ LIST_COPY.pill }}
      </span>
      <h1 class="mt-3 font-heading text-3xl font-extrabold text-inherit sm:text-4xl">
        {{ LIST_COPY.title }}
      </h1>
      <p class="mt-2 max-w-3xl text-sm text-amber-100 sm:text-base">{{ LIST_COPY.intro }}</p>
    </section>

    <form
      method="get"
      class="grid grid-cols-1 gap-2 rounded-2xl bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]"
      data-testid="audio-filter"
      @submit.prevent="apply"
    >
      <select
        v-model="filter.education_level_id"
        name="education_level_id"
        :class="CONTROL"
        data-testid="filter-level"
      >
        <option value="">Semua Tahap</option>
        <option v-for="level in levels?.data ?? []" :key="level.id" :value="String(level.id)">
          {{ level.name }}
        </option>
      </select>
      <select
        v-model="filter.subject_id"
        name="subject_id"
        :class="CONTROL"
        data-testid="filter-subject"
      >
        <option value="">Semua Subjek</option>
        <option v-for="subject in subjectOptions" :key="subject.id" :value="String(subject.id)">
          {{ subject.name }}
        </option>
      </select>
      <button
        type="submit"
        class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 sm:col-span-2 lg:col-span-1 lg:w-auto"
        data-testid="filter-submit"
      >
        <Search class="h-4 w-4" aria-hidden="true" />
        Tapis
      </button>
    </form>

    <AlertBox v-if="error" :messages="COPY.loadFailed" data-testid="audio-error" />

    <div
      v-else-if="loading && !data"
      class="flex justify-center rounded-2xl bg-white px-4 py-14 text-slate-400 shadow-sm"
      role="status"
      data-testid="audio-loading"
    >
      <LoadingSpinner :size="24" />
    </div>

    <div
      v-else-if="data && data.data.length === 0"
      class="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-14 text-slate-400 shadow-sm"
      data-testid="audio-empty"
    >
      <Headphones class="h-8 w-8 shrink-0" aria-hidden="true" />
      <span>{{ LIST_COPY.empty }}</span>
    </div>

    <ul v-else-if="data" class="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="audio-sets">
      <li v-for="set in data.data" :key="set.id" class="min-w-0" data-testid="audio-set">
        <RouterLink
          :to="{ name: AUDIO_KBAT_ROUTES.player, params: { id: set.id } }"
          class="flex min-h-11 items-start gap-3 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          data-testid="set-link"
        >
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"
          >
            <Headphones class="h-5 w-5" aria-hidden="true" />
          </span>
          <span class="min-w-0">
            <span class="block font-semibold break-words text-slate-800" data-testid="set-title">
              {{ set.title }}
            </span>
            <span class="mt-0.5 block text-xs text-slate-500">
              <span data-testid="set-level">{{ set.educationLevel.name }}</span>
              ·
              <span data-testid="set-subject">{{ set.subject.name }}</span>
            </span>
          </span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
