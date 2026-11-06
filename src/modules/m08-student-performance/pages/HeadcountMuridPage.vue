<script setup lang="ts">
/**
 * `/headcount` for the pupil (S10-T09; R1-MUR-3, FR-MUR-3-5…7, 9, 10; API-RPT-08 `GET /headcounts/me`).
 * One card per config of the pupil's own classes: subject, "{Kelas} · {Tingkatan}", year, "{n} murid", the
 * chip Auto / Manual and the pill Active / Draft (Draft = no ETR, with the line "Belum Ada Data").
 * "Lihat Data Saya" opens the own detail of that config. Read only: no create, Auto-Setup or delete control.
 */
import { computed } from 'vue'

import {
  DsCluster,
  DsEmptyState,
  DsGrid,
  DsGridItem,
  DsHeading,
  DsLoadError,
  DsPage,
  DsPageHeader,
  DsPanel,
  DsStack,
  DsText,
} from '@/ds'
import { useSessionStore } from '@/stores/session'

import { fetchHeadcountMe } from '../api/headcount'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'

const session = useSessionStore()
const { data, error, reload } = useRouteData((signal) => fetchHeadcountMe({ signal }))

const ownId = computed(() => String(session.user?.id ?? ''))
const openTo = (configId: number | string): string =>
  `/headcount/student/${ownId.value}?configId=${String(configId)}`
</script>

<template>
  <DsPage data-testid="headcount-murid-page">
    <DsPageHeader
      title="Headcount"
      subtitle="Tracking prestasi murid — TOV, OTR, AR & RS"
      data-testid="headcount-hero"
    />

    <DsLoadError v-if="isLoadError(error)" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <div v-if="data.length === 0" data-testid="headcount-empty">
        <DsEmptyState
          title="Belum ada Headcount"
          description="Guru anda belum menyediakan headcount bagi kelas anda tahun ini."
          icon="clipboard-text"
        />
      </div>

      <DsGrid v-else as="ul" :cols="{ base: 1, md: 2, xl: 3 }" data-testid="headcount-cards">
        <DsGridItem v-for="c in data" :key="c.id" as="li">
          <DsPanel :data-testid="`headcount-card-${String(c.id)}`">
            <DsStack gap="sm">
              <DsCluster justify="between" align="start">
                <DsHeading :level="2" variant="heading" wrap="anywhere">{{ c.subjectName }}</DsHeading>
                <UBadge
                  :color="c.entryStatus === 'active' ? 'success' : 'neutral'"
                  variant="subtle"
                  :label="c.entryStatus === 'active' ? 'Active' : 'Draft'"
                  :data-testid="`headcount-pill-${String(c.id)}`"
                />
              </DsCluster>
              <DsText variant="body" tone="default">{{ c.className }} · {{ c.levelName }}</DsText>
              <DsCluster>
                <UBadge
                  :color="c.mode === 'auto' ? 'primary' : 'neutral'"
                  variant="subtle"
                  :label="c.mode === 'auto' ? 'Auto' : 'Manual'"
                  :data-testid="`headcount-mode-${String(c.id)}`"
                />
                <DsText as="span" variant="caption" tone="muted"
                  >{{ c.students }} murid · {{ c.year }}</DsText
                >
              </DsCluster>
              <DsText
                v-if="c.entryStatus === 'draft'"
                variant="body"
                tone="muted"
                :data-testid="`headcount-draft-${String(c.id)}`"
                >Belum Ada Data</DsText
              >
              <DsCluster>
                <UButton
                  :to="openTo(c.id)"
                  size="lg"
                  icon="i-ph-arrow-right"
                  trailing
                  label="Lihat Data Saya"
                  :data-testid="`headcount-open-${String(c.id)}`"
                />
              </DsCluster>
            </DsStack>
          </DsPanel>
        </DsGridItem>
      </DsGrid>
    </template>
    <DsStack v-else-if="!error" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </DsStack>
  </DsPage>
</template>
