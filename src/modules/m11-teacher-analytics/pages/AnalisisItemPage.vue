<script setup lang="ts">
/**
 * S6 `/guru/analisis-item` "Analisis Item Soalan" (M11-T2; FR-M11-76…80, BR-M11-28; R1-GUR-6 FR-GUR-6-3/-5).
 * Query names as on live: `subject_id`, `classroom_id`; plus `q` (search, 2 characters at least), `susun` (sort,
 * default "Paling Sukar Dahulu") and `tahap` ("Tahap Kesukaran"). Filter card, legend, then the empty card (always
 * for a viewer with no own class, and for a `classroom_id` that is not an own class) or the item table (25 per page).
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsCluster,
  DsEmptyState,
  DsFilterBar,
  DsFormField,
  DsIcon,
  DsLoadError,
  DsNativeSelect,
  DsPage,
} from '@/ds'

import { fetchItemAnalysis } from '../api'
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  TAHAP_OPTIONS,
  parseSort,
  parseTahap,
  searchTooShort,
  visibleRows,
} from '../components/analisis-item/bands'
import { ITEM_COPY } from '../components/analisis-item/copy'
import ItemLegend from '../components/analisis-item/ItemLegend.vue'
import ItemTable from '../components/analisis-item/ItemTable.vue'
import { parseId } from '../components/laporan/format'

const route = useRoute()
const router = useRouter()

const subjectId = computed(() => parseId(route.query.subject_id))
const classroomId = computed(() => parseId(route.query.classroom_id))

const analysis = useApi(
  (signal) =>
    fetchItemAnalysis(
      {
        ...(subjectId.value !== undefined ? { subjectId: subjectId.value } : {}),
        ...(classroomId.value !== undefined ? { classroomId: classroomId.value } : {}),
      },
      { signal },
    ),
  [subjectId, classroomId],
)

const d = computed(() => analysis.data.value)

const PAGE_SIZE = 25
const tahap = computed(() => parseTahap(route.query.tahap))
const sort = computed(() => parseSort(route.query.susun))
/** The search box answers at once; the URL (`q`) follows without adding history entries. */
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const tooShort = computed(() => searchTooShort(search.value))
const page = ref(1)
const rows = computed(() =>
  visibleRows(d.value?.rows ?? [], { q: search.value, tahap: tahap.value, sort: sort.value }),
)
const pages = computed(() => Math.max(1, Math.ceil(rows.value.length / PAGE_SIZE)))
const pageRows = computed(() => {
  const from = (Math.min(page.value, pages.value) - 1) * PAGE_SIZE
  return rows.value.slice(from, from + PAGE_SIZE)
})
const offset = computed(() => (Math.min(page.value, pages.value) - 1) * PAGE_SIZE)
watch([search, tahap, sort, subjectId, classroomId], () => {
  page.value = 1
})
watch(search, (v) => {
  const q = v.trim() === '' ? undefined : v
  if (q === (typeof route.query.q === 'string' ? route.query.q : undefined)) return
  void router.replace({ query: { ...route.query, q } })
})

const subjectValue = computed(() =>
  selectedSubject.value === null ? '' : String(selectedSubject.value),
)
const classValue = computed(() => (selectedClass.value === null ? '' : String(selectedClass.value)))

/**
 * The selects show a value only when it is one of their options (an unknown id reads "Semua …"). Ids are
 * compared as strings: the http API sends option ids as strings (`IdSchema`), the query ids are numbers.
 */
const selectedSubject = computed(() =>
  d.value?.options.subjects.some((s) => String(s.id) === String(subjectId.value))
    ? (subjectId.value ?? null)
    : null,
)
const selectedClass = computed(() =>
  d.value?.options.classes.some((c) => String(c.id) === String(classroomId.value))
    ? (classroomId.value ?? null)
    : null,
)

/** FR-M11-77: "Reset" while any query value is non-empty (subject, class, search, order or Tahap). */
const showReset = computed(() => {
  const raw = (v: unknown): string => String((Array.isArray(v) ? v[0] : v) ?? '').trim()
  return (
    raw(route.query.subject_id) !== '' ||
    raw(route.query.classroom_id) !== '' ||
    search.value.trim() !== '' ||
    raw(route.query.susun) !== '' ||
    raw(route.query.tahap) !== ''
  )
})
const activeCount = computed(
  () =>
    [
      route.query.subject_id,
      route.query.classroom_id,
      search.value.trim() === '' ? '' : search.value,
      route.query.susun,
      route.query.tahap,
    ].filter((v) => String((Array.isArray(v) ? v[0] : v) ?? '').trim() !== '').length,
)

/** A GET form submit: subject and class are always sent, the other fields only while set. */
function onChange(
  field: 'subject_id' | 'classroom_id' | 'susun' | 'tahap',
  value: string,
): void {
  const current = (v: unknown): string => String((Array.isArray(v) ? v[0] : v) ?? '')
  const query: Record<string, string> = {
    subject_id: field === 'subject_id' ? value : current(route.query.subject_id),
    classroom_id: field === 'classroom_id' ? value : current(route.query.classroom_id),
  }
  const susun = field === 'susun' ? value : current(route.query.susun)
  const tahapValue = field === 'tahap' ? value : current(route.query.tahap)
  if (search.value.trim() !== '') query.q = search.value
  if (susun !== '' && susun !== DEFAULT_SORT) query.susun = susun
  if (tahapValue !== '') query.tahap = tahapValue
  void router.push({ path: '/guru/analisis-item', query })
}
/** FR-M11-77: Reset links to the bare page. */
const reset = (): void => {
  search.value = ''
  void router.push('/guru/analisis-item')
}
</script>

<template>
  <DsPage :subtitle="route.meta.header?.subtitle" data-testid="analisis-item-page">
    <DsLoadError v-if="analysis.error.value" @retry="analysis.reload" />

    <div
      v-else-if="!d"
      class="flex justify-center py-12 text-muted"
      data-testid="analisis-item-loading"
    >
      <UProgress class="max-w-48" />
    </div>

    <template v-else>
      <!-- FN-M11-5.1.1: each select submits on change and keeps the other; live copy "Tapis:" and "Reset". -->
      <DsFilterBar
        :show-reset="showReset"
        :active-count="activeCount"
        apply-label="Tapis"
        :reset-label="ITEM_COPY.reset"
        data-testid="filter-card"
        @apply="onChange('subject_id', subjectValue)"
        @reset="reset"
      >
        <p class="flex items-center gap-2 pb-3 text-label text-highlighted">
          <DsIcon name="funnel" class="size-4" />{{ ITEM_COPY.filterLabel }}
        </p>
        <DsFormField
          v-slot="{ id }"
          native
          :label="ITEM_COPY.subjectLabel"
          for="filter-subject"
          class="w-full md:w-56"
        >
          <DsNativeSelect
            :id="id"
            name="subject_id"
            :model-value="subjectValue"
            data-testid="filter-subject"
            @update:model-value="onChange('subject_id', $event as string)"
          >
            <option value="">{{ ITEM_COPY.allSubjects }}</option>
            <option v-for="s in d.options.subjects" :key="s.id" :value="String(s.id)">
              {{ s.name }}
            </option>
          </DsNativeSelect>
        </DsFormField>
        <DsFormField
          v-slot="{ id }"
          native
          :label="ITEM_COPY.classLabel"
          for="filter-classroom"
          class="w-full md:w-56"
        >
          <DsNativeSelect
            :id="id"
            name="classroom_id"
            :model-value="classValue"
            data-testid="filter-classroom"
            @update:model-value="onChange('classroom_id', $event as string)"
          >
            <option value="">{{ ITEM_COPY.allClasses }}</option>
            <option v-for="c in d.options.classes" :key="c.id" :value="String(c.id)">
              {{ c.name }}
            </option>
          </DsNativeSelect>
        </DsFormField>
        <DsFormField
          v-slot="{ id }"
          native
          :label="ITEM_COPY.tahapLabel"
          for="filter-tahap"
          class="w-full md:w-56"
        >
          <DsNativeSelect
            :id="id"
            name="tahap"
            :model-value="tahap"
            data-testid="filter-tahap"
            @update:model-value="onChange('tahap', $event as string)"
          >
            <option v-for="o in TAHAP_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </DsNativeSelect>
        </DsFormField>
        <DsFormField
          v-slot="{ id }"
          native
          :label="ITEM_COPY.sortLabel"
          for="filter-sort"
          class="w-full md:w-56"
        >
          <DsNativeSelect
            :id="id"
            name="susun"
            :model-value="sort"
            data-testid="filter-sort"
            @update:model-value="onChange('susun', $event as string)"
          >
            <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </DsNativeSelect>
        </DsFormField>
        <DsFormField
          v-slot="{ id }"
          native
          :label="ITEM_COPY.searchLabel"
          for="filter-search"
          class="w-full md:w-64"
          :error="tooShort ? ITEM_COPY.searchTooShort : undefined"
        >
          <UInput
            :id="id"
            v-model="search"
            type="search"
            name="q"
            :placeholder="ITEM_COPY.searchPlaceholder"
            size="lg"
            class="w-full"
            :color="tooShort ? 'error' : undefined"
            data-testid="filter-search"
          />
        </DsFormField>
      </DsFilterBar>
      <ItemLegend />
      <div v-if="d.rows.length === 0" data-testid="item-empty">
        <DsEmptyState
          icon="i-ph-chart-pie"
          :title="ITEM_COPY.emptyTitle"
          :description="ITEM_COPY.emptyBody"
        />
      </div>
      <div v-else-if="rows.length === 0" data-testid="item-no-match">
        <DsEmptyState filtered item="soalan" @reset="reset" />
      </div>
      <template v-else>
        <ItemTable :rows="pageRows" :offset="offset" />
        <DsCluster v-if="pages > 1" justify="center" data-testid="item-pager">
          <UPagination v-model:page="page" :items-per-page="PAGE_SIZE" :total="rows.length" />
        </DsCluster>
      </template>
    </template>
  </DsPage>
</template>
