<script setup lang="ts">
/** S2 `/prestasi/tingkatan` "Pilih Tingkatan" (M08-T5; FR-M08-22): two link cards, only T4 and T5 exist. */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { DsIconChip, DsPage } from '@/ds'

import { fetchLevels } from '../api/performance'
import PageHeader from '../components/shared/PageHeader.vue'
import PageLoadError from '../components/shared/PageLoadError.vue'
import PageSkeleton from '../components/shared/PageSkeleton.vue'
import { usePhIcon } from '../lib/icons'
import { levelNumber, plain } from '../lib/prestasi/format'
import { isLoadError, useRouteData } from '../lib/prestasi/load'

const { data, error, reload } = useRouteData((signal) => fetchLevels({ signal }))
const loadFailed = computed(() => isLoadError(error.value))
const icon = usePhIcon()
</script>

<template>
  <DsPage data-testid="tingkatan-pilih-page">
    <PageHeader
      title="Dashboard Tingkatan"
      subtitle="Pilih tingkatan untuk lihat prestasi keseluruhan"
    />
    <PageLoadError v-if="loadFailed" @retry="reload()" />
    <ul v-else-if="data" class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
      <li v-for="l in data" :key="l.code" class="min-w-0">
        <RouterLink
          :to="`/prestasi/tingkatan/${l.code}`"
          class="block min-w-0"
          :data-testid="`level-link-${l.code}`"
        >
          <UCard>
            <div class="flex items-center gap-4">
              <DsIconChip :icon="icon('graduation-cap')" size="lg" />
              <div class="flex min-w-0 grow flex-col gap-1">
                <span class="text-subheading text-highlighted"
                  >Tingkatan {{ levelNumber(l.code) }}</span
                >
                <span class="text-caption text-muted"
                  >{{ plain(l.classes) }} kelas | {{ plain(l.students) }} murid</span
                >
              </div>
              <UIcon :name="icon('caret-right')" class="size-5 shrink-0 text-dimmed" />
            </div>
          </UCard>
        </RouterLink>
      </li>
    </ul>
    <PageSkeleton v-else-if="!error" />
  </DsPage>
</template>
