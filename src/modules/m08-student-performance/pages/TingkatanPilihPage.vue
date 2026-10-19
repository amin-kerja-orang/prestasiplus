<script setup lang="ts">
/** S2 `/prestasi/tingkatan` "Pilih Tingkatan" (M08-T5; FR-M08-22): two link cards, only T4 and T5 exist. */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import {
  DsIconChip,
  DsLoadError,
  DsPage,
  DsPageHeader,
  DsPanel,
  DsCluster,
  DsStack,
  DsText,
} from '@/ds'

import { fetchLevels } from '../api/performance'
import { usePhIcon } from '../lib/icons'
import { levelNumber, plain } from '../lib/prestasi/format'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'

const { data, error, reload } = useRouteData((signal) => fetchLevels({ signal }))
const loadFailed = computed(() => isLoadError(error.value))
const icon = usePhIcon()
</script>

<template>
  <DsPage data-testid="tingkatan-pilih-page">
    <DsPageHeader
      title="Dashboard Tingkatan"
      subtitle="Pilih tingkatan untuk lihat prestasi keseluruhan"
    />
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />
    <ul v-else-if="data" class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
      <li v-for="l in data" :key="l.code" class="min-w-0">
        <RouterLink
          :to="`/prestasi/tingkatan/${l.code}`"
          class="block min-w-0"
          :data-testid="`level-link-${l.code}`"
        >
          <DsPanel>
            <DsCluster gap="md" :wrap="false">
              <DsIconChip :icon="icon('graduation-cap')" size="lg" />
              <DsStack gap="2xs" class="grow">
                <DsText variant="subheading" as="span">Tingkatan {{ levelNumber(l.code) }}</DsText>
                <DsText variant="caption" as="span"
                  >{{ plain(l.classes) }} kelas | {{ plain(l.students) }} murid</DsText
                >
              </DsStack>
              <UIcon :name="icon('caret-right')" class="size-5 shrink-0 text-dimmed" />
            </DsCluster>
          </DsPanel>
        </RouterLink>
      </li>
    </ul>
    <div
      v-else-if="!error"
      class="flex flex-col gap-4 md:gap-6"
      aria-busy="true"
      data-testid="page-loading"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
