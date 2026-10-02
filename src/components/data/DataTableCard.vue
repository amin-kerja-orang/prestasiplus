<script setup lang="ts">
/**
 * Table card (F-16; design-system §7.4; overview §9): a white `rounded-2xl` card whose table
 * scrolls horizontally inside the card, never the page (NFR-RESP-05 b). No sticky or pinned
 * column: design-system §7.4 "DECIDED" (supersedes the overview's optional sticky column).
 *
 * `minWidth` (px) sets the table's natural width, so it scrolls in the card below that width
 * and fits above it (e.g. M02 S1 fits from 1280). Slots: `default` (the `<table>`; use
 * `TABLE_CLASSES` for header/cell classes, min 12 px), `header` (card title strip) and
 * `footer` (e.g. `LaravelPager`, outside the scroller).
 */
import { TABLE_CLASSES as T } from './classes'

withDefaults(defineProps<{ minWidth?: number }>(), { minWidth: undefined })
</script>

<template>
  <div :class="T.card">
    <slot name="header" />
    <div :class="T.scroller">
      <div :style="minWidth ? { minWidth: `${minWidth}px` } : undefined">
        <slot />
      </div>
    </div>
    <slot name="footer" />
  </div>
</template>
