<script setup lang="ts">
/**
 * School / state filter card of S1 (FN-M12-2.1.1) and, with `withState` off, S4 (FN-M12-5.1.1): label
 * above each select, "Tapis" (funnel), and "Reset" only when a filter is set. A GET form on live; here it
 * emits `apply` and the page navigates to its own prefix with `school_id` (and `state`) in the query.
 *
 * PROPOSED presentation: live has no filter form on the alias; the label-above layout and the wrap
 * rules are the rebuild's.
 */
import { computed, ref, watch } from 'vue'

import type { FilterOptions } from '../../../api/types'

const props = withDefaults(
  defineProps<{
    options: FilterOptions | null
    /** Query values (strings, as in the URL). */
    schoolId: string
    state?: string
    withState?: boolean
    /** Target of "Reset". */
    resetTo: string
  }>(),
  { state: '', withState: true },
)

const emit = defineEmits<{ apply: [value: { schoolId: string; state: string }] }>()

/** A select item cannot carry an empty value, so "all" travels as this word and maps to "". */
const ALL = 'all'

const school = ref(props.schoolId)
const stateValue = ref(props.state)
watch(
  () => [props.schoolId, props.state] as const,
  ([s, st]) => {
    school.value = s
    stateValue.value = st
  },
)

const schoolItems = computed(() => [
  { label: 'Semua Sekolah', value: ALL },
  ...(props.options?.schools ?? []).map((s) => ({ label: s.name, value: String(s.id) })),
])
const stateItems = computed(() => [
  { label: 'Semua Negeri', value: ALL },
  ...(props.options?.states ?? []).map((s) => ({ label: s, value: s })),
])
const schoolModel = computed({
  get: () => (school.value === '' ? ALL : school.value),
  set: (v: string) => {
    school.value = v === ALL ? '' : v
  },
})
const stateModel = computed({
  get: () => (stateValue.value === '' ? ALL : stateValue.value),
  set: (v: string) => {
    stateValue.value = v === ALL ? '' : v
  },
})

function submit() {
  emit('apply', { schoolId: school.value, state: props.withState ? stateValue.value : '' })
}
</script>

<template>
  <UCard>
    <form class="flex flex-wrap items-end gap-4" data-testid="kirk-filter" @submit.prevent="submit">
      <UFormField label="Sekolah" class="min-w-0 basis-full sm:basis-64">
        <USelect
          v-model="schoolModel"
          :items="schoolItems"
          name="school_id"
          class="w-full"
          data-testid="kirk-filter-school"
        />
      </UFormField>
      <UFormField v-if="withState" label="Negeri" class="min-w-0 basis-full sm:basis-48">
        <USelect
          v-model="stateModel"
          :items="stateItems"
          name="state"
          class="w-full"
          data-testid="kirk-filter-state"
        />
      </UFormField>
      <UButton
        type="submit"
        size="md"
        icon="i-ph-funnel"
        label="Tapis"
        data-testid="kirk-filter-apply"
      />
      <UButton
        v-if="schoolId !== '' || (withState && state !== '')"
        :to="resetTo"
        size="md"
        color="neutral"
        variant="soft"
        icon="i-ph-x"
        label="Reset"
        data-testid="kirk-filter-reset"
      />
    </form>
  </UCard>
</template>
