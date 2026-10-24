<script setup lang="ts">
/**
 * The six pulse cards of S3 (FR-M17-37..40, FN-M17-4.2.1-4.2.6): Sekolah Aktif, Login (label per tab,
 * DV-M17-10), Pelajar Aktif, Soalan Dijawab, Sesi Latihan, Engagement. "-" until the first response.
 */
import { computed } from 'vue'

import { DsIconChip } from '@/ds'
import { formatCount } from '@/lib/number'

import {
  CC_LOGIN_LABEL,
  ccAccuracyLabel,
  ccAvgSessionLabel,
  type CcDailyActivity,
  type CcPeriod,
} from '../../api/command-center-board'
import { accentAt } from '../command-center/cc-format'
import { S3_COPY } from './board-copy'

const props = defineProps<{ data: CcDailyActivity | null; period: CcPeriod }>()

interface Card {
  id: string
  icon: string
  label: string
  value: string
  /** Sub-line pieces; `bold` pieces are the highlighted figures. */
  sub: { text: string; bold?: boolean }[]
}

const cards = computed<Card[]>(() => {
  const d = props.data
  const dash = S3_COPY.empty
  if (!d) {
    return [
      { id: 'schools', icon: 'i-ph-buildings', label: 'Sekolah Aktif', value: dash, sub: [] },
      {
        id: 'logins',
        icon: 'i-ph-sign-in',
        label: CC_LOGIN_LABEL[props.period],
        value: dash,
        sub: [],
      },
      { id: 'pupils', icon: 'i-ph-student', label: 'Pelajar Aktif', value: dash, sub: [] },
      {
        id: 'answers',
        icon: 'i-ph-clipboard-text',
        label: 'Soalan Dijawab',
        value: dash,
        sub: [],
      },
      { id: 'sessions', icon: 'i-ph-clock', label: 'Sesi Latihan', value: dash, sub: [] },
      { id: 'engagement', icon: 'i-ph-fire', label: 'Penglibatan', value: dash, sub: [] },
    ]
  }
  const acc = ccAccuracyLabel(d.practice.accuracy).split(': ')
  const e = d.engagement
  const total = e.moodCheckins + e.missionsCompleted + e.badgesEarned + e.quizSetsCreated
  const roles = Object.entries(d.logins.byRole)
  const roleSub = roles.flatMap(([role, n], i) => [
    { text: `${i > 0 ? ' · ' : ''}${role}: ` },
    { text: String(n), bold: true },
  ])
  return [
    {
      id: 'schools',
      icon: 'i-ph-buildings',
      label: 'Sekolah Aktif',
      value: formatCount(d.summary.activeSchools),
      sub: [{ text: `daripada ${formatCount(d.summary.totalSchools)}` }],
    },
    {
      id: 'logins',
      icon: 'i-ph-sign-in',
      label: CC_LOGIN_LABEL[props.period],
      value: formatCount(d.logins.total),
      sub: roleSub,
    },
    {
      id: 'pupils',
      icon: 'i-ph-student',
      label: 'Pelajar Aktif',
      value: formatCount(d.summary.activeStudents),
      sub: [{ text: `daripada ${formatCount(d.summary.totalStudents)}` }],
    },
    {
      id: 'answers',
      icon: 'i-ph-clipboard-text',
      label: 'Soalan Dijawab',
      value: formatCount(d.practice.totalAnswers),
      sub: [{ text: `${acc[0] ?? ''}: ` }, { text: acc[1] ?? '', bold: true }],
    },
    {
      id: 'sessions',
      icon: 'i-ph-clock',
      label: 'Sesi Latihan',
      value: `${formatCount(d.practice.sessionsCompleted)}/${formatCount(d.practice.sessionsStarted)}`,
      sub: [{ text: ccAvgSessionLabel(d.practice.avgSessionSeconds) }],
    },
    {
      id: 'engagement',
      icon: 'i-ph-fire',
      label: 'Penglibatan',
      value: formatCount(total),
      sub: [
        {
          text: `Mood:${String(e.moodCheckins)} Badge:${String(e.badgesEarned)} Misi:${String(e.missionsCompleted)}`,
        },
      ],
    },
  ]
})
</script>

<template>
  <div
    class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
    data-testid="cc-pulse"
    aria-live="off"
  >
    <UCard v-for="(c, ci) in cards" :key="c.id" class="min-w-0" :data-testid="`cc-pulse-${c.id}`">
      <div class="flex min-w-0 flex-col items-start gap-1">
        <span class="flex w-full min-w-0 items-center gap-2">
          <DsIconChip :icon="c.icon" :accent="accentAt(ci)" size="sm" />
          <span class="min-w-0 text-overline text-muted" data-testid="cc-pulse-label">{{
            c.label
          }}</span>
        </span>
        <span
          class="tabular text-title break-words text-highlighted"
          data-testid="cc-pulse-value"
          >{{ c.value }}</span
        >
        <span class="text-caption text-muted" data-testid="cc-pulse-sub">
          <template v-for="(s, i) in c.sub" :key="i"
            ><b v-if="s.bold" class="text-highlighted">{{ s.text }}</b
            ><template v-else>{{ s.text }}</template></template
          >
        </span>
      </div>
    </UCard>
  </div>
</template>
