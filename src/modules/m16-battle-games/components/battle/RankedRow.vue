<script setup lang="ts">
/**
 * Ranked row with a stats grid (v2 learner look; a domain composite in the style of `DsLeaderRow`, which has
 * no room for the extra figures of the Top 10, the student ranking and the school ranking). Rank chip
 * (ranks 1-3 lime), optional initials avatar, title with a muted subtitle, then the default slot with the
 * stats (`<dl>` cells). Wraps under the name below `sm`, so the page never scrolls sideways.
 */
withDefaults(
  defineProps<{
    rank: number
    /** Text of the rank chip when it is not the number (a medal). */
    rankLabel?: string
    title: string
    subtitle?: string
    /** Initials of the avatar; no avatar when omitted. */
    initials?: string
    /** Link of the title. */
    to?: string
  }>(),
  { rankLabel: undefined, subtitle: undefined, initials: undefined, to: undefined },
)
</script>

<template>
  <li
    class="flex flex-col gap-3 rounded-card bg-default p-3 learner:shadow-lift sm:flex-row sm:items-center"
    data-ds="ranked-row"
  >
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <span
        class="tabular grid size-10 shrink-0 place-items-center rounded-chip font-display text-label font-extrabold"
        :class="rank <= 3 ? 'bg-highlight text-on-highlight' : 'bg-elevated text-muted'"
        data-testid="row-rank"
        >{{ rankLabel ?? rank }}</span
      >
      <UAvatar v-if="initials" :text="initials" size="md" data-testid="row-avatar" />
      <span class="flex min-w-0 flex-col">
        <ULink
          v-if="to"
          :to="to"
          class="text-label break-words text-highlighted hover:underline"
          data-testid="row-title"
          >{{ title }}</ULink
        >
        <span v-else class="truncate text-label text-highlighted" data-testid="row-title">{{
          title
        }}</span>
        <span v-if="subtitle" class="text-caption text-muted">{{ subtitle }}</span>
      </span>
    </div>
    <dl class="grid grid-cols-3 items-center gap-2 sm:flex sm:gap-6">
      <slot />
    </dl>
  </li>
</template>
