<script setup lang="ts">
/**
 * S5 quota panel (FR-M02-59): while loading "Memeriksa kuota..."; with a subscription a panel with
 * "Kuota Pelajar", "{used} / {quota}", a progress bar of min(100, round(used × 100 / quota))% and
 * "Baki kuota: {remaining} pelajar" (emerald) or "Kuota penuh! Sila tingkatkan kuota dahulu." (red);
 * without one (or when the request failed) the amber warning "Sekolah ini tiada langganan aktif. Import
 * pelajar tidak dibenarkan.".
 */
import { LoaderCircle, TriangleAlert, Users } from '@lucide/vue'
import { computed } from 'vue'

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
    <p
      v-if="loading"
      class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500"
      data-testid="quota-loading"
    >
      <LoaderCircle class="h-4 w-4 animate-spin" aria-hidden="true" />
      Memeriksa kuota...
    </p>
    <div
      v-else-if="subscribed"
      :class="[
        'rounded-xl border p-3',
        full ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50',
      ]"
      :data-state="full ? 'full' : 'available'"
      data-testid="quota-summary"
    >
      <div class="mb-2 flex items-center justify-between gap-3">
        <span
          :class="[
            'flex items-center gap-2 text-sm font-semibold',
            full ? 'text-red-700' : 'text-emerald-700',
          ]"
        >
          <Users class="h-4 w-4" aria-hidden="true" />
          Kuota Pelajar
        </span>
        <span
          :class="['text-sm font-semibold', full ? 'text-red-700' : 'text-emerald-700']"
          data-testid="quota-figures"
        >
          {{ used }} / {{ total }}
        </span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-white/70">
        <div
          :class="['h-2 rounded-full', full ? 'bg-red-500' : 'bg-emerald-500']"
          :style="{ width: `${String(percent)}%` }"
          data-testid="quota-bar"
        />
      </div>
      <p
        :class="['mt-2 text-xs', full ? 'text-red-600' : 'text-emerald-600']"
        data-testid="quota-note"
      >
        <template v-if="!full">Baki kuota: {{ remaining }} pelajar</template>
        <template v-else>Kuota penuh! Sila tingkatkan kuota dahulu.</template>
      </p>
    </div>
    <p
      v-else
      class="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"
      data-testid="quota-none"
    >
      <TriangleAlert class="h-4 w-4 shrink-0" aria-hidden="true" />
      Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.
    </p>
  </div>
</template>
