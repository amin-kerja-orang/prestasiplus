<script setup lang="ts">
/**
 * "Login Terkini" of S3 (FR-M17-45, FN-M17-4.4.4, BR-M17-24): role tag, name (pupils to S7, teachers to S5),
 * school or "Pelajar Luar" for a pupil without a school, package chip, relative time.
 */
import { DsBadge, DsEmptyState, DsListRow, DsStack } from '@/ds'

import type { CcDailyActivity, CcLoginRow } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { shortSchool } from '../command-center/cc-format'
import { roleLabel, S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

const props = defineProps<{ data: CcDailyActivity | null; status: LoadStatus; basePath: string }>()
const paths = ccPaths(props.basePath)

type BadgeTone = 'primary' | 'success' | 'info' | 'warning' | 'neutral'
const ROLE_TONE: Record<string, BadgeTone> = {
  student: 'success',
  teacher: 'info',
  admin: 'primary',
  school_admin: 'primary',
  parent: 'warning',
  ppd_officer: 'info',
  sponsor: 'warning',
}

function link(row: CcLoginRow): string | undefined {
  if (row.role === 'student') return paths.student(row.userId)
  if (row.role === 'teacher' && row.schoolId !== null)
    return paths.teacher(row.schoolId, row.userId)
  return undefined
}
</script>

<template>
  <DailyPanel title="Login Terkini" icon="i-ph-sign-in" testid="cc-panel-logins" :state="status">
    <DsEmptyState
      v-if="!data || data.logins.recent.length === 0"
      size="sm"
      :title="S3_COPY.noLogins"
      data-testid="cc-empty"
    />
    <DsStack v-else as="ul" gap="xs">
      <DsListRow
        v-for="r in data.logins.recent"
        :key="r.userId"
        :title="r.name"
        :to="link(r)"
        density="tight"
        data-testid="cc-login-row"
      >
        <template #sub
          ><span class="block truncate"
            ><span v-if="r.schoolName" :title="r.schoolName" data-testid="cc-login-school">{{
              shortSchool(r.schoolName)
            }}</span
            ><span
              v-else-if="r.role === 'student'"
              class="text-error"
              data-testid="cc-login-school"
              >{{ S3_COPY.outsider }}</span
            >
            ·
            <span data-testid="cc-login-package">{{ r.package }}</span></span
          ></template
        >
        <template #meta
          ><span class="flex flex-col items-end"
            ><DsBadge
              :tone="ROLE_TONE[r.role] ?? 'neutral'"
              size="sm"
              :label="roleLabel(r.role)"
              data-testid="cc-login-role"
            /><span class="text-caption text-muted" data-testid="cc-login-ago">{{
              r.timeAgo
            }}</span></span
          ></template
        >
      </DsListRow>
    </DsStack>
  </DailyPanel>
</template>
