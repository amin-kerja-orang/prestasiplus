<script setup lang="ts">
/**
 * `/tournament/:uuid` (FR-M16-114; URS FN-M16-8.3.1, PROVISIONAL): a read-only page from #45 with the
 * title, the banner line and the saved fields with the S24 labels. Brackets, groups, fixtures and
 * live matches are not built. An unknown uuid (or a draft of another user) renders the standalone
 * 404 page in place.
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { useApi, usePageMeta } from '@/composables'
import { DsArt3D, DsPage, DsLoadError } from '@/ds'
import { formatDateTime } from '@/lib/time'

import { fetchBattleLobby, fetchTournament } from '../api'
import {
  DETAIL_LABELS as L,
  EDUCATION_LEVELS,
  FORMATS,
  LIST_COPY,
  QUESTION_MODES,
  STATUS_LINE,
} from '../components/tournament/copy'
import { LOAD_COPY } from '../components/competition/copy'

const props = defineProps<{ uuid: string }>()

const pageMeta = usePageMeta()
const view = useApi(
  (signal) => fetchTournament(props.uuid, { signal }),
  () => props.uuid,
)

const notFound = computed(() => isApiError(view.error.value) && view.error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
    else if (useRouteOutcome().value === 404) setRouteOutcome(null)
  },
  { immediate: true },
)

// Subject names come from the battle lobby (#15, every user); the detail carries ids only.
const subjects = useApi(async (signal) => (await fetchBattleLobby({ signal })).subjects)
const subjectName = (id: number): string =>
  subjects.data.value?.find((s) => s.id === id)?.name ?? `#${String(id)}`

const t = computed(() => view.data.value)

watch(
  t,
  (value) => {
    if (!value) return
    pageMeta.setHeader({ title: value.title, subtitle: 'Selamat datang kembali' })
    pageMeta.setTitle(value.title)
  },
  { immediate: true },
)

const line = computed(() => (t.value ? STATUS_LINE[t.value.status] : ''))

interface Row {
  key: string
  label: string
  value: string
}

const rows = computed<Row[]>(() => {
  const d = t.value
  if (!d) return []
  const out: Row[] = []
  if (d.description) out.push({ key: 'description', label: L.description, value: d.description })
  out.push(
    {
      key: 'level',
      label: L.educationLevel,
      value: EDUCATION_LEVELS[d.educationLevelId] ?? d.educationLevelId,
    },
    { key: 'format', label: L.format, value: FORMATS[d.format] ?? d.format },
  )
  if (d.groupsCount !== null)
    out.push({ key: 'groups', label: L.groups, value: String(d.groupsCount) })
  out.push({
    key: 'source',
    label: L.questionSource,
    value: QUESTION_MODES[d.questionMode] ?? d.questionMode,
  })
  if (d.questionMode === 'subject' && d.subjectId !== null) {
    out.push({ key: 'subject', label: L.subject, value: subjectName(d.subjectId) })
  }
  if (d.questionMode === 'random_mix') {
    out.push({
      key: 'mixed',
      label: L.mixedSubjects,
      value: d.mixedSubjectIds.map(subjectName).join(', ') || L.notSet,
    })
  }
  out.push(
    { key: 'total', label: L.totalQuestions, value: String(d.totalQuestions) },
    { key: 'window', label: L.timeWindow, value: String(d.timeWindowMinutes) },
    { key: 'topn', label: L.topN, value: String(d.topNScoring) },
    { key: 'min', label: L.minParticipants, value: String(d.minParticipants) },
    {
      key: 'opens',
      label: L.opens,
      value: d.registrationOpensAt ? formatDateTime(d.registrationOpensAt) : L.notSet,
    },
    {
      key: 'closes',
      label: L.closes,
      value: d.registrationClosesAt ? formatDateTime(d.registrationClosesAt) : L.notSet,
    },
  )
  return out
})
</script>

<template>
  <DsPage data-testid="m16-tournament-detail-page">
    <UButton
      to="/tournament"
      color="neutral"
      variant="link"
      icon="i-ph-arrow-left-bold"
      class="min-h-11 self-start"
      data-testid="tournament-back"
    >
      {{ LIST_COPY.heading }}
    </UButton>

    <template v-if="notFound" />
    <DsLoadError v-else-if="view.error.value" :message="LOAD_COPY.failed" testid="m16-load-error" retry-testid="m16-retry" @retry="view.reload()" />
    <div
      v-else-if="!t"
      class="flex flex-col gap-3"
      aria-busy="true"
      data-testid="tournament-detail-loading"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-40 w-full" />
    </div>
    <template v-else>
      <UCard data-testid="tournament-detail-hero">
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <h1 class="text-title break-words text-highlighted" data-testid="tournament-detail-title">
              {{ t.title }}
            </h1>
            <UBadge color="primary" variant="soft" size="lg" class="mt-2" data-testid="tournament-detail-line">{{
              line
            }}</UBadge>
          </div>
          <DsArt3D name="trophy" size="hero" float class="hidden sm:block" />
        </div>
      </UCard>

      <UCard>
        <dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2" data-testid="tournament-detail-fields">
          <div v-for="row in rows" :key="row.key" class="min-w-0" :data-field="row.key">
            <dt class="text-caption text-muted">{{ row.label }}</dt>
            <dd class="text-body break-words text-highlighted">{{ row.value }}</dd>
          </div>
        </dl>
      </UCard>
    </template>
  </DsPage>
</template>
