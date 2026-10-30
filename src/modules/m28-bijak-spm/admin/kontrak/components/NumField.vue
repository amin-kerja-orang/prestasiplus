<script setup lang="ts">
/**
 * Whole-number input of the Kontrak editor: empty = `null`, touch height 44 px, no wheel change
 * (design 8, "Number inputs"). Label and errors come from the surrounding `DsFormField native`.
 */
withDefaults(
  defineProps<{
    id?: string
    min?: number
    max?: number
    invalid?: boolean
    describedby?: string
    readonly?: boolean
    disabled?: boolean
    ariaLabel?: string
    placeholder?: string
  }>(),
  {
    id: undefined,
    min: 0,
    max: undefined,
    invalid: false,
    describedby: undefined,
    readonly: false,
    disabled: false,
    ariaLabel: undefined,
    placeholder: undefined,
  },
)
const model = defineModel<number | null>({ default: null })

function onInput(v: string | number | undefined): void {
  if (v === '' || v === undefined || v === null) {
    model.value = null
    return
  }
  const n = Number(v)
  model.value = Number.isFinite(n) ? Math.trunc(n) : null
}
</script>

<template>
  <UInput
    :id="id"
    :model-value="model === null ? '' : String(model)"
    type="number"
    inputmode="numeric"
    :min="min"
    :max="max"
    step="1"
    :aria-invalid="invalid ? 'true' : undefined"
    :aria-describedby="describedby"
    :aria-label="ariaLabel"
    :readonly="readonly"
    :disabled="disabled"
    :placeholder="placeholder"
    :ui="{ base: 'min-h-11' }"
    class="w-full"
    @update:model-value="onInput"
    @wheel.prevent
  />
</template>
