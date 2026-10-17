<script setup lang="ts">
/**
 * S2 `/pksk/level/:level` "Dashboard PKSK - {L}" (M07-T2; FR-M07-06..10, FN-M07-1.2.*): readiness
 * hero, the three shortcut cards and "Penguasaan Domain" (Bahagian B domains only). The level gate
 * (403 -> `/pksk`) is in `usePkskData`.
 */
import { computed, watch } from 'vue'

import { usePageMeta } from '@/composables'
import { DsIconChip, DsPage, DsStatTile } from '@/ds'

import { fetchPkskDashboard } from '../api/pksk'
import type { PkskLevel } from '../api/types'
import BackLink from '../components/BackLink.vue'
import LoadError from '../components/LoadError.vue'
import PkskBanner from '../components/PkskBanner.vue'
import MasteryBar from '../components/MasteryBar.vue'
import { isLoadError, usePkskData } from '../lib/load'

const props = defineProps<{ level: PkskLevel }>()

const pageMeta = usePageMeta()
watch(
  () => props.level,
  (level) => {
    pageMeta.setHeader({
      title: `Dashboard PKSK - ${level}`,
      subtitle: 'Pantau kemajuan latihan anda',
    })
  },
  { immediate: true },
)

const { data, error, reload } = usePkskData(
  (signal) => fetchPkskDashboard(props.level, { signal }),
  [() => props.level],
)
const loadFailed = computed(() => isLoadError(error.value))

const shortcuts = computed(
  () =>
    [
      {
        key: 'domains',
        icon: 'i-ph-target-duotone',
        accent: 'action',
        title: 'Latih Tubi Domains',
        text: 'Fokus pada topik tertentu',
        to: `/pksk/level/${props.level}/domains`,
      },
      {
        key: 'exam',
        icon: 'i-ph-exam-duotone',
        accent: 'friend',
        title: 'Peperiksaan Penuh',
        text: 'Simulasi peperiksaan sebenar',
        to: `/pksk/level/${props.level}/exam`,
      },
      {
        key: 'history',
        icon: 'i-ph-clock-counter-clockwise-duotone',
        accent: 'heat',
        title: 'Sejarah',
        text: 'Lihat prestasi lepas',
        to: `/pksk/level/${props.level}/history`,
      },
    ] as const,
)
</script>

<template>
  <DsPage data-testid="pksk-dashboard">
    <BackLink to="/pksk" label="Kembali ke PKSK" />

    <LoadError v-if="loadFailed" @retry="reload()" />

    <template v-else-if="data">
      <PkskBanner data-testid="readiness">
        <div class="flex min-w-0 flex-col items-center gap-2 text-center">
          <p class="text-label">Skor Kesediaan Anda</p>
          <p class="text-display" data-testid="score">{{ data.readiness.scorePct }}%</p>
          <UBadge color="neutral" variant="solid" size="xl" data-testid="grade">{{
            data.readiness.grade
          }}</UBadge>
          <p class="text-label">Teruskan usaha anda!</p>
        </div>
        <div class="grid w-full min-w-0 grid-cols-2 gap-3 text-highlighted">
          <DsStatTile
            :value="data.examCount"
            unit="Jumlah Peperiksaan"
            icon="i-ph-exam-duotone"
            accent="action"
            data-testid="exam-count"
          />
          <DsStatTile
            :value="`${data.bahagianBAvgPct.toFixed(1)}%`"
            unit="Purata Bahagian B"
            icon="i-ph-chart-line-up-duotone"
            accent="win"
            data-testid="avg-b"
          />
        </div>
      </PkskBanner>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ULink
          v-for="s in shortcuts"
          :key="s.key"
          :to="s.to"
          raw
          class="block min-h-11 min-w-0"
          :data-testid="`shortcut-${s.key}`"
        >
          <UCard>
            <div class="flex min-w-0 items-center gap-3">
              <DsIconChip :icon="s.icon" :accent="s.accent" size="lg" />
              <span class="flex min-w-0 flex-col">
                <span class="text-subheading text-highlighted">{{ s.title }}</span>
                <span class="text-label text-muted">{{ s.text }}</span>
              </span>
            </div>
          </UCard>
        </ULink>
      </div>

      <section class="flex min-w-0 flex-col gap-3" data-testid="mastery-section">
        <h2 class="flex items-center gap-2 text-heading text-highlighted">
          <DsIconChip icon="i-ph-chart-line-up-duotone" accent="action" size="sm" /> Penguasaan
          Domain
        </h2>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <UCard
            v-for="d in data.domains"
            :key="d.code"
            data-testid="domain-card"
            :data-code="d.code"
          >
            <div class="flex min-w-0 flex-col gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <DsIconChip
                  icon="i-ph-target-duotone"
                  accent="friend"
                  size="lg"
                  data-testid="domain-icon"
                />
                <div class="min-w-0">
                  <h3 class="text-subheading break-words text-highlighted">{{ d.name }}</h3>
                  <p class="text-caption text-muted">{{ d.code }}</p>
                </div>
              </div>
              <div class="flex items-center justify-between text-label">
                <span class="text-muted">Penguasaan</span>
                <span class="tabular text-highlighted" data-testid="mastery-pct"
                  >{{ d.masteryPct }}%</span
                >
              </div>
              <MasteryBar :pct="d.masteryPct" accent="friend" />
              <UButton
                :to="`/pksk/level/${level}/domain/${d.code}`"
                color="primary"
                variant="soft"
                size="lg"
                block
                icon="i-ph-play-duotone"
                class="min-h-11"
                data-testid="practice-link"
                >Latih Sekarang</UButton
              >
            </div>
          </UCard>
        </div>
      </section>
    </template>
  </DsPage>
</template>
