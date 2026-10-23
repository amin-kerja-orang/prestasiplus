<script setup lang="ts">
/** S23 card "Analisis Risiko Mengikut Subjek" (design 4.1 item 5): name, "{w}/{m} lemah ({p}%)" and a progress bar. */
import { DsCluster, DsPanel, DsStack, DsText } from '@/ds'
import { formatCount } from '@/lib/number'

import type { AmaranSubjectRisk } from '../../api/amaran'

defineProps<{ rows: AmaranSubjectRisk[] }>()
</script>

<template>
  <DsPanel title="Analisis Risiko Mengikut Subjek" class="break-inside-avoid" data-testid="rk-subjects">
    <DsStack as="ul" gap="sm">
      <li v-for="r in rows" :key="r.subjectId" class="min-w-0" data-testid="rk-subject-row">
        <DsStack gap="xs">
          <DsCluster stack-below="sm" justify="between" gap="2xs">
            <DsText variant="label" tone="highlighted" wrap="anywhere" data-testid="rk-subject-name">{{
              r.subjectName
            }}</DsText>
            <DsText variant="body" tone="muted" tabular data-testid="rk-subject-weak"
              >{{ formatCount(r.weak) }}/{{ formatCount(r.total) }} lemah ({{ r.pct }}%)</DsText
            >
          </DsCluster>
          <UProgress
            :model-value="Math.min(100, Math.max(0, r.pct))"
            :max="100"
            size="sm"
            color="warning"
            :aria-label="`Pelajar lemah ${r.subjectName}`"
          />
        </DsStack>
      </li>
    </DsStack>
  </DsPanel>
</template>
