<script setup lang="ts">
/**
 * S5 quota panel (FR-M02-59): while loading "Memeriksa kuota..."; with a subscription a panel with
 * "Kuota Pelajar", "{used} / {quota}", a progress bar of min(100, round(used × 100 / quota))% and
 * "Baki kuota: {remaining} pelajar" or "Kuota penuh! Sila tingkatkan kuota dahulu."; without one (or when
 * the request failed) the warning "Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.".
 */
import { computed } from 'vue'

import { DsPanel } from '@/ds'

import type { SchoolQuota } from '../api/imports'
import { quotaPercent } from '../lib/import-options'

const props = defineProps<{
  loading: boolean
  /** `null` when the request failed: shown as "no subscription", as live. */
  quota: SchoolQuota | null
}>()

const subscribed = computed(() => props.quota?.hasSubscription === true)
const used = computed(() => props.quota?.used ?? 0)
const total = computed(() => props.quota?.quota ?? 0)
const remaining = computed(() => props.quota?.remaining ?? 0)
const full = computed(() => remaining.value <= 0)
const percent = computed(() => quotaPercent(used.value, total.value))
</script>

<template>
  <div data-testid="quota-panel">
    <DsPanel v-if="loading" tone="inset" data-testid="quota-loading">
      <p class="flex items-center gap-2 text-label text-muted">
        <UIcon name="i-ph-spinner-gap" class="size-4" aria-hidden="true" />
        Memeriksa kuota...
      </p>
    </DsPanel>
    <DsPanel
      v-else-if="subscribed"
      tone="inset"
      :data-state="full ? 'full' : 'available'"
      data-testid="quota-summary"
    >
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-3">
          <span class="flex items-center gap-2 text-label text-default">
            <UIcon name="i-ph-users" class="size-4" aria-hidden="true" />
            Kuota Pelajar
          </span>
          <span
            class="text-label"
            :class="full ? 'text-error' : 'text-success'"
            data-testid="quota-figures"
          >
            {{ used }} / {{ total }}
          </span>
        </div>
        <UProgress
          :model-value="percent"
          :color="full ? 'error' : 'success'"
          :aria-label="`Kuota digunakan ${String(percent)}%`"
          data-testid="quota-bar"
        />
        <p
          class="text-caption"
          :class="full ? 'text-error' : 'text-success'"
          data-testid="quota-note"
        >
          <template v-if="!full">Baki kuota: {{ remaining }} pelajar</template>
          <template v-else>Kuota penuh! Sila tingkatkan kuota dahulu.</template>
        </p>
      </div>
    </DsPanel>
    <DsPanel v-else tone="inset" data-testid="quota-none">
      <p class="flex items-center gap-2 text-label text-warning">
        <UIcon name="i-ph-warning" class="size-4 shrink-0" aria-hidden="true" />
        Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.
      </p>
    </DsPanel>
  </div>
</template>
