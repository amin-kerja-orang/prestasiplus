<script setup lang="ts">
/**
 * R1-MUR-A1 block 6 (FR-MUR-A1-1, issue 458 decision 4): card "Koleksi Lencana". Every configured badge is
 * listed; the ones not yet earned stay visible and greyed. "{n} lencana telah dikumpul" counts the unlocked
 * badges. With none unlocked the empty text and the button "Mula Latih Tubi" (`/practice`) show.
 */
import { computed } from 'vue'

import type { AccountProfileBadge } from '@pp/contract'

import { DsBadgeTile, DsCluster, DsGrid, DsHeading, DsStack, DsText } from '@/ds'
import { formatDateShortMs } from '@/lib/time'

const props = defineProps<{
  badges: readonly AccountProfileBadge[]
}>()

const collected = computed(() => props.badges.filter((b) => b.unlocked).length)
</script>

<template>
  <UCard data-testid="profile-badges">
    <DsStack gap="md">
      <DsStack gap="none">
        <DsCluster gap="xs">
          <UIcon name="i-ph-medal" class="size-5" aria-hidden="true" />
          <DsHeading :level="2" variant="subheading">Koleksi Lencana</DsHeading>
        </DsCluster>
        <DsText variant="caption" data-testid="profile-badges-count">
          {{ collected }} lencana telah dikumpul
        </DsText>
      </DsStack>

      <DsStack
        v-if="collected === 0"
        gap="xs"
        align="center"
        class="text-center"
        data-testid="profile-badges-empty"
      >
        <DsText variant="body" tone="highlighted">Belum ada lencana lagi</DsText>
        <DsText variant="caption">Teruskan berlatih untuk dapatkan lencana pertama anda!</DsText>
        <UButton
          to="/practice"
          color="primary"
          variant="soft"
          size="lg"
          class="min-h-11"
          data-testid="profile-badges-start"
          >Mula Latih Tubi</UButton
        >
      </DsStack>

      <DsGrid v-if="badges.length > 0" as="ul" gap="sm" :cols="{ base: 2, sm: 3, md: 4 }">
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
      </DsGrid>
    </DsStack>
  </UCard>
</template>
