<script setup lang="ts">
/** "Soalan Terkini" (FR-M05-26): the latest questions with subject, star difficulty, age and level. */
import { diffForHumans } from '@/lib/time'

import type { DashboardRecentQuestion } from '../../api/types'
import { starStates } from '../dashboard/dashboard-lib'

defineProps<{ questions: DashboardRecentQuestion[] }>()
</script>

<template>
  <section
    class="flex min-w-0 flex-col gap-3"
    aria-labelledby="dash-recent-h"
    data-testid="dash-recent"
  >
    <h2 id="dash-recent-h" class="text-heading text-highlighted">⚡ Soalan Terkini</h2>
    <ul class="flex flex-col gap-2">
      <li v-for="q in questions" :key="q.id" data-testid="dash-recent-item">
        <UCard :ui="{ body: 'flex flex-col gap-2 p-4' }">
          <div class="flex items-center justify-between gap-2">
            <UBadge color="neutral" variant="subtle" data-testid="dash-recent-subject">{{
              q.subjectName
            }}</UBadge>
            <span
              class="flex"
              data-testid="dash-recent-stars"
              :aria-label="`Kesukaran ${q.difficulty} daripada 5`"
            >
              <span
                v-for="(on, i) in starStates(q.difficulty)"
                :key="i"
                :class="on ? 'text-warning' : 'text-dimmed'"
                :data-on="on ? 'true' : 'false'"
                aria-hidden="true"
                >★</span
              >
            </span>
          </div>
          <p class="text-label break-words text-default" data-testid="dash-recent-text">
            {{ q.text }}
          </p>
          <div class="flex items-center justify-between gap-2 text-caption text-muted">
            <span>{{ diffForHumans(q.createdAt) }}</span>
            <UBadge color="primary" variant="subtle" size="sm" data-testid="dash-recent-level">{{
              q.levelCode
            }}</UBadge>
          </div>
        </UCard>
      </li>
    </ul>
  </section>
</template>
