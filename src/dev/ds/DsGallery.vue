<script setup lang="ts">
/**
 * `/__ds` design-system gallery (V2-T05). Dev and demo only. Shows every composite of `@/ds` in
 * staff and learner, light and dark. The page itself runs a real portal theme (the "global" choice
 * below) so teleported overlays (picker sheet, toasts) take the active tokens.
 */
import { computed, ref } from 'vue'

import { DsThemeScope } from '@/ds'
import { useThemeMode, type Personality, type Scheme } from '@/theme/color-mode'
import { uiLocale } from '@/theme/locale-ms'

import DsGalleryShowcase from './DsGalleryShowcase.vue'

const globalPersonality = ref<Personality>('learner')
const { scheme, toggle } = useThemeMode(globalPersonality)

type Filter = 'semua' | Personality
const filter = ref<Filter>('semua')
const filters: { value: Filter; label: string }[] = [
  { value: 'semua', label: 'Semua' },
  { value: 'staff', label: 'Staf' },
  { value: 'learner', label: 'Murid' },
]

const panels = computed(() => {
  const all: { personality: Personality; scheme: Scheme; title: string }[] = [
    { personality: 'staff', scheme: 'light', title: 'Staf, cerah' },
    { personality: 'staff', scheme: 'dark', title: 'Staf, gelap' },
    { personality: 'learner', scheme: 'light', title: 'Murid, cerah' },
    { personality: 'learner', scheme: 'dark', title: 'Murid, gelap' },
  ]
  return all.filter((p) => filter.value === 'semua' || p.personality === filter.value)
})
</script>

<template>
  <UApp :locale="uiLocale">
    <main
      class="flex min-w-0 flex-col gap-4 bg-muted p-4 text-default md:p-8"
      data-testid="ds-gallery"
    >
      <header class="flex flex-col gap-3">
        <h1 class="text-title">Galeri komposit (/__ds)</h1>
        <p class="text-body text-muted">
          Setiap komposit dalam `src/ds`, pada tema staf dan murid, mod cerah dan gelap.
        </p>
        <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Penapis tema">
          <UButton
            v-for="f in filters"
            :key="f.value"
            :variant="filter === f.value ? 'solid' : 'soft'"
            :color="filter === f.value ? 'primary' : 'neutral'"
            :aria-pressed="filter === f.value"
            @click="filter = f.value"
          >
            {{ f.label }}
          </UButton>
        </div>
        <div
          class="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Tema global untuk lapisan"
        >
          <UButton
            color="neutral"
            variant="soft"
            :aria-pressed="globalPersonality === 'learner'"
            @click="globalPersonality = globalPersonality === 'learner' ? 'staff' : 'learner'"
          >
            Lapisan: {{ globalPersonality === 'learner' ? 'Murid' : 'Staf' }}
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            :icon="scheme === 'dark' ? 'i-ph-sun' : 'i-ph-moon'"
            @click="toggle"
          >
            {{ scheme === 'dark' ? 'Cerah' : 'Gelap' }}
          </UButton>
        </div>
      </header>

      <UAlert
        color="info"
        variant="subtle"
        icon="i-ph-info"
        title="Jurang diketahui (V2-T05)"
        description="Putaran pelekat tetap -4° (tiada token untuk +3°), kad pilihan rakan tidak diskala 1.02, seni 3D tiada drop-shadow, cahaya kemenangan ialah cakera rata (bukan radial), tiada konfeti, kelewatan masuk berperingkat pada jubin statistik tiada."
      />

      <div class="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <DsThemeScope
          v-for="panel in panels"
          :key="`${panel.personality}-${panel.scheme}`"
          :personality="panel.personality"
          :scheme="panel.scheme"
          :data-testid="`ds-panel-${panel.personality}-${panel.scheme}`"
        >
          <h2 class="mb-4 text-heading">{{ panel.title }}</h2>
          <DsGalleryShowcase />
        </DsThemeScope>
      </div>
    </main>
  </UApp>
</template>
