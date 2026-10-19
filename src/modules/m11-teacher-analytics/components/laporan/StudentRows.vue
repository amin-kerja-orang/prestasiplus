<script setup lang="ts">
/**
 * Student rows shared by the S1 panels and lists (FN-M11-2.4.2): initials avatar, name (truncates),
 * e-mail (truncates, DV-M11-16 / DV-M11-23) and the right label, either "Belum pernah login" for a
 * pupil who never logged in or "{n} aktiviti" ("Paling Aktif").
 */
import type { StudentLite } from '../../api/types'
import { activityCount, LAPORAN_COPY } from './copy'
import { DsStack, DsText } from '@/ds'

defineProps<{
  rows: (StudentLite & { activities?: number })[]
  testId: string
}>()
</script>

<template>
  <DsStack as="ul" gap="none" :data-testid="testId">
    <li
      v-for="s in rows"
      :key="s.id"
      class="flex min-w-0 items-center gap-3 py-2 even:bg-soft"
      data-testid="student-row"
      :data-student-id="s.id"
    >
      <UAvatar :src="s.avatarUrl || undefined" :alt="s.name" size="md" />
      <div class="min-w-0 flex-1">
        <DsText variant="label" as="p" tone="highlighted" truncate data-testid="student-name">
          {{ s.name }}
        </DsText>
        <DsText variant="caption" truncate data-testid="student-email">{{ s.email }}</DsText>
      </div>
      <UBadge
        v-if="s.activities !== undefined"
        color="primary"
        variant="subtle"
        class="shrink-0"
        data-testid="student-activities"
        :label="activityCount(s.activities)"
      />
      <DsText
        v-else-if="s.neverLoggedIn"
        variant="caption"
        as="span"
        tone="error"
        class="shrink-0"
        data-testid="student-never"
        >{{ LAPORAN_COPY.neverLoggedIn }}</DsText
      >
    </li>
  </DsStack>
</template>
