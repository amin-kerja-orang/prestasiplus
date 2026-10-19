<script setup lang="ts">
/**
 * The switch of S2 "Aktifkan Akaun" and S3 "Status Aktif" (FR-M02-22, FR-M02-44) and S3 "Pakej PKSK"
 * (FR-M02-40): a `USwitch` (on = success) with the label and hint beside it. The 44 px row is the touch target.
 */
const model = defineModel<boolean>({ required: true })

defineProps<{
  label: string
  hint?: string
  name?: string
  testid?: string
}>()

defineSlots<{ icon?: () => unknown; aside?: () => unknown }>()
</script>

<template>
  <div class="flex min-h-11 items-center gap-3">
    <USwitch
      v-model="model"
      :name="name"
      :description="hint"
      color="success"
      class="min-w-0 flex-1"
      :data-testid="testid"
    >
      <template #label>
        <span class="flex items-center gap-2">
          <slot name="icon" />
          {{ label }}
        </span>
      </template>
    </USwitch>
    <slot name="aside" />
  </div>
</template>
