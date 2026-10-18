<script setup lang="ts">
/**
 * A cell of `AdminTable`: 56px row height with 12px padding. Below `md` it prints `label` before the
 * value (a CSS label from `data-label`, so the cell text stays the value); `colspan` cells (empty /
 * skeleton rows) are centred blocks.
 */
defineProps<{ label?: string; colspan?: number }>()
</script>

<template>
  <td
    class="px-2 py-3 align-middle md:h-14"
    :class="
      colspan
        ? 'block py-10 text-center md:table-cell'
        : 'flex min-h-11 items-center justify-between gap-4 before:shrink-0 before:text-caption before:text-muted before:content-[attr(data-label)] max-md:text-end md:table-cell md:before:content-none'
    "
    :colspan="colspan"
    :data-label="colspan ? undefined : label"
  >
    <slot />
  </td>
</template>
