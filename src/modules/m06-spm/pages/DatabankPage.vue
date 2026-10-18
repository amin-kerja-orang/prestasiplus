<script setup lang="ts">
/**
 * S2 `/spm/tahun-lepas` "Databank Soalan SPM" (M06-T2; FR-M06-16…19, BR-M06-02/06, DV-M06-03),
 * restyled for v2.
 *
 * 18 subject cards (1 / `md` 2 / `lg` 3 columns), not links. "Pilih set:" 5 / 10 / 20 are links to Q1;
 * the "Mula" is plain text as live (D-5, replicated). Every query parameter is ignored.
 */
import { useApi } from '@/composables'
import { DsBackLink, DsIconChip, DsPage } from '@/ds'
import { formatCount } from '@/lib/number'
import { subjectGlyph } from '@/modules/m05-practice'

import { fetchDatabank } from '../api'
import LoadError from '../components/LoadError.vue'
import SkeletonCards from '../components/SkeletonCards.vue'

const COUNTS = [5, 10, 20] as const

const { data, error, reload } = useApi((signal) => fetchDatabank({ signal }))
</script>

<template>
  <DsPage
    title="Databank Soalan SPM"
    subtitle="Pilih subjek dan mula jawab dari bank soalan"
    :show-title="true"
    title-testid="spm-heading"
    subtitle-testid="spm-sub"
    data-testid="spm-databank-page"
  >
    <template #breadcrumb>
      <DsBackLink to="/spm" label="Kembali ke Mod SPM" data-testid="spm-back" />
    </template>

    <ul
      v-if="data"
      class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3"
      data-testid="databank-grid"
    >
      <li v-for="s in data" :key="s.code" class="min-w-0" :data-testid="`databank-card-${s.code}`">
        <UCard class="h-full" :ui="{ body: 'flex h-full flex-col gap-3 p-4' }">
          <div class="flex items-center gap-3">
            <DsIconChip :icon="subjectGlyph(s.icon)" size="lg" data-testid="databank-icon" />
            <div class="min-w-0">
              <h2 class="text-subheading break-words text-highlighted" data-testid="databank-name">
                {{ s.name }}
              </h2>
              <p class="text-caption text-muted" data-testid="databank-name-en">{{ s.nameEn }}</p>
            </div>
          </div>
          <p class="text-body text-default" data-testid="databank-count">
            <span class="tabular text-highlighted">{{ formatCount(s.databankCount) }}</span>
            soalan dalam databank
          </p>
          <div class="mt-auto flex flex-wrap items-center gap-2 pt-1">
            <span class="text-label text-muted">Pilih set:</span>
            <UButton
              v-for="n in COUNTS"
              :key="n"
              :to="`/spm/tahun-lepas/${encodeURIComponent(s.code)}/quiz?count=${String(n)}`"
              color="neutral"
              variant="soft"
              class="tabular min-h-11 min-w-11 justify-center"
              :data-testid="`databank-set-${s.code}-${String(n)}`"
              >{{ n }}</UButton
            >
            <span class="ms-auto text-label text-primary" data-testid="databank-mula">Mula</span>
          </div>
        </UCard>
      </li>
    </ul>
    <LoadError v-else-if="error" @retry="reload()" />
    <SkeletonCards v-else />
  </DsPage>
</template>
