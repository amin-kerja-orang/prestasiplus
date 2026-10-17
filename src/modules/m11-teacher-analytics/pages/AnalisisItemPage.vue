<script setup lang="ts">
/**
 * S6 `/guru/analisis-item` "Analisis Item Soalan" (M11-T2; FR-M11-76…80, BR-M11-28). Query names as on
 * live: `subject_id`, `classroom_id`. Filter card, legend, then the empty card (always for a viewer with
 * no own class, and for a `classroom_id` that is not an own class) or the provisional item table.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsEmptyState, DsPage } from '@/ds'

import { fetchItemAnalysis } from '../api'
import { ITEM_COPY } from '../components/analisis-item/copy'
import ItemFilterCard from '../components/analisis-item/ItemFilterCard.vue'
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
</script>

<template>
  <DsPage data-testid="analisis-item-page">
    <UAlert
      v-if="analysis.error.value"
      color="error"
      variant="subtle"
      icon="i-ph-warning"
      :description="ITEM_COPY.loadFailed"
    />

    <div
      v-else-if="!d"
      class="flex justify-center py-12 text-muted"
      data-testid="analisis-item-loading"
    >
      <UProgress class="max-w-48" />
    </div>

    <template v-else>
      <ItemFilterCard
        :options="d.options"
        :subject-id="selectedSubject"
        :classroom-id="selectedClass"
        :show-reset="showReset"
        @change="onChange"
      />
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
