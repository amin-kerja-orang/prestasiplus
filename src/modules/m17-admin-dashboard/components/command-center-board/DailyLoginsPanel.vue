<script setup lang="ts">
/**
 * "Login Terkini" of S3 (FR-M17-45, FN-M17-4.4.4, BR-M17-24): role tag, name (pupils to S7, teachers to S5),
 * school or "Pelajar Luar" (rose) for a pupil without a school, package chip, relative time.
 */
import { RouterLink } from 'vue-router'

import type { CcDailyActivity, CcLoginRow } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

const props = defineProps<{ data: CcDailyActivity | null; status: LoadStatus; basePath: string }>()
const paths = ccPaths(props.basePath)

const ROLE_TONE: Record<string, string> = {
  student: 'bg-emerald-500/15 text-emerald-400',
  teacher: 'bg-cyan-500/15 text-cyan-400',
  admin: 'bg-indigo-500/20 text-indigo-300',
  school_admin: 'bg-indigo-500/20 text-indigo-300',
  parent: 'bg-amber-500/15 text-amber-400',
}
const PACKAGE_TONE: Record<string, string> = {
  ADMIN: 'text-violet-400',
  PARENT: 'text-amber-400',
  AKTIF: 'text-emerald-400',
  PKSK: 'text-amber-400',
  SEKOLAH: 'text-indigo-300',
  BEBAS: 'text-cyan-400',
  FREE: 'text-slate-400',
}

function link(row: CcLoginRow): string | null {
  if (row.role === 'student') return paths.student(row.userId)
  if (row.role === 'teacher' && row.schoolId !== null)
    return paths.teacher(row.schoolId, row.userId)
  return null
}
</script>

<template>
  <DailyPanel title="Login Terkini" dot="bg-cyan-500" testid="cc-panel-logins" :state="status">
    <p
      v-if="!data || data.logins.recent.length === 0"
      class="py-2 text-sm text-slate-400"
      data-testid="cc-empty"
    >
      {{ S3_COPY.noLogins }}
    </p>
    <ul v-else class="divide-y divide-slate-800">
      <li
        v-for="r in data.logins.recent"
        :key="r.userId"
        class="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5 text-sm"
        data-testid="cc-login-row"
      >
        <span
          :class="[
            'shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase',
            ROLE_TONE[r.role] ?? 'bg-slate-800 text-slate-300',
          ]"
          data-testid="cc-login-role"
          >{{ r.role }}</span
        >
        <RouterLink
          v-if="link(r)"
          :to="link(r) ?? ''"
          class="min-w-0 font-semibold break-words text-slate-100 hover:text-indigo-300"
          data-testid="cc-login-name"
          >{{ r.name }}</RouterLink
        >
        <span
          v-else
          class="min-w-0 font-semibold break-words text-slate-100"
          data-testid="cc-login-name"
          >{{ r.name }}</span
        >
        <span
          v-if="r.schoolName"
          class="min-w-0 text-xs break-words text-slate-400"
          data-testid="cc-login-school"
          >{{ r.schoolName }}</span
        >
        <span
          v-else-if="r.role === 'student'"
          class="text-xs text-rose-400"
          data-testid="cc-login-school"
          >{{ S3_COPY.outsider }}</span
        >
        <span
          :class="[
            'ml-auto shrink-0 text-xs font-bold',
            PACKAGE_TONE[r.package] ?? 'text-slate-400',
          ]"
          data-testid="cc-login-package"
          >{{ r.package }}</span
        >
        <span class="shrink-0 text-xs text-slate-400" data-testid="cc-login-ago">{{
          r.timeAgo
        }}</span>
      </li>
    </ul>
  </DailyPanel>
</template>
