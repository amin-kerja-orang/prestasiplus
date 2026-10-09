<script setup lang="ts">
/**
 * `/tournament/:uuid` (FR-M16-114; URS FN-M16-8.3.1, PROVISIONAL): a read-only page from #45 with the
 * title, the banner line and the saved fields with the S24 labels. Brackets, groups, fixtures and
 * live matches are not built. An unknown uuid (or a draft of another user) renders the standalone
 * 404 page in place.
 */
import { ArrowLeft, Trophy } from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { LoadingSpinner } from '@/components/feedback'
import { useApi, usePageMeta } from '@/composables'
import { formatDateTime } from '@/lib/time'

import { fetchBattleLobby, fetchTournament } from '../api'
import PageLoadError from '../components/competition/PageLoadError.vue'
import {
  DETAIL_LABELS as L,
  EDUCATION_LEVELS,
  FORMATS,
  LIST_COPY,
  QUESTION_MODES,
  STATUS_LINE,
} from '../components/tournament/copy'

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
  <div class="mx-auto max-w-3xl min-w-0 space-y-4" data-testid="m16-tournament-detail-page">
    <RouterLink
      to="/tournament"
      class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      data-testid="tournament-back"
    >
      <ArrowLeft class="h-4 w-4" />
      {{ LIST_COPY.heading }}
    </RouterLink>

    <template v-if="notFound" />
    <PageLoadError v-else-if="view.error.value" @retry="view.reload()" />
    <div
      v-else-if="!t"
      class="flex justify-center py-10 text-slate-400"
      data-testid="tournament-detail-loading"
    >
      <LoadingSpinner :size="28" />
    </div>
    <template v-else>
      <section
        class="flex items-center gap-3 rounded-2xl bg-linear-to-r from-indigo-600 to-purple-600 p-4 text-white shadow-lg sm:p-6"
        data-testid="tournament-detail-hero"
      >
        <Trophy class="h-8 w-8 shrink-0 text-yellow-300" />
        <div class="min-w-0">
          <h1
            class="text-xl font-bold break-words text-white sm:text-2xl"
            data-testid="tournament-detail-title"
          >
            {{ t.title }}
          </h1>
          <p class="mt-1 text-sm text-white" data-testid="tournament-detail-line">{{ line }}</p>
        </div>
      </section>

      <section class="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-2" data-testid="tournament-detail-fields">
          <div v-for="row in rows" :key="row.key" class="min-w-0" :data-field="row.key">
            <dt class="text-xs font-semibold text-slate-600">{{ row.label }}</dt>
            <dd class="text-sm break-words text-slate-800">{{ row.value }}</dd>
          </div>
        </dl>
      </section>
    </template>
  </div>
</template>
