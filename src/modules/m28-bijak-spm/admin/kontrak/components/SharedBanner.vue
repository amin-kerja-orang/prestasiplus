<script setup lang="ts">
/**
 * K9: banner "Kontrak dikongsi." with the shared-gate warning (V2 Panel `kontrak.tsx`,
 * docs/discovery/BIJAK-SPM-cloud.md P4; AC-06.5). `scope` picks the list wording ("Setiap kontrak di
 * bawah ...") or the editor wording.
 */
defineProps<{ scope: 'list' | 'editor' }>()
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    icon="i-ph-warning"
    :ui="{ root: 'min-w-0' }"
    data-testid="kontrak-shared-banner"
  >
    <template #title><span class="font-semibold">Kontrak dikongsi.</span></template>
    <template #description>
      <span v-if="scope === 'list'"
        >Setiap kontrak di bawah ialah peraturan bagi satu subjek × kertas — bukan satu set soalan. </span
      >Menyunting kontrak ini mengubah pintu terbitan (publish gate) untuk <strong>SEMUA</strong> kertas subjek
      tersebut, bukan hanya satu kertas.
    </template>
  </UAlert>
</template>
