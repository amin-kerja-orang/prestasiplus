<script setup lang="ts">
/**
 * A native radio drawn as a selectable tile (difficulty and Betul / Salah choices). The radio keeps the
 * browser group, `required` validation and keyboard; the tile shows the checked state through a layer
 * change (no border), so it lives outside the strict globs like the other `native/` wrappers.
 */
defineOptions({ inheritAttrs: false })
defineProps<{ value: string; name: string; required?: boolean; invalid?: boolean }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <label class="relative block min-w-0">
    <input
      v-model="model"
      type="radio"
      :name="name"
      :value="value"
      :required="required"
      v-bind="$attrs"
      class="peer absolute inset-0 size-full cursor-pointer opacity-0"
    />
    <span
      class="flex h-full min-h-11 flex-col items-center justify-center gap-1 rounded-card px-3 py-2 text-center text-label text-default transition peer-checked:bg-primary peer-checked:text-primary-on peer-focus-visible:outline-2 peer-focus-visible:outline-primary"
      :class="invalid ? 'bg-error/10' : 'bg-elevated hover:bg-accented'"
    >
      <slot />
    </span>
  </label>
</template>
