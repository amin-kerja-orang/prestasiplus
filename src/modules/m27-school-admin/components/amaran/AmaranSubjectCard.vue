<script setup lang="ts">
/**
 * S4 card "Analisis Risiko Mengikut Subjek" (FR-M27-77; restyle spec AS-49): one row per subject with the
 * name, the text "{weak}/{total} pelajar lemah ({pct}%)" and a `UProgress` of the weak share.
 */

import { DsPanel, DsHeading, DsText } from '@/ds'
import { formatCount } from '@/lib/number'

import type { SubjectRiskRow } from '../../api/amaran'

defineProps<{ rows: SubjectRiskRow[] }>()
</script>

<template>
  <DsPanel data-testid="am-subjects">
    <DsHeading :level="2" variant="subheading">Analisis Risiko Mengikut Subjek</DsHeading>
    <ul class="mt-3 flex flex-col gap-3">
      <li
        v-for="r in rows"
        :key="r.subjectId"
        class="flex min-w-0 flex-col gap-2"
        data-testid="am-subject-row"
      >
        <div class="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <DsText
            variant="label"
            tone="highlighted"
            wrap="anywhere"
            class="min-w-0"
            data-testid="am-subject-name"
            >{{ r.subjectName }}</DsText
          >
          <DsText variant="body" as="span" tone="muted" tabular data-testid="am-subject-weak"
            >{{ formatCount(r.weak) }}/{{ formatCount(r.total) }} pelajar lemah ({{
              r.pct
            }}%)</DsText
          >
        </div>
        <UProgress
          :model-value="Math.min(100, Math.max(0, r.pct))"
          :max="100"
          size="sm"
          color="warning"
          :aria-label="`Pelajar lemah ${r.subjectName}`"
        />
      </li>
    </ul>
  </DsPanel>
</template>
