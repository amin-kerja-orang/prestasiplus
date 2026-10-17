<script setup lang="ts">
/**
 * S21 top cards (FR-M10-91..93; FN-M10-7.1.1–7.1.4): the four stat tiles, the info text, the badge
 * tiers with the next target (BR-M10-23) and "Pecahan Subjek". Text is never smaller than 12px
 * (FR-M10-129, DV-M10-28).
 */
import { computed } from 'vue'

import { DsStatTile } from '@/ds'
import { formatCount } from '@/lib/number'

import type { Contributions } from '../../api/types'

const props = defineProps<{ summary: Contributions }>()

/** Tier icons arrive as Font Awesome names; mapped to Phosphor (literal strings so the bundler finds them). */
const TIER_ICONS: Record<string, string> = {
  'fa-seedling': 'i-ph-plant-duotone',
  'fa-fire': 'i-ph-fire-duotone',
  'fa-award': 'i-ph-medal-duotone',
  'fa-trophy': 'i-ph-trophy-duotone',
  'fa-crown': 'i-ph-crown-duotone',
  'fa-gem': 'i-ph-diamond-duotone',
  'fa-star': 'i-ph-star-duotone',
}
const tierIcon = (icon: string): string =>
  TIER_ICONS[icon.split(' ').find((p) => p.startsWith('fa-') && p in TIER_ICONS) ?? ''] ??
  'i-ph-medal-duotone'

/** FR-M10-93: all chips by count descending ("Lain" takes its count position, stable for ties). */
const chips = computed(() => [...props.summary.breakdown].sort((a, b) => b.count - a.count))
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4" data-testid="contribution-summary">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="stat-cards">
      <div data-testid="stat-total">
        <DsStatTile
          :value="summary.stats.total"
          unit="📝 Jumlah"
          icon="i-ph-note-pencil-duotone"
          data-testid="stat-total-value"
        />
      </div>
      <div data-testid="stat-approved">
        <DsStatTile
          :value="summary.stats.approved"
          unit="✅ Diluluskan"
          icon="i-ph-check-circle-duotone"
          data-testid="stat-approved-value"
        />
      </div>
      <div data-testid="stat-pending">
        <DsStatTile
          :value="summary.stats.pending"
          unit="⏳ Menunggu"
          icon="i-ph-hourglass-duotone"
          data-testid="stat-pending-value"
        />
      </div>
      <div data-testid="stat-used">
        <DsStatTile
          :value="summary.stats.used"
          unit="📊 Digunakan"
          icon="i-ph-chart-bar-duotone"
          data-testid="stat-used-value"
        />
      </div>
    </div>

    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-ph-globe-duotone"
      data-testid="contribution-info"
    >
      <template #description>
        <strong>Sumbang Soalan</strong> adalah platform perkongsian soalan untuk manfaat semua
        pelajar di seluruh Malaysia. Setiap soalan yang anda sumbangkan akan melalui proses semakan
        dan seterusnya tersedia dalam bank soalan kebangsaan PrestasiPlus. Sumbangan anda amat
        dihargai dalam membina masa depan pendidikan negara.
      </template>
    </UAlert>

    <UCard data-testid="tiers-card">
      <h2 class="mb-3 flex items-center gap-2 text-subheading text-highlighted">
        <UIcon name="i-ph-medal-duotone" class="size-5 text-primary" />
        Pencapaian Badge Penyumbang
      </h2>
      <ul class="flex flex-wrap gap-2">
        <li
          v-for="tier in summary.tiers"
          :key="tier.name"
          :data-reached="tier.reached ? 'true' : 'false'"
          data-testid="tier"
        >
          <UBadge v-if="tier.reached" color="primary" variant="subtle" size="lg">
            <UIcon :name="tierIcon(tier.icon)" class="size-4" />
            {{ tier.name }}
            <span>({{ formatCount(tier.threshold) }})</span>
            <UIcon name="i-ph-check-circle-duotone" class="size-4" />
          </UBadge>
          <UBadge v-else color="neutral" variant="subtle" size="lg">
            <UIcon :name="tierIcon(tier.icon)" class="size-4" />
            {{ tier.name }}
            <span>({{ formatCount(tier.threshold) }})</span>
          </UBadge>
        </li>
      </ul>
      <p v-if="summary.nextTier" class="mt-3 text-caption text-muted" data-testid="next-tier">
        Sasaran seterusnya: <strong class="text-highlighted">{{ summary.nextTier.name }}</strong> —
        {{ formatCount(summary.nextTier.threshold) }} soalan
      </p>
    </UCard>

    <UCard data-testid="breakdown-card">
      <h2 class="mb-3 flex items-center gap-2 text-subheading text-highlighted">
        <UIcon name="i-ph-chart-pie-duotone" class="size-5 text-primary" />
        Pecahan Subjek
      </h2>
      <ul class="flex flex-wrap gap-2">
        <li v-for="row in chips" :key="row.label" data-testid="breakdown-chip">
          <UBadge color="neutral" variant="subtle" size="lg"
            >{{ row.label }} — {{ formatCount(row.count) }}</UBadge
          >
        </li>
      </ul>
    </UCard>
  </div>
</template>
