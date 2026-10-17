<script setup lang="ts">
/**
 * A radio shown as a choice card (the S2/S3 "Tahap Pendidikan" cards, the S4 role cards). The radio is
 * native and visually hidden (arrow keys and the label work as-is); the checked card is filled with the
 * primary colour. Attributes (for example a test id) land on the wrapping label; `inputTestid` on the radio.
 */
const model = defineModel<unknown>()
defineProps<{
  name: string
  value: unknown
  label?: string
  required?: boolean
  inputTestid?: string
}>()
</script>

<template>
  <label class="block">
    <input
      v-model="model"
      type="radio"
      class="peer sr-only"
      :name="name"
      :value="value"
      :required="required"
      :data-testid="inputTestid"
    />
    <span
      class="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-card bg-elevated px-3 py-2 text-center text-label text-default hover:bg-accented peer-checked:bg-primary peer-checked:text-inverted peer-focus-visible:outline-2 peer-focus-visible:outline-primary"
    >
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>
