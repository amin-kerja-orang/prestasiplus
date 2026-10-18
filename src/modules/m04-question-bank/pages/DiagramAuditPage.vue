<script setup lang="ts">
/**
 * S11 `/admin/soalan-gambar` "Soalan Perlu Gambar Rajah - Admin" (M04-T7; FR-M04-95..101,
 * FN-M04-5.2.1..5.2.11). The shell header carries the title and subtitle; no admin sidebar item.
 *
 * - Three stat cards (labels upper case by CSS; each list's count under the active filters, "Jumlah"
 *   their sum, DV-M04-11) and the top-10 subject pills (global under every filter, as live).
 * - GET filter (`subject_id` alphabetical, `school_id` every school A-Z, "Tapis"). The subject filter
 *   applies to both lists, the school filter to the MCQ list only.
 * - "MCQ (n)" and "Struktur (n)" sections, 20 cards each with their own pager (`mcq_page`,
 *   `str_page`; links keep the filters and drop the other list's page, DV-M04-16); a section is
 *   omitted when its count is 0. Both empty: "Semua soalan sudah lengkap dengan gambar rajah!".
 * - Upload and dismiss call the API and reload with the API `status` as the flash.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import {
  DsFilterBar,
  DsFormField,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStatRow,
  type StatItem,
} from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchDiagramAudit } from '../api/diagram-audit'
import DiagramCard from '../components/DiagramCard.vue'
import { DIAGRAMS_PATH } from '../lib/audit-routes'
import { fetchSchoolNameOptions, fetchSubjectOptions } from '../lib/lookup-options'
import { pageOf, queryText } from '../lib/route-query'
import { LOAD_ERROR, errorLines } from '../lib/ui-errors'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

const applied = computed(() => ({
  subject_id: queryText(route.query.subject_id),
  school_id: queryText(route.query.school_id),
  mcq_page: pageOf(route.query.mcq_page),
  str_page: pageOf(route.query.str_page),
}))

const subjectId = ref(applied.value.subject_id)
const schoolId = ref(applied.value.school_id)
watch(applied, (a) => {
  subjectId.value = a.subject_id
  schoolId.value = a.school_id
})

const { data: subjects } = useApi((signal) => fetchSubjectOptions(signal))
const { data: schools } = useApi((signal) => fetchSchoolNameOptions(signal))

const { data, error, reload } = useApi(
  (signal) =>
    fetchDiagramAudit({
      subjectId: applied.value.subject_id || null,
      schoolId: applied.value.school_id || null,
      mcqPage: applied.value.mcq_page,
      strPage: applied.value.str_page,
      signal,
    }),
  [
    () => route.query.subject_id,
    () => route.query.school_id,
    () => route.query.mcq_page,
    () => route.query.str_page,
  ],
)

const stats = computed(() => data.value?.meta.stats ?? null)
const statItems = computed<StatItem[]>(() => [
  {
    key: 'mcq',
    label: 'MCQ Perlu Gambar',
    value: formatNumber(stats.value?.mcq ?? 0),
    icon: 'list-numbers',
    accent: 'action',
  },
  {
    key: 'structured',
    label: 'Struktur Perlu Gambar',
    value: formatNumber(stats.value?.structured ?? 0),
    icon: 'pen-nib',
    accent: 'friend',
  },
  {
    key: 'total',
    label: 'Jumlah',
    value: formatNumber(stats.value?.total ?? 0),
    icon: 'chart-bar',
    accent: 'win',
  },
])
const pills = computed(() => data.value?.meta.bySubject ?? [])
const mcq = computed(() => data.value?.data.mcq ?? null)
const structured = computed(() => data.value?.data.structured ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)
const allDone = computed(
  () => mcq.value !== null && structured.value !== null && stats.value?.total === 0,
)

/** Filters kept on every pager link (DV-M04-16); the other list's page is dropped. */
const pagerQuery = computed(() => ({
  subject_id: applied.value.subject_id,
  school_id: applied.value.school_id,
}))

function filterQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  if (subjectId.value !== '') out.subject_id = subjectId.value
  if (schoolId.value !== '') out.school_id = schoolId.value
  return out
}

async function submitFilter(): Promise<void> {
  const query = filterQuery()
  const current: Record<string, string> = {}
  for (const [key, value] of Object.entries(pagerQuery.value))
    if (value !== '') current[key] = value
  const same =
    JSON.stringify(current) === JSON.stringify(query) &&
    !route.query.mcq_page &&
    !route.query.str_page
  // Submitting the same filter reloads the page, as a live GET form does.
  if (same) await reload()
  else await router.push({ path: DIAGRAMS_PATH, query })
}

function goToPage(param: 'mcq_page' | 'str_page', page: number): void {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(pagerQuery.value)) if (value !== '') query[key] = value
  void router.push({ path: DIAGRAMS_PATH, query: { ...query, [param]: String(page) } })
}

async function onDone(message: string): Promise<void> {
  await reload()
  flash.show({ type: 'success', message })
}

function onFailed(err: unknown): void {
  flash.show({ type: 'error', message: errorLines(err) })
}

async function resetFilter(): Promise<void> {
  subjectId.value = ''
  schoolId.value = ''
  await router.push({ path: DIAGRAMS_PATH })
}

const filterCount = computed(
  () => [applied.value.subject_id, applied.value.school_id].filter((v) => v !== '').length,
)
</script>

<template>
  <DsPage data-testid="diagrams-page">
    <!-- Stat cards: 2 across below md, 3 across from md. -->
    <DsStatRow :items="statItems" :cols="3" :loading="!stats" density="roomy" prefix="diagrams-stat" />

    <!-- Top-10 subjects by flagged MCQ count (global). -->
    <DsPanel title="MCQ Perlu Gambar Mengikut Mata Pelajaran" data-testid="diagrams-by-subject">
      <div class="flex flex-wrap gap-2">
        <UBadge
          v-for="p in pills"
          :key="p.name"
          color="neutral"
          variant="soft"
          :label="`${p.name}: ${formatNumber(p.count)}`"
          data-testid="diagrams-pill"
        />
      </div>
    </DsPanel>

    <!-- Filter (the URL is the state). -->
    <DsFilterBar
      :active-count="filterCount"
      apply-label="Tapis"
      data-testid="diagrams-filter"
      @apply="submitFilter"
      @reset="resetFilter"
    >
      <div class="w-full min-w-0 sm:w-64">
        <DsFormField v-slot="{ id }" native for="diagrams-subject" label="Mata Pelajaran">
          <DsNativeSelect
            :id="id"
            v-model="subjectId"
            name="subject_id"
            data-testid="diagrams-subject"
          >
            <option value="">Semua Mata Pelajaran</option>
            <option v-for="s in subjects ?? []" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
          </DsNativeSelect>
        </DsFormField>
      </div>
      <div class="w-full min-w-0 sm:w-64">
        <DsFormField v-slot="{ id }" native for="diagrams-school" label="Sekolah">
          <DsNativeSelect
            :id="id"
            v-model="schoolId"
            name="school_id"
            data-testid="diagrams-school"
          >
            <option value="">Semua Sekolah</option>
            <option v-for="s in schools ?? []" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
          </DsNativeSelect>
        </DsFormField>
      </div>
    </DsFilterBar>

    <DsLoadError
      v-if="error"
      :message="LOAD_ERROR"
      testid="diagrams-error"
      retry-testid="diagrams-retry"
      @retry="reload()"
    />

    <div v-else-if="firstLoad" class="flex flex-col gap-3" data-testid="diagrams-skeleton">
      <USkeleton v-for="n in 3" :key="n" class="h-24 w-full" />
    </div>

    <template v-else>
      <DsPanel v-if="allDone" data-testid="diagrams-empty">
        <p class="text-center text-body text-success">
          Semua soalan sudah lengkap dengan gambar rajah!
        </p>
      </DsPanel>

      <section v-if="mcq && mcq.meta.totalItems > 0" class="flex flex-col gap-3" data-testid="diagrams-mcq">
        <h2 class="flex items-center gap-2 text-subheading text-highlighted">
          <UIcon name="i-ph-list-numbers" class="size-5 text-primary-t" />
          MCQ ({{ mcq.meta.totalItems }})
        </h2>
        <DiagramCard
          v-for="item in mcq.items"
          :key="item.id"
          kind="mcq"
          :item="item"
          @done="onDone"
          @failed="onFailed"
        />
        <div v-if="mcq.meta.totalItems > mcq.meta.pageSize" data-testid="diagrams-mcq-pager">
          <UPagination
            :page="mcq.meta.page"
            :total="mcq.meta.totalItems"
            :items-per-page="mcq.meta.pageSize"
            :prev="{ 'aria-label': 'Sebelum' }"
            :next="{ 'aria-label': 'Seterusnya' }"
            @update:page="(p: number) => goToPage('mcq_page', p)"
          />
        </div>
      </section>

      <section
        v-if="structured && structured.meta.totalItems > 0"
        class="flex flex-col gap-3"
        data-testid="diagrams-structured"
      >
        <h2 class="flex items-center gap-2 text-subheading text-highlighted">
          <UIcon name="i-ph-pen-nib" class="size-5 text-primary-t" />
          Struktur ({{ structured.meta.totalItems }})
        </h2>
        <DiagramCard
          v-for="item in structured.items"
          :key="item.id"
          kind="structured"
          :item="item"
          @done="onDone"
          @failed="onFailed"
        />
        <div
          v-if="structured.meta.totalItems > structured.meta.pageSize"
          data-testid="diagrams-structured-pager"
        >
          <UPagination
            :page="structured.meta.page"
            :total="structured.meta.totalItems"
            :items-per-page="structured.meta.pageSize"
            :prev="{ 'aria-label': 'Sebelum' }"
            :next="{ 'aria-label': 'Seterusnya' }"
            @update:page="(p: number) => goToPage('str_page', p)"
          />
        </div>
      </section>
    </template>
  </DsPage>
</template>
