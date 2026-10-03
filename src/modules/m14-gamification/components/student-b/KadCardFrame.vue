<script setup lang="ts">
/**
 * S18 card frame (FN-M14-6.2.2–6.2.7): the card title, the card itself (the default slot, captured
 * for "Muat Turun") and the two buttons "Muat Turun" and "WhatsApp" (or "Kongsi" on the mastery
 * cards). The frame only emits; the page owns the `downloading` guard.
 */
import { Download } from '@lucide/vue'
import { ref } from 'vue'

import { KAD_COPY } from '../../lib/student/kadkongsi-lib'
import BrandWhatsAppIcon from './BrandWhatsAppIcon.vue'

withDefaults(
  defineProps<{
    title?: string
    /** Classes of the "Muat Turun" button (colour per card). */
    downloadClass: string
    shareLabel?: string
    /** Smaller buttons inside the mastery grid. */
    compact?: boolean
    testKey: string
  }>(),
  { title: '', shareLabel: KAD_COPY.whatsapp, compact: false },
)
const emit = defineEmits<{ download: [el: HTMLElement | null]; share: [] }>()

const cardEl = ref<HTMLElement | null>(null)
</script>

<template>
  <div class="flex min-w-0 flex-col items-center" :data-testid="`kad-${testKey}`">
    <h3
      v-if="title"
      class="mb-4 w-full text-base font-bold text-slate-800"
      :data-testid="`kad-${testKey}-title`"
    >
      {{ title }}
    </h3>
    <div ref="cardEl" class="w-full max-w-85" :data-testid="`kad-${testKey}-card`">
      <slot />
    </div>
    <div class="mt-4 flex flex-wrap justify-center gap-3">
      <button
        type="button"
        :class="[
          'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-bold text-white shadow-sm',
          compact ? 'px-4 py-2 text-xs' : 'px-5 py-2.5 text-sm',
          downloadClass,
        ]"
        :data-testid="`kad-${testKey}-download`"
        @click="emit('download', cardEl)"
      >
        <Download class="h-4 w-4" aria-hidden="true" />
        {{ KAD_COPY.download }}
      </button>
      <button
        type="button"
        :class="[
          'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-600 font-bold text-white shadow-sm',
          compact ? 'px-4 py-2 text-xs' : 'px-5 py-2.5 text-sm',
        ]"
        :data-testid="`kad-${testKey}-share`"
        @click="emit('share')"
      >
        <BrandWhatsAppIcon class="h-4 w-4" />
        {{ shareLabel }}
      </button>
    </div>
  </div>
</template>
