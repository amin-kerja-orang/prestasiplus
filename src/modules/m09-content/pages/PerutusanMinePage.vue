<script setup lang="ts">
/**
 * S25 `/perutusan/saya` "Perutusan Saya" (card S5-T09). All the caller's posts (the API is not
 * paged): title, status chip, long date and a link to the detail page.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsCluster, DsEmptyState, DsLoadError, DsPage, DsPanel, DsStack, DsText } from '@/ds'
import { formatDateLong } from '@/lib/time'

import { fetchMyPerutusan } from '../api'

const EMPTY = 'Anda belum menghantar sebarang perutusan.'
const LOAD_FAILED = 'Perutusan tidak dapat dimuatkan. Sila cuba lagi.'

const { data, error, loading, reload } = useApi((signal) => fetchMyPerutusan({ signal }))
const rows = computed(() => data.value?.data ?? [])
</script>

<template>
  <DsPage layout="list" data-testid="perutusan-mine-page">
    <div>
      <UButton to="/perutusan" color="neutral" variant="link" class="min-h-11"
        >← Perutusan</UButton
      >
    </div>

    <DsLoadError v-if="error" :message="LOAD_FAILED" @retry="reload()" />
    <DsStack v-else-if="loading && !data" gap="md" data-testid="perutusan-loading">
      <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
    </DsStack>
    <DsEmptyState v-else-if="rows.length === 0" :title="EMPTY" data-testid="perutusan-mine-empty" />
    <DsStack v-else as="ul" gap="sm" data-testid="perutusan-mine-list">
      <li v-for="row in rows" :key="row.id" class="min-w-0" data-testid="perutusan-mine-row">
        <DsPanel>
          <DsStack gap="xs">
            <UButton
              :to="`/perutusan/${String(row.id)}`"
              color="neutral"
              variant="link"
              class="h-auto min-h-11 whitespace-normal text-start"
              data-testid="perutusan-mine-link"
              >{{ row.title }}</UButton
            >
            <DsCluster gap="sm">
              <UBadge
                color="neutral"
                variant="soft"
                :label="row.statusLabel"
                data-testid="perutusan-mine-status"
              />
              <DsText variant="caption" tone="muted" data-testid="perutusan-mine-date">{{
                formatDateLong(row.createdAt)
              }}</DsText>
            </DsCluster>
          </DsStack>
        </DsPanel>
      </li>
    </DsStack>
  </DsPage>
</template>
