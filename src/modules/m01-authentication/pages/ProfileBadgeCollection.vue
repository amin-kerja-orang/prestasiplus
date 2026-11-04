<script setup lang="ts">
/**
 * R1-MUR-A1 block 6 (FR-MUR-A1-1, issue 458 decision 4): card "Koleksi Lencana". Every configured badge is
 * listed; the ones not yet earned stay visible and greyed. "{n} lencana telah dikumpul" counts the unlocked
 * badges. With none unlocked the empty text and the button "Mula Latih Tubi" (`/practice`) show.
 */
import { computed } from 'vue'

import type { AccountProfileBadge } from '@pp/contract'

import { DsBadgeTile } from '@/ds'
import { formatDateShortMs } from '@/lib/time'

const props = defineProps<{
  badges: readonly AccountProfileBadge[]
}>()

const collected = computed(() => props.badges.filter((b) => b.unlocked).length)
</script>

<template>
  <UCard data-testid="profile-badges">
    <div class="flex flex-col gap-4">
      <div>
        <h2 class="flex items-center gap-2 text-subheading text-highlighted">
          <UIcon name="i-ph-medal" class="size-5" aria-hidden="true" />
          Koleksi Lencana
        </h2>
        <p class="text-caption text-muted" data-testid="profile-badges-count">
          {{ collected }} lencana telah dikumpul
        </p>
      </div>

      <div
        v-if="collected === 0"
        class="flex flex-col items-center gap-2 text-center"
        data-testid="profile-badges-empty"
      >
        <p class="text-body text-highlighted">Belum ada lencana lagi</p>
        <p class="text-caption text-muted">Teruskan berlatih untuk dapatkan lencana pertama anda!</p>
        <UButton
          to="/practice"
          color="primary"
          variant="soft"
          size="lg"
          class="min-h-11"
          data-testid="profile-badges-start"
          >Mula Latih Tubi</UButton
        >
      </div>

      <ul v-if="badges.length > 0" class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <li
          v-for="badge in badges"
          :key="badge.code"
          class="min-w-0"
          :data-locked="badge.unlocked ? 'false' : 'true'"
          data-testid="profile-badge"
        >
          <!-- A locked badge stays visible, greyed by the tile ("Terkunci"). -->
          <DsBadgeTile
            :state="badge.unlocked ? 'earned' : 'locked'"
            :title="badge.name"
            :date="badge.earnedAt ? formatDateShortMs(badge.earnedAt) : undefined"
          />
        </li>
      </ul>
    </div>
  </UCard>
</template>
