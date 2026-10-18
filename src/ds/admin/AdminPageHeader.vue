<script setup lang="ts">
/**
 * PHASE 1: fold into DsPageHeader (docs/design/v2-ds-consolidation.md). Interim kit for the M02/M22/M03
 * admin revamp; do not build new screens on it.
 */
/**
 * Compact page header of the Portal Pentadbiran pages: a one-line muted subtitle on the left and the
 * primary actions on the right. The shell prints the page title, so `title` is optional (screen
 * readers get it as a visually hidden `h1`).
 */
defineProps<{
  title?: string
  subtitle?: string
}>()
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-4" data-ds="admin-header">
    <div class="flex min-w-0 flex-col gap-1">
      <h1 v-if="title" class="sr-only">{{ title }}</h1>
      <slot name="subtitle"
        ><p v-if="subtitle" class="text-body text-muted">{{ subtitle }}</p></slot
      >
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-3">
      <slot name="actions" />
    </div>
  </header>
</template>
