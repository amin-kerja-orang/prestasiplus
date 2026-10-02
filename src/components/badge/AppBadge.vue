<script setup lang="ts">
/**
 * Status / label pill (F-15 `Badge`/`Pill`; overview §9, design-system §4–§5).
 * No built-in colour scheme: the caller passes the full live class string (e.g. the sidebar
 * LIVE pill `ml-auto text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold
 * animate-pulse`). Finite sets are lookup maps of full class strings in the owning module
 * (overview §8.2 rule 2). The label is literal live copy (`LIVE`, `NEW`, "Menunggu", ...).
 */
withDefaults(
  defineProps<{
    badgeClass: string
    label?: string | number
    /** Element to render; live pills are `<span>`. */
    as?: string
  }>(),
  { label: undefined, as: 'span' },
)

defineSlots<{ default?: () => unknown }>()
</script>

<template>
  <component :is="as" :class="badgeClass">
    <slot>{{ label }}</slot>
  </component>
</template>
