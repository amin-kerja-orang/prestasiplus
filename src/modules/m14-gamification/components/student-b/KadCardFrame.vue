<script setup lang="ts">
/**
 * S18 card frame (FN-M14-6.2.2–6.2.7): the card title, the card itself (the default slot, captured
 * for "Muat Turun") and the two buttons "Muat Turun" and "WhatsApp" (or "Kongsi" on the mastery
 * cards). The frame only emits; the page owns the `downloading` guard.
 */
import { ref } from 'vue'

import { KAD_COPY } from '../../lib/student/kadkongsi-lib'
import BrandWhatsAppIcon from './BrandWhatsAppIcon.vue'
import { DsCluster, DsStack } from '@/ds'

type FrameColor = 'primary' | 'secondary' | 'warning' | 'success' | 'info'

withDefaults(
  defineProps<{
    title?: string
    /** Colour of the "Muat Turun" button (per card). */
    downloadColor?: FrameColor
    shareLabel?: string
    /** Smaller buttons inside the mastery grid. */
    compact?: boolean
    testKey: string
  }>(),
  { title: '', downloadColor: 'primary', shareLabel: KAD_COPY.whatsapp, compact: false },
)
const emit = defineEmits<{ download: [el: HTMLElement | null]; share: [] }>()

const cardEl = ref<HTMLElement | null>(null)
</script>

<template>
  <DsStack align="center" :data-testid="`kad-${testKey}`">
    <h3
      v-if="title"
      class="w-full font-display text-subheading font-bold text-highlighted"
      :data-testid="`kad-${testKey}-title`"
    >
      {{ title }}
    </h3>
    <div ref="cardEl" class="w-full max-w-85" :data-testid="`kad-${testKey}-card`">
      <slot />
    </div>
    <DsCluster align="stretch" justify="center">
      <UButton
        type="button"
        :size="compact ? 'lg' : 'xl'"
        :color="downloadColor"
        icon="i-ph-download-simple-duotone"
        :data-testid="`kad-${testKey}-download`"
        @click="emit('download', cardEl)"
      >
        {{ KAD_COPY.download }}
      </UButton>
      <UButton
        type="button"
        :size="compact ? 'lg' : 'xl'"
        color="success"
        :data-testid="`kad-${testKey}-share`"
        @click="emit('share')"
      >
        <BrandWhatsAppIcon class="size-4" />
        {{ shareLabel }}
      </UButton>
    </DsCluster>
  </DsStack>
</template>
