<script setup lang="ts">
/**
 * Ranked row (leaderboard). Rank chip: ranks 1-3 lime (A2) with an optional 3D medal, others
 * neutral; avatar; name with the school muted; points as a display numeral. `own` tints the row
 * with the primary colour. Staff gets the flat row (no lift), learner the raised one.
 */
import type { Art3DName } from './assets'
import { dsCopy } from './copy'
import DsArt3D from './DsArt3D.vue'

withDefaults(
  defineProps<{
    rank: number
    name: string
    school?: string
    points: string | number
    /** Unit after the points, e.g. "mata" (BM). */
    unit?: string
    /** The signed-in user's own row. */
    own?: boolean
    /** 3D medal shown in the rank chip for ranks 1-3. */
    medal?: Art3DName
    avatarSrc?: string
    /** Visible-to-AT label of the own-row marker, e.g. "Anda". */
    ownLabel?: string
  }>(),
  {
    school: undefined,
    unit: undefined,
    own: false,
    medal: undefined,
    avatarSrc: undefined,
    ownLabel: dsCopy.ownRow,
  },
)
</script>

<template>
  <li
    class="flex min-h-16 items-center gap-3 rounded-card p-3 learner:shadow-lift staff:min-h-12 staff:bg-soft"
    :class="own ? 'bg-primary/12' : 'bg-default'"
    :aria-current="own ? 'true' : undefined"
    data-ds="leader-row"
  >
    <span
      class="tabular grid size-10 shrink-0 place-items-center rounded-chip font-display text-label font-extrabold"
      :class="rank <= 3 ? 'bg-highlight text-on-highlight' : 'bg-elevated text-muted'"
      data-ds="leader-rank"
    >
      <DsArt3D v-if="medal && rank <= 3" :name="medal" size="sm" />
      <template v-else>{{ rank }}</template>
    </span>
    <UAvatar :src="avatarSrc" :alt="name" :text="name.slice(0, 2).toUpperCase()" size="md" />
    <span class="flex min-w-0 grow flex-col">
      <span class="truncate text-label text-highlighted">
        {{ name }}
        <UBadge v-if="own" size="sm" variant="soft" :label="ownLabel" class="ms-1" />
      </span>
      <span v-if="school" class="truncate text-caption text-muted">{{ school }}</span>
    </span>
    <span class="tabular shrink-0 text-end font-display text-heading font-extrabold text-highlighted">
      {{ points }}
      <span v-if="unit" class="text-caption font-semibold text-muted">{{ unit }}</span>
    </span>
  </li>
</template>
