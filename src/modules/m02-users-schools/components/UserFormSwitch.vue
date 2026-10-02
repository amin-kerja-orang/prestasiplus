<script setup lang="ts">
/**
 * The pill switch of S2 "Aktifkan Akaun" and S3 "Status Aktif" (FR-M02-22, FR-M02-44) and S3 "Pakej PKSK"
 * (FR-M02-40): a native checkbox (keyboard and label work as-is) with an emerald track when on.
 * The 44 px row is the touch target.
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
  <label class="flex min-h-11 cursor-pointer items-center gap-3">
    <input
      v-model="model"
      type="checkbox"
      :name="name"
      class="peer sr-only"
      :data-testid="testid"
    />
    <span
      class="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      aria-hidden="true"
    ></span>
    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <slot name="icon" />
        {{ label }}
      </span>
      <span v-if="hint" class="block text-xs text-slate-500">{{ hint }}</span>
    </span>
    <slot name="aside" />
  </label>
</template>
