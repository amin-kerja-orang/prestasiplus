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
import {
  DsDataTable,
  DsEmptyState,
  DsFilterBar,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStatRow,
  DsStatusBadge,
} from '@/ds'
import type { CardField, DsStatus, StatItem } from '@/ds'

import {
  fetchAdminAudioSets,
  fetchLevelOptions,
  fetchSubjectOptions,
  type AdminAudioSetItem,
  type AdminAudioSetQuery,
  type AudioSetStatus,
} from '../api/admin-media'
import AudioTemplateLink from '../components/admin-media/AudioTemplateLink.vue'
import { cellClass } from '../lib/table-cols'
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

const statItems = computed<StatItem[]>(() => [
  {
    key: 'sets',
    label: 'Set',
    value: stats.value?.sets ?? 0,
    icon: 'headphones',
    accent: 'action',
  },
  {
    key: 'approved',
    label: 'Approved',
    value: stats.value?.approved ?? 0,
    icon: 'check-circle',
    accent: 'win',
  },
  {
    key: 'draftPending',
    label: 'Draft/Pending',
    value: stats.value?.draftPending ?? 0,
    icon: 'hourglass',
    accent: 'heat',
  },
  {
    key: 'questions',
    label: 'Soalan',
    value: stats.value?.questions ?? 0,
    icon: 'question',
    accent: 'trial',
  },
])

/** Status word stays the live API label ("Draft", "Pending Review", ...); the badge adds icon and colour. */
const STATUS_BADGE: Record<AdminAudioSetItem['status'], DsStatus> = {
  draft: 'draft',
  pending_review: 'awaiting-review',
  approved: 'approved',
  archived: 'inactive',
}

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
  { accessorKey: 'title', header: 'Tajuk Set', ...cellClass('') },
  { accessorKey: 'level', header: 'Tahap', ...cellClass('w-36') },
  { accessorKey: 'subject', header: 'Subjek', ...cellClass('w-44') },
  { id: 'status', header: 'Status', ...cellClass('w-44') },
  { accessorKey: 'questions', header: 'Soalan', ...cellClass('w-28') },
]
const cardFields: CardField[] = [
  { key: 'level', label: 'Tahap' },
  { key: 'subject', label: 'Subjek' },
  { key: 'questions', label: 'Soalan' },
]
</script>

<template>
  <DsPage data-testid="audio-list-page">
    <template #meta>
      <UBadge color="warning" variant="subtle" icon="i-ph-headphones" label="Ujian Mendengar" />
    </template>
    <template #subtitle>Senarai set soalan audio fixed sequence, bukan rawak.</template>
    <template #actions>
      <AudioTemplateLink kind="xlsx" />
      <AudioTemplateLink kind="word" />
      <UButton
        :to="{ name: MEDIA_ROUTES.audioCreate }"
        icon="i-ph-plus"
        label="Cipta Set"
        class="min-h-11"
        data-testid="audio-create"
      />
    </template>

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

    <DsLoadError v-if="error" :message="COPY.loadFailed" testid="audio-error" @retry="reload()" />

    <template v-else>
      <DsStatRow :items="statItems" prefix="stat" :cols="4" data-testid="audio-stats" />

      <div class="flex flex-col gap-3">
        <DsFilterBar
          :chips="chips"
          apply-label="Tapis"
          data-testid="audio-filter"
          @apply="apply"
          @reset="reset"
          @remove-chip="removeChip"
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
              class="w-full md:min-w-0 md:flex-[2]"
              data-testid="filter-search"
            />
          </template>
          <DsNativeSelect
            v-model="filter.education_level_id"
            name="education_level_id"
            aria-label="Tahap"
            class="md:min-w-0 md:flex-1"
            data-testid="filter-level"
          >
            <option value="">Semua Tahap</option>
            <option v-for="level in levels?.data ?? []" :key="level.id" :value="String(level.id)">
              {{ level.name }}
            </option>
          </DsNativeSelect>
          <DsNativeSelect
            v-model="filter.subject_id"
            name="subject_id"
            aria-label="Subjek"
            class="md:min-w-0 md:flex-1"
            data-testid="filter-subject"
          >
            <option value="">Semua Subjek</option>
            <option v-for="subject in subjectOptions" :key="subject.id" :value="String(subject.id)">
              {{ subject.name }}
            </option>
          </DsNativeSelect>
          <DsNativeSelect
            v-model="filter.status"
            name="status"
            aria-label="Status"
            class="md:min-w-0 md:flex-1"
            data-testid="filter-status"
          >
            <option value="">Semua Status</option>
            <option v-for="s in FILTER_STATUS_OPTIONS" :key="s.value" :value="s.value">
              {{ s.label }}
            </option>
          </DsNativeSelect>
        </DsFilterBar>
      </div>

      <DsPanel v-if="!firstLoad && sets.length === 0" data-testid="audio-empty">
        <DsEmptyState title="Belum ada set Audio KBAT." icon="headphones" />
      </DsPanel>

      <DsDataTable
        v-else
        variant="flush"
        layout="fixed"
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
            class="line-clamp-2 min-w-40 text-label text-highlighted"
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
          <DsStatusBadge
            :status="STATUS_BADGE[row.original.raw.status]"
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
