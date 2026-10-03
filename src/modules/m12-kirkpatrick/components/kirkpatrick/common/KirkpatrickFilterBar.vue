<script setup lang="ts">
/**
 * School / state filter card of S1 (FN-M12-2.1.1) and, with `withState` off, S4 (FN-M12-5.1.1): label
 * above each select, "Tapis" (indigo, funnel), and "Reset" (`X`, slate) only when a filter is set. A GET
 * form on live; here it emits `apply` and the page navigates to its own prefix with `school_id` (and
 * `state`) in the query. Selects are 44 px tall (DV-M12-07 asks 36; the touch rule is 44) and never wider
 * than the card.
 *
 * PROPOSED presentation: live has no filter form on the alias and its selects are 18 px tall (DV-M12-07); the
 * label-above layout, the 44 px / 36 px heights and the wrap rules are the rebuild's.
 */
import { Funnel, X } from '@lucide/vue'
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import type { FilterOptions } from '../../../api/types'
import { CARD } from './kirkpatrick-format'

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

const school = ref(props.schoolId)
const stateValue = ref(props.state)
watch(
  () => [props.schoolId, props.state] as const,
  ([s, st]) => {
    school.value = s
    stateValue.value = st
  },
)

const SELECT =
  'min-h-11 lg:min-h-9 w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700'
const LABEL = 'text-xs font-semibold text-slate-500'

function submit() {
  emit('apply', { schoolId: school.value, state: props.withState ? stateValue.value : '' })
}
</script>

<template>
  <form
    :class="[CARD, 'flex flex-wrap items-end gap-3 p-3 sm:p-4']"
    data-testid="kirk-filter"
    @submit.prevent="submit"
  >
    <label class="flex min-w-0 basis-full flex-col gap-1 sm:basis-auto">
      <span :class="LABEL">Sekolah</span>
      <select v-model="school" name="school_id" :class="SELECT" data-testid="kirk-filter-school">
        <option value="">Semua Sekolah</option>
        <option v-for="s in options?.schools ?? []" :key="s.id" :value="String(s.id)">
          {{ s.name }}
        </option>
      </select>
    </label>
    <label
      v-if="withState"
      class="flex min-w-0 basis-[calc(50%-0.5rem)] flex-col gap-1 sm:basis-auto"
    >
      <span :class="LABEL">Negeri</span>
      <select v-model="stateValue" name="state" :class="SELECT" data-testid="kirk-filter-state">
        <option value="">Semua Negeri</option>
        <option v-for="s in options?.states ?? []" :key="s" :value="s">{{ s }}</option>
      </select>
    </label>
    <button
      type="submit"
      class="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
      data-testid="kirk-filter-apply"
    >
      <Funnel class="h-4 w-4" />Tapis
    </button>
    <RouterLink
      v-if="schoolId !== '' || (withState && state !== '')"
      :to="resetTo"
      class="flex min-h-11 items-center gap-1 rounded-lg bg-slate-200 px-3 text-sm text-slate-700 hover:bg-slate-300"
      data-testid="kirk-filter-reset"
    >
      <X class="h-4 w-4" />Reset
    </RouterLink>
  </form>
</template>
