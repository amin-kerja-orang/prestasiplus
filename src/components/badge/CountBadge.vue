<script setup lang="ts">
/**
 * Numeric count badge (F-15; design-system §4 "Bell count badge" and "Sidebar count pills";
 * shells.md §4).
 * E.g. the user-shell bell: `cap` 99 → "99+", hidden at 0 (M01 FR-M01-53); sidebar counts
 * ("Urus Tiket 2", "Gambar Rajah 6,144") use no cap. Class string passed in, as `AppBadge`.
 */
import { computed } from 'vue'

import { countLabel } from './count-label'

const props = withDefaults(
  defineProps<{
    count: number
    badgeClass: string
    /** Counts above `cap` read "{cap}+". */
    cap?: number
    /** Hide the badge when the count is 0 (live bell). */
    hideZero?: boolean
    as?: string
  }>(),
  { cap: undefined, hideZero: true, as: 'span' },
)

const visible = computed(() => !(props.hideZero && !(props.count > 0)))
const text = computed(() => countLabel(props.count, props.cap))
</script>

<template>
  <component :is="as" v-if="visible" :class="badgeClass">{{ text }}</component>
</template>
