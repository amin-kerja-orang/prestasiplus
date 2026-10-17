<script setup lang="ts">
/**
 * S1 `/pksk` "PKSK" hub (M07-T2; FR-M07-01..05, FN-M07-1.1.*): hero, the "Format Peperiksaan" card
 * and the two level cards. The "AKTIF" badge and highlight follow `GET /api/pksk/me/access`; a
 * level without access has no badge and no highlight (INFERRED only, L-1).
 */
import { DsIconChip, DsPage } from '@/ds'

import { fetchPkskAccess } from '../api/pksk'
import AccentBadge from '../components/AccentBadge.vue'
import PkskBanner from '../components/PkskBanner.vue'
import { FORMAT_TILES, LEVEL_CARDS } from '../lib/levels'
import { useApi } from '@/composables'

const { data: access } = useApi((signal) => fetchPkskAccess({ signal }))
</script>

<template>
  <DsPage data-testid="pksk-hub">
    <PkskBanner data-testid="pksk-banner">
      <UIcon name="i-ph-exam-duotone" class="size-12" aria-hidden="true" />
      <h1 class="text-title" data-testid="hub-title">Persediaan Kemasukan</h1>
      <p class="text-heading">SBP / MRSM / SMKA</p>
      <p class="max-w-prose text-body">
        Latih tubi soalan dan peperiksaan penuh untuk persediaan kemasukan sekolah berasrama penuh
      </p>
    </PkskBanner>

    <section class="flex min-w-0 flex-col gap-3" data-testid="format-card">
      <h2 class="flex items-center gap-2 text-heading text-highlighted">
        <DsIconChip icon="i-ph-clipboard-text-duotone" accent="action" size="sm" /> Format
        Peperiksaan
      </h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <UCard v-for="t in FORMAT_TILES" :key="t.bahagian" :data-testid="`format-${t.bahagian}`">
          <div class="flex min-w-0 items-start gap-3">
            <AccentBadge :accent="t.accent" data-testid="format-circle">{{
              t.bahagian
            }}</AccentBadge>
            <div class="flex min-w-0 flex-col gap-1">
              <h3 class="text-subheading text-highlighted">{{ t.name }}</h3>
              <p class="text-label text-toned">
                <strong class="text-highlighted">{{ t.count }}</strong> {{ t.unit }}
              </p>
              <p class="text-label text-muted">Pemberat: {{ t.weight }}%</p>
              <span class="mt-1 inline-flex items-center gap-2 text-caption text-muted">
                <DsIconChip :icon="t.icon" :accent="t.accent" size="xs" /> {{ t.chip }}
              </span>
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <section class="flex min-w-0 flex-col gap-3" data-testid="level-section">
      <h2 class="flex items-center gap-2 text-heading text-highlighted">
        <DsIconChip icon="i-ph-stack-duotone" accent="action" size="sm" /> Pilih Tingkatan Anda
      </h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <UCard
          v-for="c in LEVEL_CARDS"
          :key="c.level"
          :data-testid="`level-card-${c.level}`"
          :data-active="access?.[c.level] ? 'true' : 'false'"
        >
          <div class="relative flex min-w-0 flex-col gap-3">
            <UBadge
              v-if="access?.[c.level]"
              color="success"
              variant="solid"
              icon="i-ph-lock-open-duotone"
              class="absolute top-0 right-0"
              data-testid="badge-aktif"
              >AKTIF</UBadge
            >
            <AccentBadge :accent="c.accent" size="lg">{{ c.level }}</AccentBadge>
            <h3 class="text-heading text-highlighted">{{ c.name }}</h3>
            <p class="text-body text-muted">{{ c.text }}</p>
            <UButton
              :to="`/pksk/level/${c.level}`"
              size="xl"
              block
              icon="i-ph-play-duotone"
              class="min-h-12"
              :data-testid="`start-${c.level}`"
              >Mula Latihan</UButton
            >
          </div>
        </UCard>
      </div>
    </section>
  </DsPage>
</template>
