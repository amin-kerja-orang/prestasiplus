<script setup lang="ts">
/** "Tahap 2 — Head Count" (FN-M12-9.3.1; FR-M12-82; BR-M12-30): "{tahun} — Head Count" and one row per subject, "TOV:{x}" or "-". */
import { DsPanel, DsStack, DsText } from '@/ds'

import type { StudentKirkpatrick } from '../../../api/types'
import { gps } from '../common/kirkpatrick-format'

defineProps<{ headcount: StudentKirkpatrick['headcount'] }>()
</script>

<template>
  <DsPanel title="Tahap 2 — Head Count" icon="i-ph-users-three" data-testid="pel-headcount">
    <p class="mb-2 text-label text-highlighted" data-testid="pel-hc-heading">
      {{ headcount.year }} — Head Count
    </p>
    <DsStack as="ul" gap="none">
      <li
        v-for="r in headcount.rows"
        :key="r.subjectName"
        class="flex items-baseline justify-between gap-3 py-2 even:bg-soft"
        data-testid="pel-hc-row"
      >
        <DsText variant="label" tone="muted" class="min-w-0">{{ r.subjectName }}</DsText>
        <DsText
          variant="label"
          tone="highlighted"
          tabular
          class="shrink-0"
          data-testid="pel-hc-value"
          >{{ r.tov === null ? '-' : `TOV:${gps(r.tov)}` }}</DsText
        >
      </li>
    </DsStack>
  </DsPanel>
</template>
