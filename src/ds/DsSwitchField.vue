<script setup lang="ts">
/**
 * Switch with its label and optional caption (the DS way to render "Muat semula automatik" and
 * every on/off setting). The control sits in a 44px touch box; the label is centred on it and the
 * caption goes directly under the label. Wraps `USwitch` (theme: `switch` slots in `ui.config.ts`).
 * Use it instead of a bare `USwitch` plus a hand-built label.
 */
const model = defineModel<boolean>({ default: false })

withDefaults(
  defineProps<{
    label: string
    /** Caption under the label. */
    description?: string
    name?: string
    disabled?: boolean
    loading?: boolean
    color?: 'primary' | 'success'
  }>(),
  { description: undefined, name: undefined, disabled: false, loading: false, color: 'primary' },
)
</script>

<template>
  <USwitch
    v-model="model"
    :label="label"
    :description="description"
    :name="name"
    :disabled="disabled"
    :loading="loading"
    :color="color"
    class="w-fit max-w-full"
    data-ds="switch-field"
  />
</template>
