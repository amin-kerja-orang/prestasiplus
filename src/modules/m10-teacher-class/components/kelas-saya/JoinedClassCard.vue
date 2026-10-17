<script setup lang="ts">
/** One joined class (PROPOSED card, FN-M10-3.4.3): class name, subject, teacher, level. */
import { DsIconChip } from '@/ds'

import type { JoinedClass } from '../../api/types'

defineProps<{ item: JoinedClass }>()
</script>

<template>
  <li class="min-w-0" data-testid="joined-class">
    <UCard>
      <div class="flex min-w-0 items-start gap-3">
        <DsIconChip icon="i-ph-chalkboard-teacher-duotone" accent="action" size="lg" />
        <div class="flex min-w-0 flex-col gap-2">
          <h3 class="text-subheading break-words text-highlighted" data-testid="class-name">
            {{ item.name }}
          </h3>
          <ul class="flex flex-wrap gap-x-4 gap-y-1 text-label text-muted">
            <li
              v-if="item.subjectName"
              class="inline-flex items-center gap-2"
              data-testid="class-subject"
            >
              <UIcon name="i-ph-book-open-duotone" class="size-4 shrink-0" aria-hidden="true" />
              {{ item.subjectName }}
            </li>
            <li
              v-if="item.teacherName"
              class="inline-flex items-center gap-2"
              data-testid="class-teacher"
            >
              <UIcon name="i-ph-user-duotone" class="size-4 shrink-0" aria-hidden="true" />
              {{ item.teacherName }}
            </li>
            <li class="inline-flex items-center gap-2" data-testid="class-level">
              <UIcon
                name="i-ph-graduation-cap-duotone"
                class="size-4 shrink-0"
                aria-hidden="true"
              />
              {{ item.levelLabel }}
            </li>
          </ul>
        </div>
      </div>
    </UCard>
  </li>
</template>
