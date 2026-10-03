<script setup lang="ts">
/**
 * S21 top cards (FR-M10-91..93; FN-M10-7.1.1–7.1.4): the four stat cards, the info text, the badge
 * tiers with the next target (BR-M10-23) and "Pecahan Subjek". Text is never smaller than 12px
 * (FR-M10-129, DV-M10-28).
 */
import { computed } from 'vue'
import { Check, Globe, Medal, PieChart } from '@lucide/vue'

import { AppIcon } from '@/components/icon'
import { formatCount } from '@/lib/number'

import type { Contributions } from '../../api/types'

const props = defineProps<{ summary: Contributions }>()

/** FR-M10-93: all chips by count descending ("Lain" takes its count position, stable for ties). */
const chips = computed(() => [...props.summary.breakdown].sort((a, b) => b.count - a.count))

const CARD = 'min-w-0 rounded-2xl bg-white p-4 text-center shadow-sm'
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="contribution-summary">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="stat-cards">
      <div :class="CARD" data-testid="stat-total">
        <div class="text-2xl font-bold text-slate-800" data-testid="stat-total-value">
          {{ summary.stats.total }}
        </div>
        <div class="text-sm text-slate-500">📝 Jumlah</div>
      </div>
      <div :class="CARD" data-testid="stat-approved">
        <div class="text-2xl font-bold text-emerald-600" data-testid="stat-approved-value">
          {{ summary.stats.approved }}
        </div>
        <div class="text-sm text-emerald-600">✅ Diluluskan</div>
      </div>
      <div :class="CARD" data-testid="stat-pending">
        <div class="text-2xl font-bold text-amber-600" data-testid="stat-pending-value">
          {{ summary.stats.pending }}
        </div>
        <div class="text-sm text-amber-700">⏳ Menunggu</div>
      </div>
      <div :class="CARD" data-testid="stat-used">
        <div class="text-2xl font-bold text-cyan-600" data-testid="stat-used-value">
          {{ summary.stats.used }}
        </div>
        <div class="text-sm text-cyan-700">📊 Digunakan</div>
      </div>
    </div>

    <p
      class="flex min-w-0 items-start gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-700"
      data-testid="contribution-info"
    >
      <Globe class="mt-0.5 h-4 w-4 shrink-0" />
      <span class="min-w-0">
        <strong>Sumbang Soalan</strong> adalah platform perkongsian soalan untuk manfaat semua
        pelajar di seluruh Malaysia. Setiap soalan yang anda sumbangkan akan melalui proses semakan
        dan seterusnya tersedia dalam bank soalan kebangsaan PrestasiPlus. Sumbangan anda amat
        dihargai dalam membina masa depan pendidikan negara.
      </span>
    </p>

    <section class="min-w-0 rounded-2xl bg-white p-4 shadow-sm" data-testid="tiers-card">
      <h2 class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
        <Medal class="h-4 w-4 text-amber-600" />
        Pencapaian Badge Penyumbang
      </h2>
      <ul class="flex flex-wrap gap-2">
        <li
          v-for="tier in summary.tiers"
          :key="tier.name"
          :class="[
            'inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold',
            tier.reached
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-slate-200 bg-slate-50 text-slate-500',
          ]"
          :data-reached="tier.reached ? 'true' : 'false'"
          data-testid="tier"
        >
          <AppIcon :name="tier.icon" class="h-3.5 w-3.5" />
          {{ tier.name }}
          <span class="font-normal">({{ formatCount(tier.threshold) }})</span>
          <Check v-if="tier.reached" class="h-3.5 w-3.5 text-emerald-600" />
        </li>
      </ul>
      <p v-if="summary.nextTier" class="mt-3 text-xs text-slate-500" data-testid="next-tier">
        Sasaran seterusnya: <strong class="text-indigo-700">{{ summary.nextTier.name }}</strong> —
        {{ formatCount(summary.nextTier.threshold) }} soalan
      </p>
    </section>

    <section class="min-w-0 rounded-2xl bg-white p-4 shadow-sm" data-testid="breakdown-card">
      <h2 class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
        <PieChart class="h-4 w-4 text-indigo-600" />
        Pecahan Subjek
      </h2>
      <ul class="flex flex-wrap gap-2">
        <li
          v-for="row in chips"
          :key="row.label"
          class="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800"
          data-testid="breakdown-chip"
        >
          {{ row.label }} — {{ formatCount(row.count) }}
        </li>
      </ul>
    </section>
  </div>
</template>
