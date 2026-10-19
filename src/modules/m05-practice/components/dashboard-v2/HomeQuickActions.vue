<script setup lang="ts">
/** Quick actions (FR-M05-18, 19): one primary button and four secondary links. */
import { revisionBadge } from '../dashboard/dashboard-lib'
import { DsGrid, DsStack } from '@/ds'

defineProps<{ revisionTotal: number; isAdmin: boolean }>()
</script>

<template>
  <DsStack as="nav" gap="sm" aria-label="Tindakan pantas">
    <DsGrid :cols="2" gap="sm" as="ul" data-testid="dash-quick">
      <li class="col-span-2">
        <UButton to="/practice" size="xl" block class="min-h-12" data-testid="dash-quick-practice"
          >🚀 Mula Latihan</UButton
        >
      </li>
      <li class="min-w-0">
        <UButton
          to="/practice/revision"
          color="neutral"
          variant="soft"
          size="lg"
          block
          class="min-h-12"
          data-testid="dash-quick-revision"
        >
          🔄 Soalan Aku Salah
          <UBadge
            v-if="revisionBadge(revisionTotal)"
            color="error"
            size="sm"
            data-testid="dash-revision-badge"
            >{{ revisionBadge(revisionTotal) }}</UBadge
          >
        </UButton>
      </li>
      <li class="min-w-0">
        <UButton
          to="/practice/progress"
          color="neutral"
          variant="soft"
          size="lg"
          block
          class="min-h-12"
          data-testid="dash-quick-progress"
          >📈 Kemajuan</UButton
        >
      </li>
      <li class="min-w-0">
        <UButton
          to="/practice/history"
          color="neutral"
          variant="soft"
          size="lg"
          block
          class="min-h-12"
          data-testid="dash-quick-history"
          >📊 Sejarah Latihan</UButton
        >
      </li>
      <li class="min-w-0">
        <UButton
          to="/leaderboard"
          color="neutral"
          variant="soft"
          size="lg"
          block
          class="min-h-12"
          data-testid="dash-quick-leaderboard"
          >🏅 Papan Pendahulu</UButton
        >
      </li>
    </DsGrid>
    <UButton
      v-if="isAdmin"
      to="/admin"
      color="neutral"
      variant="soft"
      size="lg"
      block
      class="min-h-12"
      trailing-icon="i-ph-arrow-right-bold"
      data-testid="dash-quick-admin"
      >Panel Admin</UButton
    >
  </DsStack>
</template>
