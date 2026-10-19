<script setup lang="ts">
/**
 * S1 `/pksk` "PKSK" hub (M07-T2; FR-M07-01..05, FN-M07-1.1.*): hero, the "Format Peperiksaan" card
 * and the two level cards. The "AKTIF" badge and highlight follow `GET /api/pksk/me/access`; a
 * level without access has no badge and no highlight (INFERRED only, L-1).
 */
import { DsIconChip, DsPage, DsStack, DsGrid, DsCluster, DsHeading, DsText } from '@/ds'

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

    <DsStack as="section" gap="sm" data-testid="format-card">
      <h2 class="flex items-center gap-2 text-heading text-highlighted">
        <DsIconChip icon="clipboard-text" accent="action" size="sm" /> Format Peperiksaan
      </h2>
      <DsGrid :cols="{ base: 1, md: 3 }" gap="sm">
        <UCard v-for="t in FORMAT_TILES" :key="t.bahagian" :data-testid="`format-${t.bahagian}`">
          <DsCluster align="start" :wrap="false">
            <AccentBadge :accent="t.accent" data-testid="format-circle">{{
              t.bahagian
            }}</AccentBadge>
            <DsStack gap="2xs">
              <DsHeading :level="3">{{ t.name }}</DsHeading>
              <DsText variant="label" as="p" tone="toned">
                <strong class="text-highlighted">{{ t.count }}</strong> {{ t.unit }}
              </DsText>
              <DsText variant="label" as="p" tone="muted">Pemberat: {{ t.weight }}%</DsText>
              <span class="mt-1 inline-flex items-center gap-2 text-caption text-muted">
                <DsIconChip :icon="t.icon" :accent="t.accent" size="xs" /> {{ t.chip }}
              </span>
            </DsStack>
          </DsCluster>
        </UCard>
      </DsGrid>
    </DsStack>

    <DsStack as="section" gap="sm" data-testid="level-section">
      <h2 class="flex items-center gap-2 text-heading text-highlighted">
        <DsIconChip icon="stack" accent="action" size="sm" /> Pilih Tingkatan Anda
      </h2>
      <DsGrid :cols="{ base: 1, md: 2 }" gap="sm">
        <UCard
          v-for="c in LEVEL_CARDS"
          :key="c.level"
          :data-testid="`level-card-${c.level}`"
          :data-active="access?.[c.level] ? 'true' : 'false'"
        >
          <DsStack gap="sm" class="relative">
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
            <DsHeading :level="3" variant="heading">{{ c.name }}</DsHeading>
            <DsText variant="body" tone="muted">{{ c.text }}</DsText>
            <UButton
              :to="`/pksk/level/${c.level}`"
              size="xl"
              block
              icon="i-ph-play-duotone"
              class="min-h-12"
              :data-testid="`start-${c.level}`"
              >Mula Latihan</UButton
            >
          </DsStack>
        </UCard>
      </DsGrid>
    </DsStack>
  </DsPage>
</template>
