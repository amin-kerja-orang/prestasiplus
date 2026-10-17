<script setup lang="ts">
/**
 * Page root helper (restyle spec 1.2): optional title block (one `h1` + subtitle), content width
 * by personality, standard gaps and an actions slot. Pages that already print the shell title
 * leave `title` out.
 */
defineProps<{
  title?: string
  subtitle?: string
}>()
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 md:gap-6 staff:max-w-screen-2xl"
    data-ds="page"
  >
    <header
      v-if="title || $slots.actions"
      class="flex flex-wrap items-start justify-between gap-3"
      data-ds="page-header"
    >
      <div class="flex min-w-0 flex-col gap-1">
        <h1
          v-if="title"
          class="font-display text-title font-extrabold text-highlighted"
          data-ds="page-title"
        >
          {{ title }}
        </h1>
        <p v-if="subtitle" class="max-w-prose text-body text-muted">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </div>
</template>
