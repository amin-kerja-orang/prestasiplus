<script setup lang="ts">
/**
 * PHASE 1: fold into DsStatRow (with DsStatTile compact/roomy) (docs/design/v2-ds-consolidation.md). Interim kit for the M02/M22/M03
 * admin revamp; do not build new screens on it.
 */
/** A strip of KPI tiles (`DsStatTile compact`): 1 / 2 / 3 / 4 columns, 6 on very wide screens. */
defineProps<{ label?: string }>()
</script>

<template>
  <section
    class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"
    :aria-label="label"
    data-ds="admin-kpis"
  >
    <slot />
  </section>
</template>
