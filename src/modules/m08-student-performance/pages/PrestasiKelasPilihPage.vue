<script setup lang="ts">
/**
 * S4 `/prestasi/kelas` "Pilih Kelas" (M08-T5; FR-M08-29, FR-M08-30). The viewer's own active classes;
 * none (the admin, a pelajar) shows the observed empty state. The populated picker reuses the S10 card
 * pattern (PROPOSED, UNVERIFIED L-6); the card action "Lihat Prestasi" is INFERRED.
 */
import { computed } from 'vue'

import { DsEmptyState, DsLoadError, DsPage, DsPageHeader } from '@/ds'

import { fetchOwnClasses } from '../api/performance'
import ClassPickCard from '../components/prestasi/ClassPickCard.vue'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'

const { data, error, reload } = useRouteData((signal) => fetchOwnClasses({ signal }))
const loadFailed = computed(() => isLoadError(error.value))
const active = computed(() => (data.value ?? []).filter((c) => c.isActive))
</script>

<template>
  <DsPage data-testid="prestasi-kelas-pilih-page">
    <DsPageHeader title="Papan Pemuka Kelas" subtitle="Pilih kelas untuk lihat prestasi keseluruhan" />
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <div v-if="active.length === 0" data-testid="kelas-empty">
        <DsEmptyState
          title="Anda belum mempunyai kelas aktif."
          description="Cipta kelas terlebih dahulu untuk mula memantau prestasi murid."
          icon="i-ph-chalkboard"
        >
          <template #actions>
            <UButton
              to="/guru/kelas/cipta"
              size="lg"
              label="Cipta Kelas"
              data-testid="kelas-create"
            />
          </template>
        </DsEmptyState>
      </div>

      <div
        v-else
        class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3"
        data-testid="kelas-list"
      >
        <ClassPickCard
          v-for="c in active"
          :key="c.id"
          :item="c"
          :to="`/prestasi/kelas/${c.id}`"
          action="Lihat Prestasi"
        />
      </div>
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
