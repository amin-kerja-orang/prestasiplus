<script setup lang="ts">
/**
 * S6 `/guru/analisis-item` "Analisis Item Soalan" (M11-T2; FR-M11-76…80, BR-M11-28). Query names as on
 * live: `subject_id`, `classroom_id`. Filter card, legend, then the empty card (always for a viewer with
 * no own class, and for a `classroom_id` that is not an own class) or the provisional item table.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsEmptyState,
  DsFilterBar,
  DsFormField,
  DsIcon,
  DsLoadError,
  DsNativeSelect,
  DsPage,
} from '@/ds'

import { fetchItemAnalysis } from '../api'
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

const subjectValue = computed(() =>
  selectedSubject.value === null ? '' : String(selectedSubject.value),
)
const classValue = computed(() => (selectedClass.value === null ? '' : String(selectedClass.value)))

/** The selects show a value only when it is one of their options (an unknown id reads "Semua …"). */
const selectedSubject = computed(() =>
  d.value?.options.subjects.some((s) => s.id === subjectId.value)
    ? (subjectId.value ?? null)
    : null,
)
const selectedClass = computed(() =>
  d.value?.options.classes.some((c) => c.id === classroomId.value)
    ? (classroomId.value ?? null)
    : null,
)

/** FR-M11-77: "Reset" while either query value is non-empty. */
const showReset = computed(() => {
  const raw = (v: unknown): string => String((Array.isArray(v) ? v[0] : v) ?? '').trim()
  return raw(route.query.subject_id) !== '' || raw(route.query.classroom_id) !== ''
})

/** A GET form submit: both fields are sent, the other one keeps its current query value. */
function onChange(field: 'subject_id' | 'classroom_id', value: string): void {
  const current = (v: unknown): string => String((Array.isArray(v) ? v[0] : v) ?? '')
  void router.push({
    path: '/guru/analisis-item',
    query: {
      subject_id: field === 'subject_id' ? value : current(route.query.subject_id),
      classroom_id: field === 'classroom_id' ? value : current(route.query.classroom_id),
    },
  })
}
/** FR-M11-77: Reset links to the bare page. */
const reset = (): void => void router.push('/guru/analisis-item')
</script>

<template>
  <DsPage data-testid="analisis-item-page">
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
        :active-count="showReset ? 1 : 0"
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
      </DsFilterBar>
      <ItemLegend />
      <div v-if="d.rows.length === 0" data-testid="item-empty">
        <DsEmptyState
          icon="i-ph-chart-pie"
          :title="ITEM_COPY.emptyTitle"
          :description="ITEM_COPY.emptyBody"
        />
      </div>
      <ItemTable v-else :rows="d.rows" />
    </template>
  </DsPage>
</template>
