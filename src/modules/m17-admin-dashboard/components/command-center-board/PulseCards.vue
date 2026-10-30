<script setup lang="ts">
/**
 * The six pulse cards of S3 (FR-M17-37..40, FN-M17-4.2.1-4.2.6): Sekolah Aktif, Login (label per tab,
 * DV-M17-10), Pelajar Aktif, Soalan Dijawab, Sesi Latihan, Engagement. "-" until the first response.
 */
import { computed } from 'vue'

import { DsGrid, DsGridItem, DsStatTile, formatCount } from '@/ds'

import {
  CC_LOGIN_LABEL,
  ccAccuracyLabel,
  ccAvgSessionLabel,
  type CcDailyActivity,
  type CcPeriod,
} from '../../api/command-center-board'
import { accentAt } from '../command-center/cc-format'
import { roleLabel, S3_COPY } from './board-copy'

const props = defineProps<{ data: CcDailyActivity | null; period: CcPeriod }>()

interface Card {
  id: string
  icon: string
  label: string
  value: string
  sub: string
}

/** The activity figures first (answers, pupils, schools), then sessions, logins and engagement. */
const ORDER = ['answers', 'pupils', 'schools', 'sessions', 'logins', 'engagement']

const all = computed<Card[]>(() => {
  const d = props.data
  const dash = S3_COPY.empty
  if (!d) {
    return [
      { id: 'schools', icon: 'buildings', label: 'Sekolah Aktif', value: dash, sub: '' },
      {
        id: 'logins',
        icon: 'sign-in',
        label: CC_LOGIN_LABEL[props.period],
        value: dash,
        sub: '',
      },
      { id: 'pupils', icon: 'student', label: 'Pelajar Aktif', value: dash, sub: '' },
      {
        id: 'answers',
        icon: 'clipboard-text',
        label: 'Soalan Dijawab',
        value: dash,
        sub: '',
      },
      { id: 'sessions', icon: 'clock', label: 'Sesi Latihan', value: dash, sub: '' },
      { id: 'engagement', icon: 'fire', label: 'Engagement', value: dash, sub: '' },
    ]
  }
  const e = d.engagement
  const total = e.moodCheckins + e.missionsCompleted + e.badgesEarned + e.quizSetsCreated
  const roles = Object.entries(d.logins.byRole)
  const roleSub = roles.map(([role, n]) => `${roleLabel(role)}: ${String(n)}`).join(' · ')
  return [
    {
      id: 'schools',
      icon: 'buildings',
      label: 'Sekolah Aktif',
      value: formatCount(d.summary.activeSchools),
      sub: `daripada ${formatCount(d.summary.totalSchools)}`,
    },
    {
      id: 'logins',
      icon: 'sign-in',
      label: CC_LOGIN_LABEL[props.period],
      value: formatCount(d.logins.total),
      sub: roleSub,
    },
    {
      id: 'pupils',
      icon: 'student',
      label: 'Pelajar Aktif',
      value: formatCount(d.summary.activeStudents),
      sub: `daripada ${formatCount(d.summary.totalStudents)}`,
    },
    {
      id: 'answers',
      icon: 'clipboard-text',
      label: 'Soalan Dijawab',
      value: formatCount(d.practice.totalAnswers),
      sub: ccAccuracyLabel(d.practice.accuracy),
    },
    {
      id: 'sessions',
      icon: 'clock',
      label: 'Sesi Latihan',
      value: `${formatCount(d.practice.sessionsCompleted)}/${formatCount(d.practice.sessionsStarted)}`,
      sub: ccAvgSessionLabel(d.practice.avgSessionSeconds),
    },
    {
      id: 'engagement',
      icon: 'fire',
      label: 'Engagement',
      value: formatCount(total),
      sub: `Mood:${String(e.moodCheckins)} Badge:${String(e.badgesEarned)} Misi:${String(e.missionsCompleted)}`,
    },
  ]
})
const cards = computed<Card[]>(() => ORDER.flatMap((id) => all.value.filter((c) => c.id === id)))
</script>

<template>
  <DsGrid :cols="{ base: 1, sm: 2, md: 3 }" gap="md" data-testid="cc-pulse" aria-live="off">
    <DsGridItem v-for="(c, ci) in cards" :key="c.id" :data-testid="`cc-pulse-${c.id}`">
      <DsStatTile
        :value="c.value"
        :unit="c.label"
        :sub="c.sub"
        :icon="c.icon"
        :accent="accentAt(ci)"
        part-prefix="cc-pulse"
      />
    </DsGridItem>
  </DsGrid>
</template>
