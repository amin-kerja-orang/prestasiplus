<script setup lang="ts">
/** "Pakej SPM Aktif" card (FR-MUR-2-4): the active package, shown instead of the trial card. */
import { DsCharacterCard } from '@/ds'

import { formatValidUntil } from '../dashboard/dashboard-lib'

defineProps<{ name: string; validUntil: string }>()
</script>

<template>
  <DsCharacterCard accent="action" icon="star" title="Pakej SPM Aktif" data-testid="dash-pakej">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-subheading text-highlighted" data-testid="dash-pakej-name">{{ name }}</span>
      <UBadge color="success" variant="subtle" size="sm" data-testid="dash-pakej-badge">Aktif</UBadge>
    </div>
    <p class="text-caption text-muted" data-testid="dash-pakej-valid">
      Sah sehingga {{ formatValidUntil(validUntil) }}
    </p>
  </DsCharacterCard>
</template>
