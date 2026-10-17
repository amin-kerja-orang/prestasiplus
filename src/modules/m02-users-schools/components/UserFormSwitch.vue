<script setup lang="ts">
/**
 * The pill switch of S2 "Aktifkan Akaun" and S3 "Status Aktif" (FR-M02-22, FR-M02-44) and S3 "Pakej PKSK"
 * (FR-M02-40): a native checkbox (keyboard and label work as-is). The 44 px row is the touch target.
 */
import NativeSwitch from './native/NativeSwitch.vue'

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
  <label class="flex min-h-11 cursor-pointer items-center gap-3">
    <NativeSwitch v-model="model" :name="name" :data-testid="testid" />
    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-2 text-label text-default">
        <slot name="icon" />
        {{ label }}
      </span>
      <span v-if="hint" class="block text-caption text-muted">{{ hint }}</span>
    </span>
    <slot name="aside" />
  </label>
</template>
