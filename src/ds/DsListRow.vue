<script setup lang="ts">
/**
 * One row of a feed, ranked or shortcut list (admin page templates G11). Leading: a rank chip
 * (`rank`), a `leading` slot (an icon chip, a badge, a time) or nothing. Then the title, an optional
 * `sub` line (slot `#sub`, which may hold a link when the row itself is not one) and a trailing
 * `meta` (slot `#meta` for a badge or a pair of figures). With `to` the whole row is a link, with
 * `button` it is a button that emits `select` (opens a drawer); either way the whole row is the tap
 * target. The row renders an `li`: put it inside a `DsStack as="ul"`. Ranks 1-3 are highlighted, the
 * rest neutral (as `DsLeaderRow`).
 */
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import { formatStat } from './format'

withDefaults(
  defineProps<{
    title: string
    sub?: string
    /** Trailing figure or text; numbers are formatted ("1,271"). */
    meta?: string | number | null
    to?: RouteLocationRaw
    /** The row is an action (opens a drawer), not a link; `select` fires on click and Enter. */
    button?: boolean
    /** Position in a ranked list (1-based). */
    rank?: number
    /** Native tooltip of the title (the full text of an abbreviated name). */
    titleHint?: string
    density?: 'default' | 'tight'
  }>(),
  {
    sub: undefined,
    meta: undefined,
    to: undefined,
    button: false,
    rank: undefined,
    titleHint: undefined,
    density: 'default',
  },
)
const emit = defineEmits<{ select: [] }>()
</script>

<template>
  <li class="min-w-0" data-ds="list-row">
    <component
      :is="to ? RouterLink : button ? 'button' : 'div'"
      v-bind="to ? { to } : button ? { type: 'button', 'aria-haspopup': 'dialog' } : {}"
      class="flex w-full min-w-0 items-center gap-3 rounded-chip bg-soft px-3 text-start"
      :class="[
        density === 'tight' ? 'min-h-11 py-1.5' : 'min-h-14 py-2',
        to || button ? 'hover:bg-elevated active:opacity-90' : '',
      ]"
      :data-ds="to || button ? 'list-row-link' : 'list-row-body'"
      @click="button ? emit('select') : undefined"
    >
      <span
        v-if="rank !== undefined"
        class="tabular grid size-8 shrink-0 place-items-center rounded-chip font-display text-label font-extrabold"
        :class="rank <= 3 ? 'bg-highlight text-on-highlight' : 'bg-elevated text-muted'"
        data-ds="list-row-rank"
        >{{ rank }}</span
      >
      <slot name="leading" />
      <span class="flex min-w-0 grow flex-col">
        <span
          class="line-clamp-2 min-w-0 text-label break-words text-highlighted"
          :title="titleHint"
          data-ds="list-row-title"
          >{{ title }}</span
        >
        <span v-if="sub || $slots.sub" class="min-w-0 text-caption break-words text-muted" data-ds="list-row-sub"
          ><slot name="sub">{{ sub }}</slot></span
        >
      </span>
      <span
        v-if="$slots.meta || (meta !== undefined && meta !== null)"
        class="tabular max-w-1/2 shrink-0 text-end text-label text-highlighted"
        data-ds="list-row-meta"
        ><slot name="meta">{{ formatStat(meta) }}</slot></span
      >
    </component>
  </li>
</template>
