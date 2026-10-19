<script setup lang="ts">
/**
 * One toggle row of S9 "Mod Rohani" (FR-M01-46): label + description on the left, a `USwitch` on
 * the right and, for the Subuh and Ramadan rows, a `type=time` input. Below `sm` the control and
 * the time input drop under the text (stacked); from `sm` they sit to the right. The time input is
 * always editable (no dependency on the switch, as live). Row min height 56px, no dividers.
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
  <div class="flex min-h-14 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
    <div class="min-w-0 flex-1">
      <label :for="id" class="block text-label text-highlighted">{{ label }}</label>
      <p class="text-caption text-muted">{{ description }}</p>
    </div>
    <div class="flex flex-wrap items-center gap-3 sm:shrink-0">
      <UInput
        v-if="hasTime"
        v-model="time"
        type="time"
        :name="`${id}_time`"
        size="lg"
        class="w-full sm:w-auto"
        :aria-label="`Masa ${label}`"
        :data-testid="`tetapan-${id}-time`"
      />
      <USwitch
        :id="id"
        v-model="checked"
        :name="id"
        value="1"
        size="lg"
        :data-testid="`tetapan-${id}`"
      />
    </div>
  </div>
</template>
