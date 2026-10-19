<script setup lang="ts">
/**
 * Page section (v2-ds-hardening 3.7): heading (h2/h3) + optional description + content, with the
 * `aria-labelledby` wiring automatic. Slots: default, `actions` (right of the header), `footer`.
 */
import { computed, useId } from 'vue'

import DsCluster from './DsCluster.vue'
import DsHeading from './DsHeading.vue'
import DsIconChip from './DsIconChip.vue'
import DsStack from './DsStack.vue'
import DsText from './DsText.vue'
import type { DsAccent, DsIconName, DsSpace } from './types'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    level?: 2 | 3
    variant?: 'heading' | 'subheading'
    icon?: DsIconName
    accent?: DsAccent
    gap?: DsSpace
    as?: 'section' | 'div'
    headingId?: string
  }>(),
  {
    description: undefined,
    level: 2,
    variant: 'heading',
    icon: undefined,
    accent: 'action',
    gap: 'md',
    as: 'section',
    headingId: undefined,
  },
)

const autoId = useId()
const id = computed(() => props.headingId ?? `ds-section-${autoId}`)
</script>

<template>
  <DsStack :as="as" :gap="gap" :aria-labelledby="as === 'section' ? id : undefined" data-ds="section">
    <DsCluster justify="between" gap="md" data-ds="section-header">
      <DsCluster gap="sm" class="min-w-0">
        <DsIconChip v-if="icon" :icon="icon" :accent="accent" size="sm" />
        <DsStack gap="2xs" class="min-w-0">
          <DsHeading :id="id" :level="level" :variant="variant">{{ title }}</DsHeading>
          <DsText v-if="description" variant="caption">{{ description }}</DsText>
        </DsStack>
      </DsCluster>
      <DsCluster v-if="$slots.actions" gap="sm">
        <slot name="actions" />
      </DsCluster>
    </DsCluster>
    <slot />
    <div v-if="$slots.footer" class="min-w-0" data-ds="section-footer"><slot name="footer" /></div>
  </DsStack>
</template>
