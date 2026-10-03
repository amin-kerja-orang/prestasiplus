<script setup lang="ts">
/** S11 "Transaksi Terkini" (FN-M14-2.1.7; FR-M14-19): latest 6 ledger rows, "Semua →". */
import { History } from '@lucide/vue'

import type { LedgerEntry } from '../../api'
import {
  gamAmountClass,
  gamLedgerIcon,
  gamRelativeTime,
  gamSignedAmount,
} from '../../lib/student/s11-format'

defineProps<{ rows: readonly LedgerEntry[] }>()
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow sm:p-5" data-testid="s11-recent">
    <div class="flex items-center justify-between gap-3">
      <h2 class="flex items-center gap-2 font-heading text-lg font-semibold">
        <History class="h-5 w-5 text-blue-600" />Transaksi Terkini
      </h2>
      <RouterLink
        to="/gamification/history"
        class="inline-flex min-h-11 items-center text-xs font-medium text-blue-600 hover:underline"
        data-testid="s11-recent-all"
        >Semua →</RouterLink
      >
    </div>
    <ul class="mt-2 space-y-3">
      <li
        v-for="r in rows"
        :key="r.id"
        class="flex min-w-0 items-center gap-3"
        data-testid="s11-recent-row"
      >
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-lg"
          >{{ gamLedgerIcon(r.type) }}</span
        >
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-slate-800">{{ r.description }}</p>
          <p class="text-xs text-slate-400">{{ gamRelativeTime(r.createdAt) }}</p>
        </div>
        <span class="shrink-0 text-sm font-bold" :class="gamAmountClass(r.amount)">{{
          gamSignedAmount(r.amount)
        }}</span>
      </li>
    </ul>
  </section>
</template>
