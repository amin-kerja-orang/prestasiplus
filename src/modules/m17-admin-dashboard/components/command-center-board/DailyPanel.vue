<script setup lang="ts">
/**
 * A card of S3: the DS panel with the icon chip and the heading. While the period loads the body shows the
 * spinner and a failed load shows "Gagal memuatkan" (FR-M17-36); the default slot renders when `state` is `ok`.
 */
import { DsPanel, DsText } from '@/ds'

import { accentFor } from '../command-center/cc-format'
import { S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'

withDefaults(
  defineProps<{
    title: string
    icon: string
    testid: string
    state?: LoadStatus
    heading?: string
    stretch?: boolean
  }>(),
  { state: 'ok', heading: undefined, stretch: true },
)
</script>

<template>
  <DsPanel
    as="section"
    :title="heading ?? title"
    :icon="icon"
    :accent="accentFor(icon)"
    :stretch="stretch"
    :data-testid="testid"
  >
    <p
      v-if="state === 'loading'"
      class="flex justify-center py-4 text-muted"
      data-testid="daily-loading"
    >
      <UProgress class="w-24" aria-label="Memuatkan" />
    </p>
    <DsText
      v-else-if="state === 'error'"
      variant="body"
      tone="error"
      align="center"
      data-testid="daily-error"
    >
      {{ S3_COPY.loadFailed }}
    </DsText>
    <slot v-else />
  </DsPanel>
</template>
