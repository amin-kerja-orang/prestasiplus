<script setup lang="ts">
/**
 * The six pulse cards of S3 (FR-M17-37..40, FN-M17-4.2.1-4.2.6): Sekolah Aktif, Login (label per tab,
 * DV-M17-10), Pelajar Aktif, Soalan Dijawab, Sesi Latihan, Engagement. "-" until the first response.
 */
import { computed } from 'vue'

import { formatCount } from '@/lib/number'

import {
  CC_LOGIN_LABEL,
  ccAccuracyLabel,
  ccAvgSessionLabel,
  type CcDailyActivity,
  type CcPeriod,
} from '../../api/command-center-board'
import type { BoardAccent } from './board-copy'
import { ACCENT_EDGE, ACCENT_TEXT, S3_COPY } from './board-copy'

const props = defineProps<{ data: CcDailyActivity | null; period: CcPeriod }>()

interface Card {
  id: string
  icon: string
  label: string
  value: string
  /** Sub-line pieces; `bold` pieces are the highlighted figures. */
  sub: { text: string; bold?: boolean }[]
  accent: BoardAccent
}

const cards = computed<Card[]>(() => {
  const d = props.data
  const dash = S3_COPY.empty
  if (!d) {
    return [
      {
        id: 'schools',
        icon: '🏫',
        label: 'Sekolah Aktif',
        value: dash,
        sub: [],
        accent: 'emerald',
      },
      {
        id: 'logins',
        icon: '👤',
        label: CC_LOGIN_LABEL[props.period],
        value: dash,
        sub: [],
        accent: 'cyan',
      },
      { id: 'pupils', icon: '🎓', label: 'Pelajar Aktif', value: dash, sub: [], accent: 'amber' },
      {
        id: 'answers',
        icon: '📝',
        label: 'Soalan Dijawab',
        value: dash,
        sub: [],
        accent: 'indigo',
      },
      { id: 'sessions', icon: '🕐', label: 'Sesi Latihan', value: dash, sub: [], accent: 'violet' },
      { id: 'engagement', icon: '🔥', label: 'Engagement', value: dash, sub: [], accent: 'rose' },
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
      icon: '🏫',
      label: 'Sekolah Aktif',
      value: formatCount(d.summary.activeSchools),
      sub: [{ text: `daripada ${formatCount(d.summary.totalSchools)}` }],
      accent: 'emerald',
    },
    {
      id: 'logins',
      icon: '👤',
      label: CC_LOGIN_LABEL[props.period],
      value: formatCount(d.logins.total),
      sub: roleSub,
      accent: 'cyan',
    },
    {
      id: 'pupils',
      icon: '🎓',
      label: 'Pelajar Aktif',
      value: formatCount(d.summary.activeStudents),
      sub: [{ text: `daripada ${formatCount(d.summary.totalStudents)}` }],
      accent: 'amber',
    },
    {
      id: 'answers',
      icon: '📝',
      label: 'Soalan Dijawab',
      value: formatCount(d.practice.totalAnswers),
      sub: [{ text: `${acc[0] ?? ''}: ` }, { text: acc[1] ?? '', bold: true }],
      accent: 'indigo',
    },
    {
      id: 'sessions',
      icon: '🕐',
      label: 'Sesi Latihan',
      value: `${formatCount(d.practice.sessionsCompleted)}/${formatCount(d.practice.sessionsStarted)}`,
      sub: [{ text: ccAvgSessionLabel(d.practice.avgSessionSeconds) }],
      accent: 'violet',
    },
    {
      id: 'engagement',
      icon: '🔥',
      label: 'Engagement',
      value: formatCount(total),
      sub: [
        {
          text: `Mood:${String(e.moodCheckins)} Badge:${String(e.badgesEarned)} Misi:${String(e.missionsCompleted)}`,
        },
      ],
      accent: 'rose',
    },
  ]
})
</script>

<template>
  <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="cc-pulse">
    <div
      v-for="c in cards"
      :key="c.id"
      :class="[
        'relative min-w-0 rounded-2xl border border-t-2 border-slate-800 bg-slate-900 p-3',
        ACCENT_EDGE[c.accent],
      ]"
      :data-testid="`cc-pulse-${c.id}`"
    >
      <span class="absolute top-3 right-3 text-2xl opacity-25">{{ c.icon }}</span>
      <div
        class="pr-8 text-xs font-semibold tracking-wider text-slate-400 uppercase"
        data-testid="cc-pulse-label"
      >
        {{ c.label }}
      </div>
      <div
        :class="['mt-1 font-mono text-3xl font-bold break-words', ACCENT_TEXT[c.accent]]"
        data-testid="cc-pulse-value"
      >
        {{ c.value }}
      </div>
      <div class="mt-1 text-sm text-slate-400" data-testid="cc-pulse-sub">
        <template v-for="(s, i) in c.sub" :key="i"
          ><b v-if="s.bold" class="text-slate-100">{{ s.text }}</b
          ><template v-else>{{ s.text }}</template></template
        >
      </div>
    </div>
  </div>
</template>
