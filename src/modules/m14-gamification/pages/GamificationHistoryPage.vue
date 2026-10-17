<script setup lang="ts">
/**
 * S17 `/gamification/history` "Sejarah Transaksi" (M14-T2a; FR-M14-23…26, BR-M14-33). Reads #4 with the
 * live `?type=` query; every row of the viewer's ledger, newest first, no pager. An unknown `type`
 * renders the empty state (FR-M14-08). Rows are grouped under a day label.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables'
import { DsEmptyState, DsPage } from '@/ds'
import { formatCount } from '@/lib/number'
import { formatDate, formatDateKey, formatDateTime } from '@/lib/time/format'

import { fetchGamificationTransactions, type LedgerEntry } from '../api'
import { gamLedgerIcon, gamRelativeTime, gamSignedAmount } from '../lib/student/s11-format'

const route = useRoute()

const type = computed(() => {
  const raw = route.query.type
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' && v !== '' ? v : ''
})

const tx = useApi(
  (signal) => fetchGamificationTransactions({ type: type.value || undefined }, { signal }),
  [type],
)

const PILLS = [
  { key: '', label: 'Semua' },
  { key: 'earn', label: '💰 Dapat' },
  { key: 'spend', label: '🛍️ Belanja' },
  { key: 'convert', label: '🔄 Tukar' },
  { key: 'bonus', label: '🎁 Bonus' },
] as const

/** Rows in the order served, split into consecutive day groups. */
const groups = computed(() => {
  const out: { key: string; label: string; rows: LedgerEntry[] }[] = []
  for (const r of tx.data.value?.data ?? []) {
    const key = formatDateKey(r.createdAt)
    const last = out[out.length - 1]
    if (last && last.key === key) last.rows.push(r)
    else out.push({ key, label: formatDate(r.createdAt), rows: [r] })
  }
  return out
})
</script>

<template>
  <DsPage data-testid="gamification-history-page">
    <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div class="flex min-w-0 flex-col gap-1">
        <h1 class="text-title text-highlighted">📋 Sejarah Transaksi</h1>
        <p v-if="tx.data.value" class="text-body text-muted" data-testid="s17-balance">
          Baki semasa: <strong>{{ formatCount(tx.data.value.meta.currentSyiling) }}</strong> syiling
        </p>
      </div>
      <UButton
        to="/gamification"
        variant="link"
        class="min-h-11"
        data-testid="s17-back"
        >← Dashboard</UButton
      >
    </div>

    <nav class="flex gap-2 overflow-x-auto" data-testid="s17-pills" aria-label="Jenis transaksi">
      <UButton
        v-for="p in PILLS"
        :key="p.key || 'all'"
        :to="
          p.key
            ? { path: '/gamification/history', query: { type: p.key } }
            : '/gamification/history'
        "
        size="lg"
        class="shrink-0"
        :color="type === p.key ? 'primary' : 'neutral'"
        :variant="type === p.key ? 'solid' : 'soft'"
        :data-active="type === p.key ? 'true' : 'false'"
        data-testid="s17-pill"
        >{{ p.label }}</UButton
      >
    </nav>

    <UAlert
      v-if="tx.error.value"
      color="error"
      variant="subtle"
      title="Ralat berlaku. Sila cuba lagi."
    />

    <div v-else-if="!tx.data.value" class="flex flex-col gap-2" aria-busy="true" data-testid="s17-loading">
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </div>

    <div v-else-if="tx.data.value.data.length === 0" data-testid="s17-empty">
      <DsEmptyState
        icon="i-ph-clipboard-text-duotone"
        title="Belum ada transaksi"
        description="Mula latih tubi untuk dapatkan syiling!"
      />
    </div>

    <section v-else class="flex min-w-0 flex-col gap-4" data-testid="s17-list">
      <div v-for="g in groups" :key="g.key" class="flex flex-col gap-2">
        <h2 class="text-overline text-muted">{{ g.label }}</h2>
        <ul class="flex flex-col gap-2">
          <li v-for="r in g.rows" :key="r.id">
            <UCard :ui="{ body: 'flex items-center gap-3 p-3 sm:p-3' }" data-testid="s17-row">
              <UAvatar
                :text="gamLedgerIcon(r.type)"
                size="lg"
                class="bg-elevated"
                data-testid="s17-row-icon"
              />
              <div class="flex min-w-0 flex-1 flex-col">
                <p class="text-label break-words text-highlighted" data-testid="s17-row-desc">
                  {{ r.description }}
                </p>
                <p class="text-caption text-muted" data-testid="s17-row-time">
                  {{ formatDateTime(r.createdAt) }} · {{ gamRelativeTime(r.createdAt) }}
                </p>
              </div>
              <div class="flex shrink-0 flex-col items-end">
                <p
                  class="tabular text-heading"
                  :class="r.amount < 0 ? 'text-muted' : 'text-success'"
                  data-testid="s17-row-amount"
                >
                  {{ gamSignedAmount(r.amount) }}
                </p>
                <p class="tabular text-caption text-muted" data-testid="s17-row-balance">
                  Baki: {{ formatCount(r.balanceAfter) }}
                </p>
              </div>
            </UCard>
          </li>
        </ul>
      </div>
    </section>
  </DsPage>
</template>
