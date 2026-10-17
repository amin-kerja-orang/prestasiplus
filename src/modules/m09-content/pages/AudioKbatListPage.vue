<script setup lang="ts">
/**
 * S21 `/audio-kbat` "Audio KBAT" (M09; FR-M09-72..74, student, user shell). Header title only, no
 * subtitle (DV-M09-08). Intro, GET filter (level, subject A–Z, "Tapis"; values kept from the URL),
 * approved sets only. Empty: "Belum ada set Audio KBAT yang approved.". Each set links to the
 * provisional player (L-3: title, level, subject).
 *
 * v2 restyle (B04): `DsPage`, `DsFilterBar` with `USelect`s, compact rows with `DsIconChip`.
 */
import { computed, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsEmptyState, DsFilterBar, DsIconChip, DsPage } from '@/ds'

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

/** Reka selects cannot hold an empty value: `all` stands for "Semua". */
const ALL = 'all'
const levelItems = computed(() => [
  { label: 'Semua Tahap', value: ALL },
  ...(levels.value?.data ?? []).map((l) => ({ label: l.name, value: String(l.id) })),
])
const subjectItems = computed(() => [
  { label: 'Semua Subjek', value: ALL },
  ...subjectOptions.value.map((s) => ({ label: s.name, value: String(s.id) })),
])

/** The URL filter (live names `education_level_id`, `subject_id`). */
const applied = computed(() => ({
  education_level_id: queryString(route.query.education_level_id),
  subject_id: queryString(route.query.subject_id),
}))

const filter = reactive({ ...applied.value })
watch(applied, (next) => Object.assign(filter, next))

const levelModel = computed({
  get: () => (filter.education_level_id === '' ? ALL : filter.education_level_id),
  set: (v: string) => {
    filter.education_level_id = v === ALL ? '' : v
  },
})
const subjectModel = computed({
  get: () => (filter.subject_id === '' ? ALL : filter.subject_id),
  set: (v: string) => {
    filter.subject_id = v === ALL ? '' : v
  },
})
const activeCount = computed(
  () => Object.values(applied.value).filter((value) => value !== '').length,
)

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

function reset(): void {
  filter.education_level_id = ''
  filter.subject_id = ''
  void router.push({ path: AUDIO_KBAT_PATH })
}
</script>

<template>
  <DsPage :title="LIST_COPY.title" :subtitle="LIST_COPY.intro" data-testid="audio-kbat-page">
    <UBadge
      color="neutral"
      variant="soft"
      icon="i-ph-headphones-duotone"
      :label="LIST_COPY.pill"
      class="self-start"
      data-testid="audio-intro"
    />

    <DsFilterBar
      :active-count="activeCount"
      apply-label="Tapis"
      data-testid="audio-filter"
      @apply="apply"
      @reset="reset"
    >
      <USelect
        v-model="levelModel"
        :items="levelItems"
        name="education_level_id"
        class="w-full md:w-56"
        aria-label="Tahap"
        data-testid="filter-level"
      />
      <USelect
        v-model="subjectModel"
        :items="subjectItems"
        name="subject_id"
        class="w-full md:w-56"
        aria-label="Subjek"
        data-testid="filter-subject"
      />
    </DsFilterBar>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-ph-warning-duotone"
      :description="COPY.loadFailed"
      data-testid="audio-error"
    />

    <div
      v-else-if="loading && !data"
      class="grid grid-cols-1 gap-3 sm:grid-cols-2"
      role="status"
      aria-busy="true"
      data-testid="audio-loading"
    >
      <USkeleton v-for="n in 4" :key="n" class="h-20 w-full" />
    </div>

    <DsEmptyState
      v-else-if="data && data.data.length === 0"
      :title="LIST_COPY.empty"
      icon="i-ph-headphones-duotone"
      data-testid="audio-empty"
    />

    <ul v-else-if="data" class="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="audio-sets">
      <li v-for="set in data.data" :key="set.id" class="min-w-0" data-testid="audio-set">
        <UCard>
          <div class="flex items-center gap-3">
            <DsIconChip icon="i-ph-headphones-duotone" size="lg" />
            <div class="min-w-0 grow">
              <p class="text-label break-words text-highlighted" data-testid="set-title">
                {{ set.title }}
              </p>
              <p class="text-caption text-muted">
                <span data-testid="set-level">{{ set.educationLevel.name }}</span>
                ·
                <span data-testid="set-subject">{{ set.subject.name }}</span>
              </p>
            </div>
            <UButton
              :to="{ name: AUDIO_KBAT_ROUTES.player, params: { id: set.id } }"
              icon="i-ph-play-fill"
              size="xl"
              class="shrink-0"
              :aria-label="`Main ${set.title}`"
              data-testid="set-link"
            />
          </div>
        </UCard>
      </li>
    </ul>
  </DsPage>
</template>
