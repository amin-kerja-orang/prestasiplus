<script setup lang="ts">
/**
 * Raised panel of the admin pattern (`docs/design/v2-admin-pages.md`): the surface that holds a
 * toolbar, a table or a summary on the page layer. `flush` drops the padding (tables go edge to
 * edge), `tone="bulk"` is the sticky selection bar. Surface, radius and shadow live here, so pages
 * never name them.
 */
withDefaults(
  defineProps<{
    /** `raised` = page-layer card; `bulk` = sticky selection bar on the elevated layer; `bar` = sticky bottom action bar of a form. */
    tone?: 'raised' | 'bulk' | 'bar'
    flush?: boolean
  }>(),
  { tone: 'raised', flush: false },
)
</script>

<template>
  <div
    class="min-w-0 overflow-clip rounded-card"
    :class="[
      tone === 'bulk'
        ? 'sticky top-2 z-20 bg-elevated shadow-lift'
        : tone === 'bar'
          ? 'sticky bottom-2 z-20 bg-elevated shadow-lift'
          : 'bg-default shadow-ds-xs',
      flush ? '' : 'p-3 sm:p-4',
    ]"
    :data-tone="tone"
    data-ds="panel"
  >
    <slot />
  </div>
</template>
