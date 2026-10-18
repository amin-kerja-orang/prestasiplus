<script setup lang="ts">
/**
 * Identity cell: avatar + name + muted second line (e-mail, code), for a table row or a detail card.
 * Leave `initials` out to show the name only. The `name` slot lets a page mark up the name (test id,
 * link) while the avatar and the second line stay canonical.
 */
defineProps<{
  name: string
  sub?: string
  src?: string | null
  /** Avatar initials; the avatar is left out without them. */
  initials?: string
}>()
</script>

<template>
  <div class="flex min-w-0 items-center gap-3 text-start" data-ds="identity">
    <UAvatar v-if="initials" :src="src || undefined" :text="initials" alt="" size="md" />
    <div class="flex min-w-0 flex-col">
      <span class="truncate text-body font-semibold text-highlighted" data-ds="identity-name">
        <slot name="name">{{ name }}</slot>
      </span>
      <span v-if="sub" class="truncate text-label text-muted" data-ds="identity-sub">{{
        sub
      }}</span>
    </div>
  </div>
</template>
