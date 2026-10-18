<script setup lang="ts">
/** Avatar + name + muted second line (email, code) in one table cell. */
defineProps<{
  name: string
  sub?: string
  src?: string | null
  /** Avatar initials; leave out to show the name only. */
  initials?: string
}>()
</script>

<template>
  <div class="flex min-w-0 items-center gap-3 text-start">
    <UAvatar v-if="initials" :src="src || undefined" :text="initials" alt="" size="md" />
    <div class="flex min-w-0 flex-col">
      <span class="truncate text-body font-semibold text-highlighted" data-ds="identity-name">
        <slot name="name">{{ name }}</slot>
      </span>
      <span v-if="sub" class="truncate text-label text-muted">{{ sub }}</span>
    </div>
  </div>
</template>
