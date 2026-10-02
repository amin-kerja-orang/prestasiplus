<script setup lang="ts">
/**
 * S12 `/admin/audio-kbat` "Set Audio KBAT" (M09; FR-M09-61..65, BR-M09-15). Admin shell, header title
 * only (no subtitle, DV-M09-08).
 *
 * - Intro pill "Ujian Mendengar", h1, "Template XLSX" / "Template Word" downloads and "Cipta Set".
 * - Guide box, four stat cards (always over every set, never filtered) and the GET filter (level,
 *   subject A–Z, status, search, "Tapis"; values kept from the URL).
 * - No set: `fa-headphones` "Belum ada set Audio KBAT." Sets: one neutral row each (title, level,
 *   subject, status label, question count); no row action (provisional, L-3).
 */
import { Headphones, Info, Plus, Search } from '@lucide/vue'
import { computed, reactive, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'

import {
  fetchAdminAudioSets,
  fetchLevelOptions,
  fetchSubjectOptions,
  type AdminAudioSetQuery,
  type AudioSetStatus,
} from '../api/admin-media'
import AudioTemplateLink from '../components/admin-media/AudioTemplateLink.vue'
import { FILTER_STATUS_OPTIONS, LIST_GUIDE, sortByName } from '../lib/admin-media/audio'
import { AUDIO_PATH, COPY, MEDIA_ROUTES, queryText } from '../lib/admin-media/common'

const route = useRoute()
const router = useRouter()

const { data: levels } = useApi((signal) => fetchLevelOptions({ signal }))
const { data: subjects } = useApi((signal) => fetchSubjectOptions({ signal }))
const subjectOptions = computed(() => sortByName(subjects.value?.data ?? []))

/** The URL filter (live names `education_level_id`, `subject_id`, `status`, `search`). */
const applied = computed(() => ({
  education_level_id: queryText(route.query.education_level_id),
  subject_id: queryText(route.query.subject_id),
  status: queryText(route.query.status),
  search: queryText(route.query.search),
}))

const filter = reactive({ ...applied.value })
watch(applied, (next) => Object.assign(filter, next))

/** FR-M09-65: no pager is asserted, so one request takes every set (the API maximum). */
const PAGE_SIZE = 100

function apiQuery(): AdminAudioSetQuery {
  const q: AdminAudioSetQuery = { pageSize: PAGE_SIZE }
  const level = Number(applied.value.education_level_id)
  const subject = Number(applied.value.subject_id)
  if (applied.value.education_level_id !== '' && Number.isFinite(level)) q.educationLevelId = level
  if (applied.value.subject_id !== '' && Number.isFinite(subject)) q.subjectId = subject
  if (applied.value.status !== '') q.status = applied.value.status as AudioSetStatus
  if (applied.value.search !== '') q.search = applied.value.search
  return q
}

const { data, error } = useApi(
  (signal) => fetchAdminAudioSets(apiQuery(), { signal }),
  () => route.fullPath,
)

const stats = computed(() => data.value?.meta.stats ?? null)

/** The filter is a GET form: "Tapis" goes to the same path with the non-empty values. */
function apply(): void {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(filter)) if (value !== '') query[key] = value
  void router.push({ path: AUDIO_PATH, query })
}

const CONTROL =
  'min-h-11 w-full min-w-0 rounded-xl border-0 bg-transparent px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-amber-400'

const STAT_CARDS = [
  { key: 'sets', label: 'Set', color: 'text-slate-900' },
  { key: 'approved', label: 'Approved', color: 'text-emerald-700' },
  { key: 'draftPending', label: 'Draft/Pending', color: 'text-amber-700' },
  { key: 'questions', label: 'Soalan', color: 'text-indigo-600' },
] as const
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="audio-list-page">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <span
          class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
        >
          <Headphones class="h-3.5 w-3.5" aria-hidden="true" />
          Ujian Mendengar
        </span>
        <h1 class="mt-2 font-heading text-3xl font-bold text-slate-900">Set Audio KBAT</h1>
        <p class="mt-1 text-sm text-slate-500">
          Senarai set soalan audio fixed sequence, bukan rawak.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <AudioTemplateLink kind="xlsx" />
        <AudioTemplateLink kind="word" />
        <RouterLink
          :to="{ name: MEDIA_ROUTES.audioCreate }"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold whitespace-nowrap text-white shadow transition hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          data-testid="audio-create"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
          Cipta Set
        </RouterLink>
      </div>
    </div>

    <div
      class="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
      data-testid="audio-guide"
    >
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-200 text-amber-800"
      >
        <Info class="h-4 w-4" aria-hidden="true" />
      </span>
      <div class="min-w-0 space-y-1.5 text-sm text-slate-700">
        <p class="font-semibold text-slate-900">{{ LIST_GUIDE.title }}</p>
        <p v-for="text in LIST_GUIDE.paragraphs" :key="text">{{ text }}</p>
      </div>
    </div>

    <AlertBox v-if="error" :messages="COPY.loadFailed" data-testid="audio-error" />

    <template v-else>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="audio-stats">
        <div
          v-for="card in STAT_CARDS"
          :key="card.key"
          class="rounded-2xl bg-white p-4 shadow-sm"
          :data-testid="`stat-${card.key}`"
        >
          <p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {{ card.label }}
          </p>
          <p :class="['mt-1 font-heading text-2xl font-bold', card.color]" data-testid="stat-value">
            {{ stats ? stats[card.key] : 0 }}
          </p>
        </div>
      </div>

      <form
        method="get"
        class="grid grid-cols-1 gap-2 rounded-2xl bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-6"
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
        <select v-model="filter.status" name="status" :class="CONTROL" data-testid="filter-status">
          <option value="">Semua Status</option>
          <option v-for="s in FILTER_STATUS_OPTIONS" :key="s.value" :value="s.value">
            {{ s.label }}
          </option>
        </select>
        <input
          v-model="filter.search"
          type="text"
          name="search"
          placeholder="Cari tajuk/sumber..."
          :class="[CONTROL, 'sm:col-span-2 lg:col-span-2']"
          data-testid="filter-search"
        />
        <button
          type="submit"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          data-testid="filter-submit"
        >
          <Search class="h-4 w-4" aria-hidden="true" />
          Tapis
        </button>
      </form>

      <div
        v-if="data && data.data.length === 0"
        class="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-14 text-slate-400 shadow-sm"
        data-testid="audio-empty"
      >
        <Headphones class="h-8 w-8" aria-hidden="true" />
        <span>Belum ada set Audio KBAT.</span>
      </div>

      <div v-else-if="data" class="min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm">
        <ul class="divide-y divide-slate-100" data-testid="audio-sets">
          <li
            v-for="set in data.data"
            :key="set.id"
            class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
            data-testid="audio-set"
            :data-set-id="set.id"
          >
            <div class="min-w-0">
              <p class="font-semibold break-words text-slate-800" data-testid="set-title">
                {{ set.title }}
              </p>
              <p class="text-xs text-slate-500">
                <span data-testid="set-level">{{ set.educationLevel.name }}</span>
                ·
                <span data-testid="set-subject">{{ set.subject.name }}</span>
              </p>
            </div>
            <div class="flex items-center gap-3 text-xs">
              <span
                class="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700"
                data-testid="set-status"
                >{{ set.statusLabel }}</span
              >
              <span class="text-slate-500" data-testid="set-questions"
                >{{ set.questionCount }} soalan</span
              >
            </div>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
