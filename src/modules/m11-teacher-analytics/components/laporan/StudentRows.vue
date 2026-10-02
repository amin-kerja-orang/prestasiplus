<script setup lang="ts">
/**
 * Student rows shared by the S1 panels and lists (FN-M11-2.4.2): initials avatar (#94a3b8), name
 * (semibold, truncates), e-mail (12px slate-400, truncates, DV-M11-16 / DV-M11-23) and the right label,
 * either "Belum pernah login" (red) for a pupil who never logged in or "{n} aktiviti" ("Paling Aktif").
 */
import { initialsAvatarUrl } from '@/shells/shared/avatar'

import type { StudentLite } from '../../api/types'
import { activityCount, LAPORAN_COPY } from './copy'

defineProps<{
  rows: (StudentLite & { activities?: number })[]
  testId: string
}>()
</script>

<template>
  <ul :data-testid="testId">
    <li
      v-for="(s, i) in rows"
      :key="s.id"
      :class="['flex min-w-0 items-center gap-3 py-2.5', i > 0 ? 'border-t border-slate-50' : '']"
      data-testid="student-row"
      :data-student-id="s.id"
    >
      <img
        :src="s.avatarUrl || initialsAvatarUrl(s.name, '#94a3b8')"
        alt=""
        class="h-9 w-9 shrink-0 rounded-full object-cover"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-slate-700" data-testid="student-name">
          {{ s.name }}
        </p>
        <p class="truncate text-xs text-slate-400" data-testid="student-email">{{ s.email }}</p>
      </div>
      <span
        v-if="s.activities !== undefined"
        class="shrink-0 text-xs font-semibold text-amber-600"
        data-testid="student-activities"
        >{{ activityCount(s.activities) }}</span
      >
      <span
        v-else-if="s.neverLoggedIn"
        class="shrink-0 text-xs text-red-400"
        data-testid="student-never"
        >{{ LAPORAN_COPY.neverLoggedIn }}</span
      >
    </li>
  </ul>
</template>
