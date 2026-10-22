<script setup lang="ts">
/** S21 card "Intervensi Mengikut Jenis": one row per type in the order returned (copy row 35). */
import { DsCluster, DsPanel, DsStack, DsSurface, DsText } from '@/ds'

import type { AmaranEffectivenessReportView } from '../../api/amaran'
import { count } from './kb-format'

defineProps<{ rows: AmaranEffectivenessReportView['byType'] }>()
</script>

<template>
  <DsPanel title="Intervensi Mengikut Jenis" data-testid="kb-types">
    <DsStack as="ul" gap="xs">
      <DsSurface
        v-for="r in rows"
        :key="r.type"
        as="li"
        level="soft"
        padding="sm"
        class="min-h-11"
        data-testid="kb-type-row"
      >
        <DsCluster justify="between" gap="sm" :wrap="false">
          <DsText variant="body" tone="highlighted" wrap="anywhere">{{ r.label }}</DsText>
          <DsText variant="body" tone="muted" tabular class="shrink-0">{{ count(r.count) }} kali</DsText>
        </DsCluster>
      </DsSurface>
    </DsStack>
  </DsPanel>
</template>
