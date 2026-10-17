<script setup lang="ts">
/**
 * Title block of an M08 page (restyle spec 1.2): the one `h1`, an optional muted line, a leading slot
 * (back button) and an actions slot. Same look as `DsPage`'s header, but the caller keeps its test ids.
 */
defineProps<{
  title: string
  subtitle?: string
  titleTestid?: string
  subtitleTestid?: string
}>()
</script>

<template>
  <header class="flex flex-wrap items-start justify-between gap-3">
    <div class="flex min-w-0 items-start gap-2">
      <slot name="leading" />
      <div class="flex min-w-0 flex-col gap-1">
        <h1
          class="font-display text-title font-extrabold break-words text-highlighted"
          :data-testid="titleTestid"
        >
          {{ title }}
        </h1>
        <p v-if="subtitle" class="max-w-prose text-body text-muted" :data-testid="subtitleTestid">
          <slot name="subtitle">{{ subtitle }}</slot>
        </p>
      </div>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
