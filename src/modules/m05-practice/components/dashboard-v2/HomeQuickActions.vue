<script setup lang="ts">
/** Quick actions (FR-M05-18, 19): one primary button and four secondary links. */
import { revisionBadge } from '../dashboard/dashboard-lib'

defineProps<{ revisionTotal: number; isAdmin: boolean }>()
</script>

<template>
  <nav class="flex flex-col gap-3" aria-label="Tindakan pantas">
    <ul class="grid grid-cols-2 gap-3" data-testid="dash-quick">
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
    </ul>
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
  </nav>
</template>
