<script setup lang="ts">
/**
 * S2 filter card (FR-M27-59; PROPOSED, pattern of M08 S8 and the M18 level pills; restyle spec AS-47). A GET
 * filter: the select "Subjek" submits on change; the level pills "Tingkatan 4" (default) and "Tingkatan 5"
 * are links that keep the chosen subject. The select lists only the subjects with at least one SP at the
 * level; there is no "all" option. Deviation: it is not a `DsFilterBar`, because that bar adds "Cari" and
 * "Set Semula" buttons the live screen does not have (the filters apply on change).
 */
import { computed } from 'vue'

import type { HeatmapLevelCode } from '../../api/school-admin'
import PillNav, { type PillItem } from '../shared/PillNav.vue'

const props = defineProps<{
  subjects: { id: number; name: string }[]
  /** The subject id the select shows ('' when the requested id has no SP at the level). */
  subjectId: number | ''
  level: HeatmapLevelCode
}>()

const emit = defineEmits<{ subject: [id: number] }>()

const LEVELS = [
  { code: 't4', query: 'T4', label: 'Tingkatan 4' },
  { code: 't5', query: 'T5', label: 'Tingkatan 5' },
] as const

const levelItems = computed<PillItem<HeatmapLevelCode>[]>(() =>
  LEVELS.map((l) => ({
    key: l.code,
    label: l.label,
    to: {
      query: {
        ...(props.subjectId === '' ? {} : { subjectId: String(props.subjectId) }),
        tingkatan: l.query,
      },
    },
  })),
)
const subjectItems = computed(() => props.subjects.map((s) => ({ label: s.name, value: s.id })))

function onChange(value: unknown) {
  const id = Number(value)
  if (Number.isInteger(id) && id > 0) emit('subject', id)
}
</script>

<template>
  <UCard data-testid="dh-filters">
    <form class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" @submit.prevent>
      <UFormField label="Subjek" name="subjectId" class="min-w-0 sm:w-80">
        <USelect
          id="dh-subject"
          :model-value="subjectId === '' ? undefined : subjectId"
          :items="subjectItems"
          size="lg"
          class="w-full"
          data-testid="dh-subject"
          @update:model-value="onChange"
        />
      </UFormField>
      <PillNav
        :items="levelItems"
        :active="level"
        nav-id="dh-levels"
        prefix="dh-level"
        label="Tingkatan"
      />
    </form>
  </UCard>
</template>
