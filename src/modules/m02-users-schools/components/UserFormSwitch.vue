<script setup lang="ts">
import { DsCluster } from '@/ds'

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
  <DsCluster :wrap="false" class="min-h-11">
    <USwitch
      v-model="model"
      :name="name"
      :description="hint"
      color="success"
      class="min-w-0 flex-1"
      :data-testid="testid"
    >
      <template #label>
        <DsCluster as="span" gap="xs" :wrap="false">
          <slot name="icon" />
          {{ label }}
        </DsCluster>
      </template>
    </USwitch>
    <slot name="aside" />
  </DsCluster>
</template>
