<script setup lang="ts">
/** FR-M05-17…19: the quick-action tiles; "Panel Admin" for the admin role only. */
import { ArrowRight, ShieldCheck } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { revisionBadge } from './dashboard-lib'

defineProps<{ revisionTotal: number; isAdmin: boolean }>()
</script>

<template>
  <div class="space-y-5 md:space-y-7">
    <div class="grid grid-cols-2 gap-5 md:grid-cols-5 md:gap-7" data-testid="dash-quick">
      <RouterLink to="/practice" class="quick-action-btn primary" data-testid="dash-quick-practice">
        <span class="text-3xl">🚀</span>
        <span>Mula Latihan</span>
      </RouterLink>
      <RouterLink
        to="/practice/revision"
        class="quick-action-btn"
        style="background: linear-gradient(135deg, #ef4444, #f97316); color: white"
        data-testid="dash-quick-revision"
      >
        <span class="text-3xl">🔄</span>
        <span>Soalan Aku Salah</span>
        <span
          v-if="revisionBadge(revisionTotal)"
          class="absolute -top-2 -right-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow-md"
          data-testid="dash-revision-badge"
          >{{ revisionBadge(revisionTotal) }}</span
        >
      </RouterLink>
      <RouterLink
        to="/practice/progress"
        class="quick-action-btn"
        style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white"
        data-testid="dash-quick-progress"
      >
        <span class="text-3xl">📈</span>
        <span>Kemajuan</span>
      </RouterLink>
      <RouterLink
        to="/practice/history"
        class="quick-action-btn success"
        data-testid="dash-quick-history"
      >
        <span class="text-3xl">📊</span>
        <span>Sejarah Latihan</span>
      </RouterLink>
      <RouterLink
        to="/leaderboard"
        class="quick-action-btn warning"
        data-testid="dash-quick-leaderboard"
      >
        <span class="text-3xl">🏅</span>
        <span>Papan Pendahulu</span>
      </RouterLink>
    </div>
    <RouterLink
      v-if="isAdmin"
      to="/admin"
      class="quick-action-btn w-full"
      style="
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%);
        color: white;
      "
      data-testid="dash-quick-admin"
    >
      <span class="text-3xl"><ShieldCheck class="h-8 w-8" /></span>
      <span>Panel Admin</span>
      <span class="text-3xl"><ArrowRight class="h-8 w-8" /></span>
    </RouterLink>
  </div>
</template>
