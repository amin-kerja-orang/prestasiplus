<script setup lang="ts">
/** "Pakej SPM Aktif" card (FR-MUR-2-4): the active package, shown instead of the trial card. */
import { DsBadge, DsCharacterCard, DsCluster, DsText } from '@/ds'

import { formatValidUntil } from '../dashboard/dashboard-lib'

defineProps<{ name: string; validUntil: string }>()
</script>

<template>
  <DsCharacterCard accent="action" icon="star" title="Pakej SPM Aktif" data-testid="dash-pakej">
    <DsCluster gap="sm">
      <DsText variant="subheading" as="span" data-testid="dash-pakej-name">{{ name }}</DsText>
      <DsBadge tone="success" label="Aktif" size="sm" data-testid="dash-pakej-badge" />
    </DsCluster>
    <DsText variant="caption" tone="muted" data-testid="dash-pakej-valid">
      Sah sehingga {{ formatValidUntil(validUntil) }}
    </DsText>
  </DsCharacterCard>
</template>
