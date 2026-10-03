<script setup lang="ts">
/**
 * S17 `/gamification/history` "Sejarah Transaksi" (M14-T2a; FR-M14-23…26, BR-M14-33). Reads #4 with the
 * live `?type=` query; every row of the viewer's ledger, newest first, no pager. An unknown `type`
 * renders the empty state (FR-M14-08).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
import { formatCount } from '@/lib/number'
import { formatDateTime } from '@/lib/time/format'

import { fetchGamificationTransactions } from '../api'
import {
  gamAmountClass,
  gamLedgerIcon,
  gamRelativeTime,
  gamSignedAmount,
} from '../lib/student/s11-format'

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

const pillClass = (key: string) =>
  type.value === key ? 'bg-blue-500 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="gamification-history-page">
    <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div class="min-w-0">
        <h1 class="font-heading text-2xl font-bold text-slate-800">📋 Sejarah Transaksi</h1>
        <p v-if="tx.data.value" class="text-sm text-slate-500" data-testid="s17-balance">
          Baki semasa: <strong>{{ formatCount(tx.data.value.meta.currentSyiling) }}</strong> syiling
        </p>
      </div>
      <RouterLink
        to="/gamification"
        class="inline-flex min-h-11 items-center text-sm font-medium text-blue-600 hover:underline"
        data-testid="s17-back"
        >← Dashboard</RouterLink
      >
    </div>

    <nav class="flex flex-wrap gap-2" data-testid="s17-pills">
      <RouterLink
        v-for="p in PILLS"
        :key="p.key || 'all'"
        :to="
          p.key
            ? { path: '/gamification/history', query: { type: p.key } }
            : '/gamification/history'
        "
        class="inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm"
        :class="pillClass(p.key)"
        :data-active="type === p.key ? 'true' : 'false'"
        data-testid="s17-pill"
        >{{ p.label }}</RouterLink
      >
    </nav>

    <AlertBox v-if="tx.error.value" messages="Ralat berlaku. Sila cuba lagi." />

    <div
      v-else-if="!tx.data.value"
      class="flex justify-center py-10 text-slate-400"
      data-testid="s17-loading"
    >
      <LoadingSpinner :size="28" />
    </div>

    <section
      v-else-if="tx.data.value.data.length === 0"
      class="rounded-2xl bg-white px-6 py-14 text-center shadow"
      data-testid="s17-empty"
    >
      <p class="text-5xl">📋</p>
      <p class="mt-3 text-base font-semibold text-slate-400">Belum ada transaksi</p>
      <p class="mt-1 text-sm text-slate-400">Mula latih tubi untuk dapatkan syiling!</p>
    </section>

    <section v-else class="min-w-0 rounded-2xl bg-white p-3 shadow sm:p-4" data-testid="s17-list">
      <ul class="divide-y divide-slate-100">
        <li
          v-for="r in tx.data.value.data"
          :key="r.id"
          class="flex min-w-0 items-center gap-3 py-3"
          data-testid="s17-row"
        >
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-lg"
            data-testid="s17-row-icon"
            >{{ gamLedgerIcon(r.type) }}</span
          >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium break-words text-slate-800" data-testid="s17-row-desc">
              {{ r.description }}
            </p>
            <p class="text-xs text-slate-400" data-testid="s17-row-time">
              {{ formatDateTime(r.createdAt) }} · {{ gamRelativeTime(r.createdAt) }}
            </p>
          </div>
          <div class="shrink-0 text-right">
            <p
              class="text-sm font-bold"
              :class="gamAmountClass(r.amount)"
              data-testid="s17-row-amount"
            >
              {{ gamSignedAmount(r.amount) }}
            </p>
            <p class="text-xs text-slate-400" data-testid="s17-row-balance">
              Baki: {{ formatCount(r.balanceAfter) }}
            </p>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
