<script setup lang="ts">
/**
 * The ALESA card of S8 (FN-M12-9.2.1 ... 9.2.3; FR-M12-79 ... 81): "AI" badge, the composed paragraph, four tiles (2 x 2 below
 * `sm`) and the "Terkuat: … · Perlu perhatian: …" line (empty for a student without answers).
 */
import { computed } from 'vue'

import type { StudentKirkpatrick } from '../../../api/types'
import { count, mean, pct, pct1 } from '../common/kirkpatrick-format'
import { alesaParagraph } from './pelajar-format'
import { DsCluster, DsHeading, DsText } from '@/ds'

const props = defineProps<{ data: StudentKirkpatrick }>()

const paragraph = computed(() => alesaParagraph(props.data))
</script>

<template>
  <UCard as="section" class="min-w-0" data-testid="pel-alesa">
    <template #header>
      <DsCluster :wrap="false">
        <UBadge color="primary" variant="soft" label="AI" />
        <DsHeading :level="2" variant="subheading"
          >ALESA — Analisis Tingkah Laku Kirkpatrick</DsHeading
        >
      </DsCluster>
    </template>
    <DsText variant="body" data-testid="pel-paragraph">{{ paragraph }}</DsText>
    <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <UCard variant="soft" class="min-w-0 text-center" data-testid="pel-tile-answers">
        <DsText variant="heading" tabular>{{ count(data.answers) }}</DsText>
        <DsText variant="caption">Soalan</DsText>
      </UCard>
      <UCard variant="soft" class="min-w-0 text-center" data-testid="pel-tile-accuracy">
        <DsText variant="heading" tabular>{{ pct(data.accuracy) }}</DsText>
        <DsText variant="caption">Ketepatan</DsText>
      </UCard>
      <UCard variant="soft" class="min-w-0 text-center" data-testid="pel-tile-konsistensi">
        <DsText variant="heading" tabular>{{ mean(data.konsistensi) }}</DsText>
        <DsText variant="caption">Konsistensi</DsText>
      </UCard>
      <UCard variant="soft" class="min-w-0 text-center" data-testid="pel-tile-streak">
        <DsText variant="heading" tabular>{{ data.streak }}d</DsText>
        <DsText variant="caption">Streak</DsText>
      </UCard>
    </div>
    <p
      v-if="data.strongest && data.weakest"
      class="mt-3 text-caption text-muted"
      data-testid="pel-strength"
    >
      Terkuat:
      <strong>{{ data.strongest.subjectName }} ({{ pct1(data.strongest.accuracy) }})</strong>
      · Perlu perhatian:
      <strong>{{ data.weakest.subjectName }} ({{ pct1(data.weakest.accuracy) }})</strong>
    </p>
  </UCard>
</template>
