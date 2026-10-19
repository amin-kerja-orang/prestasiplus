<script setup lang="ts">
/**
 * S5 `/spm/ramalan` "Tracking A SPM" (M06-T3; FR-M06-35…41, BR-M06-09…11, BR-M06-30), restyled for v2.
 *
 * Two lane cards, the "Admin Readiness" card (rendered only when the server sends it: admin only), the
 * "Tracking A Bahasa" section (BM and BI → S7) and one card per open objective subject → S6. The cards
 * and chips replicate the live copy; icons are Phosphor stand-ins for the Font Awesome names.
 */
import { RouterLink } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsBackLink,
  DsCharacterCard,
  DsIconChip,
  DsPage,
  DsPanel,
  DsLoadError,
  DsCluster,
  DsStack,
  DsGrid,
  DsText,
  DsHeading,
} from '@/ds'
import { formatCount } from '@/lib/number'

import { fetchTrackingAHub } from '../api'
import SkeletonCards from '../components/SkeletonCards.vue'
import { bahasaHref, lockChip, targetChip, tileTarget } from '../lib/tracking'
import { LOAD_ERROR } from '../lib/copy'

const { data, error, reload } = useApi((signal) => fetchTrackingAHub({ signal }))
</script>

<template>
  <DsPage
    title="Tracking A SPM"
    subtitle="Soalan Tracking A SPM — bersedia untuk apa yang mungkin keluar!"
    :show-title="true"
    title-testid="spm-heading"
    subtitle-testid="spm-sub"
    data-testid="tracking-hub-page"
  >
    <template #breadcrumb>
      <DsBackLink to="/spm" label="Kembali ke Mod SPM" data-testid="spm-back" />
    </template>
    <template #meta>
      <UBadge
        color="secondary"
        variant="soft"
        icon="i-ph-magic-wand-duotone"
        size="lg"
        data-testid="tracking-pill"
        >TRACKING A</UBadge
      >
    </template>

    <template v-if="data">
      <!-- Lanes -->
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4" data-testid="lanes">
        <DsCharacterCard
          accent="action"
          art="rocket"
          title="Subjek objektif penuh"
          description="Khusus untuk kertas objektif penuh yang boleh terus berjalan ikut set."
          data-testid="lane-objektif"
        >
          <DsText variant="overline" as="p" tone="primary">Tracking A Objektif</DsText>
          <DsCluster gap="xs" align="stretch">
            <UBadge color="neutral" variant="soft" data-testid="lane-badge"
              >{{ data.objectiveLane.subjects }} subjek</UBadge
            >
            <UBadge color="neutral" variant="soft" icon="i-ph-stack-bold" data-testid="lane-sets"
              >{{ formatCount(data.objectiveLane.sets) }} set</UBadge
            >
            <UBadge
              color="neutral"
              variant="soft"
              icon="i-ph-file-text-bold"
              data-testid="lane-questions"
              >{{ formatCount(data.objectiveLane.questions) }} soalan</UBadge
            >
          </DsCluster>
        </DsCharacterCard>
        <DsCharacterCard
          accent="friend"
          art="books"
          title="BM dan BI format sebenar"
          description="Lane khas untuk kertas bahasa tanpa memaksa format menjadi 40 MCQ."
          data-testid="lane-bahasa"
        >
          <DsText variant="overline" as="p" tone="primary">Tracking A Bahasa</DsText>
          <DsCluster gap="xs" align="stretch">
            <UBadge color="neutral" variant="soft" data-testid="lane-badge"
              >{{ data.bahasaLane.subjects }} subjek</UBadge
            >
            <UBadge color="neutral" variant="soft" icon="i-ph-stack-bold" data-testid="lane-sets"
              >{{ formatCount(data.bahasaLane.sets) }} set</UBadge
            >
            <UBadge
              color="neutral"
              variant="soft"
              icon="i-ph-translate-bold"
              data-testid="lane-paper"
              >Paper-based tracking</UBadge
            >
          </DsCluster>
        </DsCharacterCard>
      </div>

      <!-- Admin readiness (admin only, BR-M06-30) -->
      <DsPanel
        v-if="data.readiness"
        title="Status set Tracking A SPM semasa"
        description="Laporan ini bezakan set bersih, set bank besar, dan set yang masih lock supaya bacaan readiness lebih jujur."
        icon="i-ph-gauge-duotone"
        accent="trial"
        data-testid="readiness"
      >
        <DsStack>
          <DsText variant="overline" as="p" tone="warning">Admin Readiness</DsText>
          <DsCluster gap="xs" align="stretch" data-testid="readiness-summary">
            <UBadge color="success" variant="soft"
              >Set Bersih: {{ data.readiness.summary.bersih }} set</UBadge
            >
            <UBadge color="info" variant="soft"
              >Bank Besar: {{ data.readiness.summary.bankBesar }} set</UBadge
            >
            <UBadge color="warning" variant="soft"
              >Locked: {{ data.readiness.summary.locked }} set</UBadge
            >
          </DsCluster>
          <DsGrid :cols="{ base: 1, lg: 2 }" gap="sm" data-testid="readiness-tiles">
            <UCard
              v-for="t in data.readiness.tiles"
              :key="t.code"
              variant="subtle"
              class="min-w-0"
              :ui="{ body: 'flex flex-col gap-3 p-3' }"
              :data-testid="`tile-${t.code}`"
            >
              <DsCluster gap="xs" align="start" justify="between" :wrap="false">
                <div class="min-w-0">
                  <DsHeading :level="3" wrap="anywhere" data-testid="tile-name">
                    {{ t.name }}
                  </DsHeading>
                  <DsText variant="caption" wrap="anywhere" data-testid="tile-target">
                    {{ tileTarget(t.code, t.targetSize) }}
                  </DsText>
                </div>
                <UBadge color="neutral" variant="subtle" class="shrink-0" data-testid="tile-badge"
                  >{{ t.bersih }}/{{ t.total }} set bersih</UBadge
                >
              </DsCluster>
              <dl class="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div class="min-w-0">
                  <DsText variant="caption" as="dt">Set Bersih</DsText>
                  <DsText
                    variant="heading"
                    as="dd"
                    tone="success"
                    tabular
                    data-testid="tile-bersih"
                  >
                    {{ t.bersih }}
                  </DsText>
                </div>
                <div class="min-w-0">
                  <DsText variant="caption" as="dt">Bank Besar</DsText>
                  <DsText variant="heading" as="dd" tone="info" tabular data-testid="tile-bank">
                    {{ t.bankBesar }}
                  </DsText>
                </div>
                <div class="min-w-0">
                  <DsText variant="caption" as="dt">Locked</DsText>
                  <DsText
                    variant="heading"
                    as="dd"
                    tone="warning"
                    tabular
                    data-testid="tile-locked"
                  >
                    {{ t.locked }}
                  </DsText>
                </div>
                <div class="min-w-0">
                  <DsText variant="caption" as="dt">Readiness</DsText>
                  <DsText
                    variant="heading"
                    as="dd"
                    tone="primary"
                    tabular
                    data-testid="tile-readiness"
                  >
                    {{ t.readiness }}%
                  </DsText>
                </div>
              </dl>
              <DsText v-if="t.hasBankBesar" variant="caption" data-testid="tile-bank-note">
                Set bank besar boleh dibuka, tetapi bank sumber melebihi target set. Rujuk page
                subjek untuk beza set bersih vs bank besar.
              </DsText>
              <DsStack v-if="t.locked > 0" gap="2xs" data-testid="tile-locks">
                <DsText variant="overline" as="p">Set Masih Lock</DsText>
                <DsCluster gap="xs" align="stretch">
                  <UBadge
                    v-for="s in t.lockedSets"
                    :key="s.setNo"
                    color="warning"
                    variant="soft"
                    data-testid="tile-lock-chip"
                    >{{ lockChip(s) }}</UBadge
                  >
                </DsCluster>
              </DsStack>
            </UCard>
          </DsGrid>
        </DsStack>
      </DsPanel>

      <!-- Bahasa section -->
      <DsStack as="section" gap="sm" data-testid="bahasa-section">
        <DsStack gap="2xs">
          <DsText variant="overline" as="p" tone="primary">Tracking A Bahasa</DsText>
          <DsCluster gap="xs">
            <DsHeading :level="2">BM dan BI ikut format kertas sebenar</DsHeading>
            <UBadge color="secondary" variant="soft" data-testid="bahasa-paper-pill"
              >Paper-based tracking</UBadge
            >
          </DsCluster>
          <DsText variant="body" tone="muted">
            Subjek bahasa tidak dipaksa menjadi 40 MCQ. Ia dibuka melalui set berstruktur dan
            komponen sebenar peperiksaan.
          </DsText>
        </DsStack>
        <ul class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <li v-for="b in data.bahasa" :key="b.code" class="min-w-0">
            <RouterLink
              :to="bahasaHref(b.subjectId)"
              class="block h-full"
              :data-testid="`bahasa-card-${b.code}`"
            >
              <UCard class="h-full" :ui="{ body: 'flex h-full flex-col gap-3 p-4' }">
                <DsCluster :wrap="false">
                  <DsIconChip icon="translate" accent="friend" size="lg" />
                  <div class="min-w-0">
                    <DsHeading :level="3" wrap="anywhere" data-testid="bahasa-name">
                      {{ b.name }}
                    </DsHeading>
                    <DsText variant="caption" data-testid="bahasa-name-en">
                      {{ b.nameEn }}
                    </DsText>
                  </div>
                </DsCluster>
                <DsCluster gap="xs" align="stretch">
                  <UBadge color="secondary" variant="soft" data-testid="bahasa-sets"
                    >{{ formatCount(b.sets) }} set</UBadge
                  >
                  <UBadge color="neutral" variant="soft">Berstruktur / respons sebenar</UBadge>
                </DsCluster>
                <span
                  class="mt-auto inline-flex items-center gap-1 text-label text-primary-t"
                  data-testid="bahasa-cta"
                >
                  Buka Tracking A Bahasa
                  <UIcon name="i-ph-arrow-right-bold" class="size-4" aria-hidden="true" />
                </span>
              </UCard>
            </RouterLink>
          </li>
        </ul>
      </DsStack>

      <!-- Open objective subjects -->
      <section data-testid="open-section">
        <ul
          data-testid="open-subjects"
          class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3"
        >
          <li v-for="c in data.openSubjects" :key="c.code" class="min-w-0">
            <RouterLink
              :to="`/spm/ramalan/${c.code}`"
              class="block h-full"
              :data-testid="`open-card-${c.code}`"
            >
              <UCard
                class="h-full"
                :ui="{ body: 'flex h-full flex-col justify-between gap-3 p-4' }"
              >
                <DsStack gap="sm">
                  <DsCluster :wrap="false">
                    <DsIconChip icon="target" accent="action" size="lg" />
                    <div class="min-w-0">
                      <DsHeading :level="3" wrap="anywhere" data-testid="open-name">
                        {{ c.name }}
                      </DsHeading>
                      <DsText variant="caption" data-testid="open-name-en">
                        {{ c.nameEn }}
                      </DsText>
                    </div>
                  </DsCluster>
                  <DsCluster gap="xs" align="stretch" data-testid="open-chips">
                    <UBadge
                      color="secondary"
                      variant="soft"
                      icon="i-ph-file-text-bold"
                      data-testid="chip-ready"
                      >{{ formatCount(c.readyQuestions) }} soalan kuiz siap guna</UBadge
                    >
                    <UBadge
                      v-if="c.bankBesarSets > 0"
                      color="info"
                      variant="soft"
                      icon="i-ph-stack-bold"
                      data-testid="chip-bank"
                      >{{ c.bankBesarSets }} bank besar</UBadge
                    >
                    <UBadge
                      v-if="c.targetType !== null && c.bersihSets > 0"
                      color="success"
                      variant="soft"
                      icon="i-ph-check-circle-bold"
                      data-testid="chip-bersih"
                      >{{ c.bersihSets }} set bersih</UBadge
                    >
                    <UBadge
                      v-if="c.targetType !== null && c.targetSize !== null"
                      color="warning"
                      variant="soft"
                      icon="i-ph-target-bold"
                      data-testid="chip-target"
                      >{{ targetChip(c.targetType, c.targetSize) }}</UBadge
                    >
                    <UBadge
                      v-if="c.bankSource !== null"
                      color="neutral"
                      variant="soft"
                      icon="i-ph-database-bold"
                      data-testid="chip-source"
                      >Bank source: {{ formatCount(c.bankSource) }}</UBadge
                    >
                    <UBadge color="neutral" variant="soft" data-testid="chip-sets"
                      >{{ c.startableSets }} set</UBadge
                    >
                  </DsCluster>
                </DsStack>
                <span
                  class="flex items-center justify-between pt-1 text-label text-primary-t"
                  data-testid="open-footer"
                >
                  Pilih Set
                  <UIcon name="i-ph-caret-right-bold" class="size-4" aria-hidden="true" />
                </span>
              </UCard>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
    <DsLoadError
      v-else-if="error"
      :message="LOAD_ERROR"
      testid="spm-error"
      retry-testid="spm-retry"
      @retry="reload()"
    />
    <SkeletonCards v-else />
  </DsPage>
</template>
