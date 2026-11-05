<script setup lang="ts">
/**
 * S1 `/pksk` "PKSK" hub (M07-T2; FR-M07-01..05, FN-M07-1.1.*; R1-MUR-19): hero, the no-access banner,
 * the three count tiles, "Format Peperiksaan" (the Bahagian cards open the domain list of the first
 * granted level), "Soalan mengikut Bahagian", "Domain teratas", "Pakej PKSK" and the two level
 * cards. The "AKTIF" badge and highlight follow `GET /api/pksk/me/access`; a pupil with no grant on
 * either level sees the banner and no "Mula Latihan" button. Counts always show (`questionCount`).
 */
import { computed, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsCluster,
  DsGrid,
  DsIconChip,
  DsLoadError,
  DsPage,
  DsStack,
  DsStatTile,
  DsText,
} from '@/ds'

import { fetchPkskAccess, fetchPkskDomains } from '../api/pksk'
import AccentBadge from '../components/AccentBadge.vue'
import PkskBanner from '../components/PkskBanner.vue'
import {
  FORMAT_TILES,
  LEVEL_CARDS,
  LEVEL_ORDER,
  PKSK_PACKAGES,
  TOP_DOMAIN_COUNT,
} from '../lib/levels'
import { LOAD_ERROR, pkskRefusal } from '../lib/load'

const { data: access } = useApi((signal) => fetchPkskAccess({ signal }))
const {
  data: domains,
  error: domainsError,
  reload: reloadDomains,
} = useApi((signal) => fetchPkskDomains({ signal }))

// The API's refusal text of a level page that sent the pupil here (403, e.g. an expired grant).
const refusal = pkskRefusal
onBeforeUnmount(() => {
  pkskRefusal.value = null
})

const noAccess = computed(() => access.value !== null && !access.value.T1 && !access.value.T4)
const firstLevel = computed(() => LEVEL_ORDER.find((l) => access.value?.[l]) ?? null)
const cardLink = computed(() =>
  firstLevel.value ? { to: `/pksk/level/${firstLevel.value}/domains`, class: 'block min-w-0' } : {},
)

const active = computed(() => (domains.value ?? []).filter((d) => d.isActive))
const total = computed(() => active.value.reduce((n, d) => n + d.questionCount, 0))
const byBahagian = computed(() =>
  (['A', 'B', 'C'] as const).map((b) => ({
    bahagian: b,
    count: active.value.filter((d) => d.bahagian === b).reduce((n, d) => n + d.questionCount, 0),
  })),
)
const top = computed(() =>
  [...active.value]
    .sort((a, b) => b.questionCount - a.questionCount || a.order - b.order)
    .slice(0, TOP_DOMAIN_COUNT),
)
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

    <UAlert
      v-if="refusal"
      color="error"
      variant="soft"
      icon="i-ph-warning-circle-duotone"
      :title="refusal"
      data-testid="pksk-refusal"
    />

    <UAlert
      v-if="noAccess"
      color="warning"
      variant="soft"
      icon="i-ph-lock-duotone"
      title="Anda belum mempunyai akses PKSK PRO"
      description="Akses PKSK diberikan oleh pentadbir sekolah anda. Hubungi guru atau pentadbir sekolah untuk mengaktifkan pakej."
      data-testid="no-access-banner"
    />

    <DsLoadError
      v-if="domainsError"
      :message="LOAD_ERROR"
      testid="domains-error"
      @retry="reloadDomains()"
    />

    <DsGrid v-else-if="domains" :cols="{ base: 1, sm: 3 }" data-testid="hub-tiles">
      <DsStatTile
        :value="total"
        unit="Jumlah soalan"
        icon="question"
        accent="action"
        data-testid="tile-total"
      />
      <DsStatTile
        :value="3"
        unit="Bahagian"
        icon="squares-four"
        accent="friend"
        data-testid="tile-bahagian"
      />
      <DsStatTile
        :value="active.length"
        unit="Domain"
        icon="target"
        accent="heat"
        data-testid="tile-domain"
      />
    </DsGrid>

    <section class="flex min-w-0 flex-col gap-3" data-testid="format-card">
      <h2 class="flex items-center gap-2 text-heading text-highlighted">
        <DsIconChip icon="clipboard-text" accent="action" size="sm" /> Format Peperiksaan
      </h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <component
          :is="firstLevel ? RouterLink : 'div'"
          v-for="t in FORMAT_TILES"
          :key="t.bahagian"
          v-bind="cardLink"
          :data-testid="`format-${t.bahagian}`"
        >
          <UCard>
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
        </component>
      </div>
    </section>

    <template v-if="domains">
      <UCard data-testid="block-bahagian">
        <DsStack gap="sm">
          <DsText variant="heading" as="h2">Soalan mengikut Bahagian</DsText>
          <DsStack as="ul" gap="xs">
            <li
              v-for="r in byBahagian"
              :key="r.bahagian"
              :data-testid="`bahagian-row-${r.bahagian}`"
            >
              <DsCluster justify="between" wrap>
                <DsText variant="body" tone="muted">Bahagian {{ r.bahagian }}</DsText>
                <DsText variant="body-strong" tabular>{{ r.count }}</DsText>
              </DsCluster>
            </li>
          </DsStack>
        </DsStack>
      </UCard>

      <UCard data-testid="block-top">
        <DsStack gap="sm">
          <DsText variant="heading" as="h2">Domain teratas</DsText>
          <DsGrid as="ul" :cols="{ base: 1, md: 2 }" gap="xs">
            <li v-for="d in top" :key="d.code" data-testid="top-domain">
              <DsCluster justify="between" wrap>
                <DsText variant="body" tone="muted">{{ d.name }}</DsText>
                <DsText variant="body-strong" tabular>{{ d.questionCount }} soalan</DsText>
              </DsCluster>
            </li>
          </DsGrid>
        </DsStack>
      </UCard>
    </template>

    <UCard data-testid="block-pakej">
      <DsStack gap="sm">
        <DsText variant="heading" as="h2">Pakej PKSK</DsText>
        <DsText variant="body" tone="muted"
          >Pakej ini diaktifkan oleh pentadbir sekolah anda.</DsText
        >
        <DsStack as="ul" gap="xs">
          <li v-for="p in PKSK_PACKAGES" :key="p.name" data-testid="pakej-row">
            <DsCluster justify="between" wrap>
              <DsText variant="body">{{ p.name }}</DsText>
              <DsText variant="body-strong" tabular>{{ p.price }}</DsText>
            </DsCluster>
          </li>
        </DsStack>
      </DsStack>
    </UCard>

    <section class="flex min-w-0 flex-col gap-3" data-testid="level-section">
      <h2 class="flex items-center gap-2 text-heading text-highlighted">
        <DsIconChip icon="stack" accent="action" size="sm" /> Pilih Tingkatan Anda
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
              v-if="!noAccess"
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
