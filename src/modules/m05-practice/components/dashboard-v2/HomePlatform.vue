<script setup lang="ts">
/** "Statistik Platform" (FR-M05-25): four counted figures. */
import { DsStatTile, DsStack, DsGrid, DsHeading } from '@/ds'

import type { Dashboard } from '../../api/types'
import { COUNT_RULES } from '../dashboard/dashboard-lib'
import { useDisplayCount } from './useDisplayCount'

const props = defineProps<{ stats: Dashboard['stats'] }>()

const total = useDisplayCount(() => props.stats.totalQuestions, COUNT_RULES.totalQuestions)
const subjects = useDisplayCount(() => props.stats.activeSubjects, COUNT_RULES.activeSubjects)
const levels = useDisplayCount(() => props.stats.activeLevels, COUNT_RULES.activeLevels)
const approved = useDisplayCount(() => props.stats.approvedQuestions, COUNT_RULES.approvedQuestions)
</script>

<template>
  <DsStack as="section" gap="sm" aria-labelledby="dash-platform-h" data-testid="dash-platform">
    <DsHeading id="dash-platform-h" :level="2">📊 Statistik Platform</DsHeading>
    <DsGrid :cols="{ base: 2, md: 4 }" gap="sm" as="ul">
      <li class="min-w-0" data-testid="dash-platform-total">
        <DsStatTile :value="total" unit="Total Soalan" icon="books" />
      </li>
      <li class="min-w-0" data-testid="dash-platform-subjects">
        <DsStatTile :value="subjects" unit="Subjek Aktif" icon="book-open-text" accent="friend" />
      </li>
      <li class="min-w-0" data-testid="dash-platform-levels">
        <DsStatTile :value="levels" unit="Tahap Pendidikan" icon="graduation-cap" accent="heat" />
      </li>
      <li class="min-w-0" data-testid="dash-platform-approved">
        <DsStatTile :value="approved" unit="Soalan Approved" icon="check" accent="win" />
      </li>
    </DsGrid>
  </DsStack>
</template>
