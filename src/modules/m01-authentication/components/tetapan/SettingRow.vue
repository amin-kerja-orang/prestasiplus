<script setup lang="ts">
/**
 * One checkbox row of S9 "Mod Rohani" (FR-M01-46): bold label + description, and for the Subuh and
 * Ramadan rows a `type=time` input. Below `sm` the time input drops under the text, full width
 * (DV-08); from `sm` it sits to the right. The time input is always editable (no dependency on
 * the checkbox, as live).
 */
defineProps<{
  /** Field id prefix; also the `data-testid` prefix (`tetapan-<id>`). */
  id: string
  label: string
  description: string
  hasTime?: boolean
}>()

const checked = defineModel<boolean>('checked', { required: true })
const time = defineModel<string>('time', { default: '' })
</script>

<template>
  <div
    class="flex flex-col gap-3 border-b border-slate-100 py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
  >
    <div class="flex min-w-0 flex-1 items-start gap-3">
      <input
        :id="id"
        v-model="checked"
        type="checkbox"
        :name="id"
        value="1"
        class="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-400 accent-teal-600"
        :data-testid="`tetapan-${id}`"
      />
      <div class="min-w-0">
        <label
          :for="id"
          class="flex min-h-7 cursor-pointer items-center text-base font-semibold text-slate-900"
        >
          {{ label }}
        </label>
        <p class="text-sm leading-relaxed text-slate-500">{{ description }}</p>
      </div>
    </div>
    <input
      v-if="hasTime"
      v-model="time"
      type="time"
      :name="`${id}_time`"
      class="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-300 sm:w-auto sm:shrink-0"
      :data-testid="`tetapan-${id}-time`"
    />
  </div>
</template>
