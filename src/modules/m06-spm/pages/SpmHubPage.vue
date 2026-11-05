<script setup lang="ts">
/**
 * S1 `/spm` "Mod SPM" (M06-T2; FR-M06-01…05, BR-M06-01, DV-M06-01/03/04), restyled for v2.
 *
 * Pill, h1 and lead; the Bijak SPM hero card; four KPI tiles (2 columns, 4 from `md`); five feature
 * cards as whole-card links (1 / `md` 2 / `lg` 3 / `xl` 5 columns) with accent chips (the live Font Awesome Pro
 * names render blank, DV-M06-03); "Prestasi SPM Anda" (the caller's SPM stats) and the "Sejarah Kuiz
 * SPM" link. S3-T07: five cards (Kertas Subjektif last); "Tahun Tersedia" is hidden while the overview
 * carries no `yearsAvailable`; a card with zero content shows its data-empty text and is not a link.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { useApi, useRouteExists } from '@/composables'
import { DsHeroCard, DsIconChip, DsPage, DsPanel, DsStatTile, type DsAccent, DsLoadError } from '@/ds'
import { formatCount, formatNumber } from '@/lib/number'

import { fetchSpmOverview } from '../api'
import SkeletonCards from '../components/SkeletonCards.vue'
import { LOAD_ERROR } from '../lib/copy'

const { routeExists } = useRouteExists()
const { data, error, reload } = useApi((signal) => fetchSpmOverview({ signal }))

interface Tile {
  id: string
  value: string
  label: string
  icon: string
  accent: DsAccent
}

const stats = computed<Tile[]>(() => {
  const o = data.value
  if (!o) return []
  const tiles: Tile[] = [
    {
      id: 'total',
      value: formatCount(o.stats.totalQuestions),
      label: 'Jumlah Soalan',
      icon: 'i-ph-stack-duotone',
      accent: 'win',
    },
    {
      id: 'subjects',
      value: formatCount(o.stats.subjectCount),
      label: 'Subjek SPM',
      icon: 'i-ph-books-duotone',
      accent: 'action',
    },
    {
      id: 'tracking',
      value: formatCount(o.stats.trackingAQuestions),
      label: 'Soalan Tracking A',
      icon: 'i-ph-target-duotone',
      accent: 'heat',
    },
  ]
  // "Tahun Tersedia" is shown only when the API reports a year count; never a constant 0.
  if (o.stats.yearsAvailable !== undefined) {
    tiles.splice(2, 0, {
      id: 'years',
      value: formatCount(o.stats.yearsAvailable),
      label: 'Tahun Tersedia',
      icon: 'i-ph-calendar-check-duotone',
      accent: 'friend',
    })
  }
  return tiles
})

interface ModuleCard {
  id: string
  to: string
  title: string
  text: string
  /** Shown instead of `text` when the card has no content; the card is then not a link. */
  emptyText: string | null
  chip: string
  accent: DsAccent
  icon: string
  chipIcon: string | undefined
}

const modules = computed<ModuleCard[]>(() => {
  const o = data.value
  if (!o) return []
  return [
    {
      id: 'databank',
      to: '/spm/tahun-lepas',
      title: 'Databank Soalan',
      text: 'Bank soalan SPM mengikut subjek, dipaparkan secara rawak.',
      emptyText: o.modules.databank === 0 ? 'Tiada soalan tersedia lagi.' : null,
      chip: `${formatCount(o.modules.databank)} soalan`,
      accent: 'action',
      icon: 'i-ph-database-duotone',
      chipIcon: 'i-ph-file-text-bold',
    },
    {
      id: 'latih-tubi',
      to: '/spm/latih-tubi',
      title: 'Latih Tubi SPM',
      text: 'Latihan ikut topik dan bab untuk Tingkatan 4 & 5.',
      emptyText: null,
      chip: `${formatCount(o.modules.latihTubi)} soalan`,
      accent: 'win',
      icon: 'i-ph-barbell-duotone',
      chipIcon: 'i-ph-barbell-bold',
    },
    {
      id: 'tracking-a',
      to: '/spm/ramalan',
      title: 'Tracking A',
      text: 'Set objektif penuh dan lane bahasa khas untuk latihan intensif menjelang SPM.',
      emptyText:
        o.modules.trackingA === 0
          ? 'Tiada set objektif Tracking A yang bersedia lagi. Set sedang dibina — semua set semasa masih dalam proses pengisian. Semak semula tidak lama lagi!'
          : null,
      chip: `${formatCount(o.modules.trackingA)} soalan`,
      accent: 'friend',
      icon: 'i-ph-magic-wand-duotone',
      chipIcon: 'i-ph-sparkle-bold',
    },
    {
      id: 'subjektif',
      to: '/spm/subjektif',
      title: 'Subjektif',
      text: 'Latihan soalan berstruktur & esei, semak sendiri dengan skema.',
      emptyText: o.modules.subjektifSets === 0 ? 'Tiada soalan berstruktur ditemui' : null,
      chip: `${formatCount(o.modules.subjektifSets)} set subjektif`,
      accent: 'heat',
      icon: 'i-ph-pen-nib-duotone',
      chipIcon: undefined,
    },
    {
      id: 'kertas-subjektif',
      to: '/kertas-subjektif',
      title: 'Kertas Subjektif',
      text: 'Kertas 2, 3 & 4 percubaan negeri — baca, jawab, buka skema untuk semak sendiri.',
      emptyText:
        o.modules.kertasSubjektif === 0
          ? 'Kertas subjektif sedang dalam penyediaan. Semak semula tidak lama lagi.'
          : null,
      chip: `${formatCount(o.modules.kertasSubjektif)} kertas`,
      accent: 'win',
      icon: 'i-ph-scroll-duotone',
      chipIcon: undefined,
    },
  ]
})

/** A card is a link only when it has content and its target screen is built (never a dead link). */
const isLink = (m: ModuleCard): boolean => m.emptyText === null && routeExists(m.to)

const mine = computed<Tile[]>(() => {
  const m = data.value?.me
  if (!m) return []
  return [
    {
      id: 'sessions',
      value: formatCount(m.sessions),
      label: 'Sesi Kuiz',
      icon: 'i-ph-game-controller-duotone',
      accent: 'action',
    },
    {
      id: 'accuracy',
      value: `${formatNumber(m.avgAccuracy, { decimals: 1 })}%`,
      label: 'Purata Ketepatan',
      icon: 'i-ph-crosshair-duotone',
      accent: 'win',
    },
    {
      id: 'coins',
      value: formatCount(m.coins),
      label: 'Syiling Diperoleh',
      icon: 'i-ph-coins-duotone',
      accent: 'heat',
    },
    {
      id: 'answered',
      value: formatCount(m.answered),
      label: 'Soalan Dijawab',
      icon: 'i-ph-check-circle-duotone',
      accent: 'friend',
    },
  ]
})
</script>

<template>
  <DsPage
    title="Persediaan SPM"
    subtitle="Latihan lengkap untuk pelajar Tingkatan 4 &amp; 5. Soalan tahun lepas, latih tubi, Tracking A, dan latihan bahasa berformat sebenar."
    :show-title="true"
    title-testid="spm-title"
    subtitle-testid="spm-lead"
    data-testid="spm-hub-page"
  >
    <template #meta>
      <UBadge
        color="primary"
        variant="soft"
        icon="i-ph-graduation-cap-duotone"
        size="lg"
        data-testid="spm-pill"
        >MOD SPM</UBadge
      >
    </template>

    <!-- v2 Bijak SPM (Kertas Pilihan + Jana Kertas): full-paper practice in the exam format -->
    <DsHeroCard
      overline="Baharu"
      title="Bijak SPM"
      subtitle="Duduki kertas SPM penuh dalam format kertas sebenar — bermasa, dengan skema."
      art="cap"
      data-testid="spm-bijak-hero"
    >
      <template #cta>
        <UButton
          to="/spm/bijak"
          color="neutral"
          variant="solid"
          size="lg"
          trailing-icon="i-ph-arrow-right-bold"
          class="min-h-12"
          data-testid="spm-bijak-link"
          >Buka</UButton
        >
      </template>
    </DsHeroCard>

    <template v-if="data">
      <!-- Stats -->
      <div
        class="grid grid-cols-2 gap-3 md:gap-4"
        :class="stats.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'"
        data-testid="spm-stats"
      >
        <div
          v-for="(s, i) in stats"
          :key="s.id"
          class="min-w-0"
          :class="stats.length === 3 && i === 2 ? 'col-span-2 md:col-span-1' : ''"
          :data-testid="`spm-stat-${s.id}`"
        >
          <DsStatTile :value="s.value" :unit="s.label" :icon="s.icon" :accent="s.accent" />
        </div>
      </div>

      <!-- Feature cards -->
      <ul
        class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-5"
        data-testid="spm-modules"
      >
        <li v-for="m in modules" :key="m.id" class="min-w-0">
          <component
            :is="isLink(m) ? RouterLink : 'div'"
            v-bind="isLink(m) ? { to: m.to } : {}"
            class="block h-full"
            :data-testid="`spm-module-${m.id}`"
            :data-empty="m.emptyText === null ? undefined : 'true'"
          >
            <UCard class="h-full" :ui="{ body: 'flex h-full flex-col gap-3 p-4' }">
              <DsIconChip :icon="m.icon" :accent="m.accent" size="lg" data-testid="module-icon" />
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <h2 class="text-subheading text-highlighted">{{ m.title }}</h2>
                <p v-if="m.emptyText === null" class="text-body text-muted">{{ m.text }}</p>
                <p v-else class="text-body text-muted" data-testid="module-empty">
                  {{ m.emptyText }}
                </p>
              </div>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <UBadge
                  color="neutral"
                  variant="soft"
                  :icon="m.chipIcon"
                  data-testid="module-chip"
                  >{{ m.chip }}</UBadge
                >
                <span
                  v-if="isLink(m)"
                  class="inline-flex items-center gap-1 text-label text-primary-t"
                >
                  Mula
                  <UIcon name="i-ph-arrow-right-bold" class="size-4" aria-hidden="true" />
                </span>
              </div>
            </UCard>
          </component>
        </li>
      </ul>

      <!-- My SPM performance -->
      <DsPanel title="Prestasi SPM Anda" icon="i-ph-chart-line-up-duotone" data-testid="spm-mine">
        <div class="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <div v-for="s in mine" :key="s.id" class="min-w-0" :data-testid="`spm-mine-${s.id}`">
            <DsStatTile :value="s.value" :unit="s.label" :icon="s.icon" :accent="s.accent" />
          </div>
        </div>
      </DsPanel>

      <div class="flex justify-center">
        <UButton
          to="/spm/history"
          size="lg"
          color="neutral"
          icon="i-ph-clock-counter-clockwise-duotone"
          class="min-h-11"
          data-testid="spm-history-link"
          >Sejarah Kuiz SPM</UButton
        >
      </div>
    </template>

    <DsLoadError v-else-if="error" :message="LOAD_ERROR" testid="spm-error" retry-testid="spm-retry" @retry="reload()" />
    <SkeletonCards v-else :count="4" />
  </DsPage>
</template>
