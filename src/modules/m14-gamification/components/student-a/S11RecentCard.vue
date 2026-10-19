<script setup lang="ts">
/** S11 "Transaksi Terkini" (FN-M14-2.1.7; FR-M14-19): latest 6 ledger rows, "Semua →". */
import { DsIconChip } from '@/ds'

import type { LedgerEntry } from '../../api'
import { gamLedgerIcon, gamRelativeTime, gamSignedAmount } from '../../lib/student/s11-format'

defineProps<{ rows: readonly LedgerEntry[] }>()
</script>

<template>
  <UCard class="min-w-0" data-testid="s11-recent">
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3">
        <h2 class="flex items-center gap-2 font-display text-subheading font-bold text-highlighted">
          <DsIconChip icon="i-ph-clock-counter-clockwise-duotone" size="sm" />Transaksi Terkini
        </h2>
        <UButton
          to="/gamification/history"
          variant="link"
          size="sm"
          class="min-h-11"
          data-testid="s11-recent-all"
          >Semua →</UButton
        >
      </div>
      <ul class="flex flex-col gap-3">
        <li
          v-for="r in rows"
          :key="r.id"
          class="flex min-w-0 items-center gap-3"
          data-testid="s11-recent-row"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-chip bg-elevated text-heading"
            aria-hidden="true"
            >{{ gamLedgerIcon(r.type) }}</span
          >
          <div class="flex min-w-0 flex-1 flex-col">
            <p class="truncate text-label text-highlighted">{{ r.description }}</p>
            <p class="text-caption text-muted">{{ gamRelativeTime(r.createdAt) }}</p>
          </div>
          <span
            class="tabular shrink-0 font-display text-label font-extrabold"
            :class="r.amount < 0 ? 'text-muted' : 'text-success'"
            >{{ gamSignedAmount(r.amount) }}</span
          >
        </li>
      </ul>
    </div>
  </UCard>
</template>
