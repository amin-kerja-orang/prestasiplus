<script setup lang="ts">
/**
 * S11 `/cikgu/hadiah/saya` (FR-M15-73..75; URS FT-M15-10.2): title row (h1 left, "🎁 Kedai Hadiah"
 * right on one row at every width) and the empty card. The list is empty for every account
 * (BR-M15-28): #20 never returns rows and the M15 redemption store is not read.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsPage, DsLoadError, DsStack, DsHeading, DsText } from '@/ds'

import { fetchDigitalRedemptions } from '../api'
import { MY_REDEMPTIONS_COPY } from '../components/copy'
import LoadSkeleton from '../components/LoadSkeleton.vue'
import { COMMON_COPY } from '../components/copy'

const list = useApi((signal) => fetchDigitalRedemptions({ signal }))
const ready = computed(() => list.data.value !== null)
</script>

<template>
  <DsPage class="max-w-3xl" data-testid="m15-redemptions-page">
    <section class="flex items-center justify-between gap-3">
      <DsHeading :level="1" class="min-w-0" data-testid="redemptions-title">
        {{ MY_REDEMPTIONS_COPY.heading }}
      </DsHeading>
      <UButton
        to="/cikgu/hadiah"
        size="lg"
        class="min-h-11 shrink-0"
        data-testid="redemptions-to-shop"
      >
        {{ MY_REDEMPTIONS_COPY.toShop }}
      </UButton>
    </section>

    <DsLoadError
      v-if="list.error.value"
      :message="COMMON_COPY.loadFailed"
      testid="m15-load-error"
      retry-testid="m15-retry"
      @retry="list.reload()"
    />
    <LoadSkeleton v-else-if="!ready" testid="redemptions-loading" />
    <UCard v-else data-testid="redemptions-empty">
      <DsStack gap="sm" align="center" class="text-center">
        <DsText variant="display" as="span" data-testid="redemptions-icon">
          {{ MY_REDEMPTIONS_COPY.icon }}
        </DsText>
        <DsText variant="body" tone="muted">{{ MY_REDEMPTIONS_COPY.empty }}</DsText>
        <UButton to="/cikgu/hadiah" size="xl" class="min-h-14" data-testid="redemptions-browse">
          {{ MY_REDEMPTIONS_COPY.browse }}
        </UButton>
      </DsStack>
    </UCard>
  </DsPage>
</template>
