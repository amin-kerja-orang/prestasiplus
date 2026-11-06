<script setup lang="ts">
/**
 * Student rows shared by the S1 panels and lists (FN-M11-2.4.2): initials avatar, name (truncates),
 * e-mail (truncates, DV-M11-16 / DV-M11-23) and the right label, either "Belum pernah login" for a
 * pupil who never logged in or "{n} aktiviti" ("Paling Aktif").
 * AC-GUR-42-7: with `limit` the rows are sorted by name (Malay collation), the first `limit` are shown and a
 * "+ {n} lagi" button expands to all. The caller passes the same array that its card and title count (FR-GUR-42-3).
 */
import { computed, ref, watch } from 'vue'

import { DsStack } from '@/ds'

import type { StudentLite } from '../../api/types'
import { activityCount, LAPORAN_COPY, moreCount } from './copy'

const props = defineProps<{
  rows: (StudentLite & { activities?: number })[]
  testId: string
  limit?: number
}>()

const open = ref(false)
watch(
  () => props.rows,
  () => {
    open.value = false
  },
)

const sorted = computed(() =>
  props.limit === undefined
    ? props.rows
    : [...props.rows].sort(
        (a, b) => a.name.localeCompare(b.name, 'ms', { sensitivity: 'base' }) || a.id - b.id,
      ),
)
const shown = computed(() =>
  props.limit === undefined || open.value ? sorted.value : sorted.value.slice(0, props.limit),
)
const rest = computed(() => (props.limit === undefined ? 0 : sorted.value.length - props.limit))
</script>

<template>
  <DsStack gap="xs">
    <ul class="flex flex-col" :data-testid="testId">
      <li
        v-for="s in shown"
        :key="s.id"
        class="flex min-w-0 items-center gap-3 py-2 even:bg-soft"
        data-testid="student-row"
        :data-student-id="s.id"
      >
        <UAvatar :src="s.avatarUrl || undefined" :alt="s.name" size="md" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-label text-highlighted" data-testid="student-name">
            {{ s.name }}
          </p>
          <p class="truncate text-caption text-muted" data-testid="student-email">{{ s.email }}</p>
        </div>
        <UBadge
          v-if="s.activities !== undefined"
          color="primary"
          variant="subtle"
          class="shrink-0"
          data-testid="student-activities"
          :label="activityCount(s.activities)"
        />
        <span
          v-else-if="s.neverLoggedIn"
          class="shrink-0 text-caption text-error"
          data-testid="student-never"
          >{{ LAPORAN_COPY.neverLoggedIn }}</span
        >
      </li>
    </ul>
    <div v-if="!open && rest > 0">
      <UButton
        type="button"
        color="neutral"
        variant="link"
        size="sm"
        :label="moreCount(rest)"
        :data-testid="`${testId}-more`"
        @click="open = true"
      />
    </div>
  </DsStack>
</template>
