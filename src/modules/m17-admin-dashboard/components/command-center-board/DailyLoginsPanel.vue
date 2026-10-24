<script setup lang="ts">
/**
 * "Login Terkini" of S3 (FR-M17-45, FN-M17-4.4.4, BR-M17-24): role tag, name (pupils to S7, teachers to S5),
 * school or "Pelajar Luar" for a pupil without a school, package chip, relative time.
 */
import type { CcDailyActivity, CcLoginRow } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { shortSchool } from '../command-center/cc-format'
import { ROLE_LABEL, S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

const props = defineProps<{ data: CcDailyActivity | null; status: LoadStatus; basePath: string }>()
const paths = ccPaths(props.basePath)

type BadgeColor = 'primary' | 'success' | 'info' | 'warning' | 'neutral'
const ROLE_COLOR: Record<string, BadgeColor> = {
  student: 'success',
  teacher: 'info',
  admin: 'primary',
  school_admin: 'primary',
  parent: 'warning',
}

function link(row: CcLoginRow): string | null {
  if (row.role === 'student') return paths.student(row.userId)
  if (row.role === 'teacher' && row.schoolId !== null)
    return paths.teacher(row.schoolId, row.userId)
  return null
}
</script>

<template>
  <DailyPanel title="Login Terkini" icon="i-ph-sign-in" testid="cc-panel-logins" :state="status">
    <p
      v-if="!data || data.logins.recent.length === 0"
      class="py-2 text-body text-muted"
      data-testid="cc-empty"
    >
      {{ S3_COPY.noLogins }}
    </p>
    <ul v-else class="flex flex-col gap-1">
      <li
        v-for="r in data.logins.recent"
        :key="r.userId"
        class="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 bg-soft px-3 py-2 text-body"
        data-testid="cc-login-row"
      >
        <UBadge
          :color="ROLE_COLOR[r.role] ?? 'neutral'"
          variant="soft"
          size="sm"
          class="shrink-0"
          data-testid="cc-login-role"
          >{{ ROLE_LABEL[r.role] ?? r.role }}</UBadge
        >
        <UButton
          v-if="link(r)"
          :to="link(r) ?? ''"
          variant="link"
          color="neutral"
          class="h-auto min-w-0 p-0 text-start"
          :label="r.name"
          data-testid="cc-login-name"
        />
        <span
          v-else
          class="min-w-0 text-label break-words text-highlighted"
          data-testid="cc-login-name"
          >{{ r.name }}</span
        >
        <span
          v-if="r.schoolName"
          class="min-w-0 text-caption break-words text-muted"
          data-testid="cc-login-school"
          :title="r.schoolName"
          >{{ shortSchool(r.schoolName) }}</span
        >
        <span
          v-else-if="r.role === 'student'"
          class="text-caption text-error"
          data-testid="cc-login-school"
          >{{ S3_COPY.outsider }}</span
        >
        <span class="ms-auto shrink-0 text-caption text-toned" data-testid="cc-login-package">{{
          r.package
        }}</span>
        <span class="shrink-0 text-caption text-muted" data-testid="cc-login-ago">{{
          r.timeAgo
        }}</span>
      </li>
    </ul>
  </DailyPanel>
</template>
