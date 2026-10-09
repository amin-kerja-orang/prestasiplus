<script setup lang="ts">
/** One PROPOSED S23 card (FN-M16-8.1.3): `fa-trophy`, the title and the banner line, linking to the detail. */
import { Trophy } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import type { TournamentListItem } from '../../api'
import { STATUS_LINE } from './copy'

defineProps<{ item: TournamentListItem }>()
</script>

<template>
  <RouterLink
    :to="`/tournament/${item.uuid}`"
    class="flex min-h-11 items-center gap-3 rounded-xl border border-indigo-200 bg-linear-to-r from-indigo-50 to-purple-50 p-4 shadow-sm hover:shadow-md"
    data-testid="tournament-card"
  >
    <span
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-500"
    >
      <Trophy class="h-5 w-5" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-bold text-gray-800" data-testid="tournament-title">
        {{ item.title }}
      </span>
      <span class="block text-xs text-gray-600" data-testid="tournament-line">
        {{ STATUS_LINE[item.status] }}
      </span>
    </span>
  </RouterLink>
</template>
