<script setup lang="ts">
/** S3 static Learning Gain card (FN-M12-4.2.1; FR-M12-36): permanent, there are no pre/post tests. */
import { DsEmptyState } from '@/ds'
</script>

<template>
  <UCard class="min-w-0" data-testid="kirk-gain-card">
    <DsEmptyState
      icon="i-ph-flask"
      title="Pre-Test / Post-Test belum dimulakan"
      description="Apabila ujian diagnostik dimulakan, Hake's Normalized Learning Gain akan dikira secara automatik."
    />
    <p class="text-center text-caption text-muted">
      g = (Post - Pre) / (100 - Pre) · High: g≥0.7 · Medium: 0.3≤g&lt;0.7 · Low: g&lt;0.3
    </p>
  </UCard>
</template>
