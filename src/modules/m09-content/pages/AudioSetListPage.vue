<script setup lang="ts">
/**
 * S12 `/admin/audio-kbat` "Set Audio KBAT" (M09; FR-M09-61..65, BR-M09-15), v2 staff theme. Admin shell,
 * header title only (no subtitle, DV-M09-08).
 *
 * - Header row with the "Template XLSX" / "Template Word" downloads and "Cipta Set", the guide card, four
 *   KPI tiles (always over every set, never filtered) and the GET filter (level, subject A-Z, status,
 *   search; values kept from the URL) with active-filter chips.
 * - No set: "Belum ada set Audio KBAT." Sets: one table row each (title, level, subject, status label,
 *   question count; a card below `md`); no row action (provisional, L-3).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsDataTable, DsEmptyState, DsFilterBar, DsPage, DsStatTile } from '@/ds'
import type { CardField } from '@/ds'

import {
  fetchAdminAudioSets,
  fetchLevelOptions,
  fetchSubjectOptions,
  type AdminAudioSetItem,
  type AdminAudioSetQuery,
  type AudioSetStatus,
} from '../api/admin-media'
import AudioTemplateLink from '../components/admin-media/AudioTemplateLink.vue'
import AdminActiveFilters from '../components/admin-kit/AdminActiveFilters.vue'
import AdminAlert from '../components/admin-kit/AdminAlert.vue'
import NativeSelect from '../components/admin-kit/native/NativeSelect.vue'
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

const { data, error, reload } = useApi(
  (signal) => fetchAdminAudioSets(apiQuery(), { signal }),
  () => route.fullPath,
)

const stats = computed(() => data.value?.meta.stats ?? null)
const sets = computed<AdminAudioSetItem[]>(() => data.value?.data ?? [])
const firstLoad = computed(() => data.value === null && error.value === null)

const chips = computed(() => {
  const out: { key: string; label: string }[] = []
  const level = (levels.value?.data ?? []).find(
    (l) => String(l.id) === applied.value.education_level_id,
  )
  if (level) out.push({ key: 'education_level_id', label: level.name })
  const subject = subjectOptions.value.find((s) => String(s.id) === applied.value.subject_id)
  if (subject) out.push({ key: 'subject_id', label: subject.name })
  const status = FILTER_STATUS_OPTIONS.find((s) => s.value === applied.value.status)
  if (status) out.push({ key: 'status', label: status.label })
  if (applied.value.search !== '') out.push({ key: 'search', label: `"${applied.value.search}"` })
  return out
})

/** The filter is a GET form: "Cari" goes to the same path with the non-empty values. */
function apply(): void {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(filter)) if (value !== '') query[key] = value
  void router.push({ path: AUDIO_PATH, query })
}

function reset(): void {
  void router.push({ path: AUDIO_PATH })
}

function removeChip(key: string): void {
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(applied.value)) if (v !== '' && k !== key) query[k] = v
  void router.push({ path: AUDIO_PATH, query })
}

const STAT_CARDS = [
  { key: 'sets', label: 'Set', icon: 'i-ph-headphones', accent: 'action' },
  { key: 'approved', label: 'Approved', icon: 'i-ph-check-circle', accent: 'win' },
  { key: 'draftPending', label: 'Draft/Pending', icon: 'i-ph-hourglass', accent: 'heat' },
  { key: 'questions', label: 'Soalan', icon: 'i-ph-question', accent: 'trial' },
] as const

const statusColor = (s: AdminAudioSetItem['status']) => STATUS_COLOR[s]

const STATUS_COLOR = {
  draft: 'neutral',
  pending_review: 'warning',
  approved: 'success',
  archived: 'neutral',
} as const

interface TableRow extends Record<string, unknown> {
  id: number
  title: string
  level: string
  subject: string
  questions: string
  raw: AdminAudioSetItem
}

const tableRows = computed<TableRow[]>(() =>
  sets.value.map((s) => ({
    id: s.id,
    title: s.title,
    level: s.educationLevel.name,
    subject: s.subject.name,
    questions: `${String(s.questionCount)} soalan`,
    raw: s,
  })),
)

const columns: TableColumn<TableRow>[] = [
  { accessorKey: 'title', header: 'Tajuk Set' },
  { accessorKey: 'level', header: 'Tahap' },
  { accessorKey: 'subject', header: 'Subjek' },
  { id: 'status', header: 'Status' },
  { accessorKey: 'questions', header: 'Soalan' },
]
const cardFields: CardField[] = [
  { key: 'level', label: 'Tahap' },
  { key: 'subject', label: 'Subjek' },
  { key: 'questions', label: 'Soalan' },
]
</script>

<template>
  <DsPage data-testid="audio-list-page">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex min-w-0 flex-col items-start gap-2">
        <UBadge color="warning" variant="subtle" icon="i-ph-headphones" label="Ujian Mendengar" />
        <p class="text-body text-muted">Senarai set soalan audio fixed sequence, bukan rawak.</p>
      </div>
      <div class="flex flex-wrap gap-3">
        <AudioTemplateLink kind="xlsx" />
        <AudioTemplateLink kind="word" />
        <UButton
          :to="{ name: MEDIA_ROUTES.audioCreate }"
          icon="i-ph-plus"
          label="Cipta Set"
          size="md"
          class="min-h-11"
          data-testid="audio-create"
        />
      </div>
    </div>

    <UAlert
      color="info"
      variant="subtle"
      icon="i-ph-info"
      :title="LIST_GUIDE.title"
      data-testid="audio-guide"
    >
      <template #description>
        <div class="flex flex-col gap-2">
          <p v-for="text in LIST_GUIDE.paragraphs" :key="text">{{ text }}</p>
        </div>
      </template>
    </UAlert>

    <div v-if="error" class="flex flex-col gap-4" data-testid="audio-error">
      <AdminAlert :messages="[COPY.loadFailed]" />
      <div><UButton label="Cuba Lagi" class="min-h-11" @click="reload()" /></div>
    </div>

    <template v-else>
      <section class="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="audio-stats">
        <div v-for="card in STAT_CARDS" :key="card.key" :data-testid="`stat-${card.key}`">
          <DsStatTile
            :value="stats ? stats[card.key] : 0"
            :unit="card.label"
            :icon="card.icon"
            :accent="card.accent"
          />
        </div>
      </section>

      <div class="flex flex-col gap-3">
        <DsFilterBar
          :active-count="chips.length"
          apply-label="Tapis"
          data-testid="audio-filter"
          @apply="apply"
          @reset="reset"
        >
          <template #search>
            <UInput
              v-model="filter.search"
              type="text"
              name="search"
              aria-label="Cari"
              placeholder="Cari tajuk/sumber..."
              icon="i-ph-magnifying-glass"
              size="md"
              class="w-full md:min-w-64 md:grow"
              data-testid="filter-search"
            />
          </template>
          <NativeSelect
            v-model="filter.education_level_id"
            name="education_level_id"
            aria-label="Tahap"
            class="md:w-44"
            data-testid="filter-level"
          >
            <option value="">Semua Tahap</option>
            <option v-for="level in levels?.data ?? []" :key="level.id" :value="String(level.id)">
              {{ level.name }}
            </option>
          </NativeSelect>
          <NativeSelect
            v-model="filter.subject_id"
            name="subject_id"
            aria-label="Subjek"
            class="md:w-48"
            data-testid="filter-subject"
          >
            <option value="">Semua Subjek</option>
            <option v-for="subject in subjectOptions" :key="subject.id" :value="String(subject.id)">
              {{ subject.name }}
            </option>
          </NativeSelect>
          <NativeSelect
            v-model="filter.status"
            name="status"
            aria-label="Status"
            class="md:w-44"
            data-testid="filter-status"
          >
            <option value="">Semua Status</option>
            <option v-for="s in FILTER_STATUS_OPTIONS" :key="s.value" :value="s.value">
              {{ s.label }}
            </option>
          </NativeSelect>
        </DsFilterBar>
        <AdminActiveFilters :chips="chips" @remove="removeChip" @reset="reset" />
      </div>

      <UCard v-if="!firstLoad && sets.length === 0" data-testid="audio-empty">
        <DsEmptyState title="Belum ada set Audio KBAT." icon="i-ph-headphones" />
      </UCard>

      <DsDataTable
        v-else
        :data="tableRows"
        :columns="columns"
        caption="Senarai set Audio KBAT"
        :loading="firstLoad"
        :total="sets.length"
        :page-size="Math.max(sets.length, 1)"
        card-title="title"
        :card-fields="cardFields"
        data-testid="audio-sets"
      >
        <template #title-cell="{ row }">
          <p
            class="line-clamp-2 min-w-56 text-label text-highlighted"
            data-testid="audio-set"
            :data-set-id="row.original.id"
          >
            <span data-testid="set-title">{{ row.original.title }}</span>
          </p>
        </template>
        <template #level-cell="{ row }">
          <span data-testid="set-level">{{ row.original.level }}</span>
        </template>
        <template #subject-cell="{ row }">
          <span data-testid="set-subject">{{ row.original.subject }}</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge
            :color="statusColor(row.original.raw.status)"
            variant="subtle"
            :label="row.original.raw.statusLabel"
            data-testid="set-status"
          />
        </template>
        <template #questions-cell="{ row }">
          <span class="text-nowrap" data-testid="set-questions">{{ row.original.questions }}</span>
        </template>
      </DsDataTable>
    </template>
  </DsPage>
</template>
