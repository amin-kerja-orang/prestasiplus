<script setup lang="ts">
/**
 * Mystery-box result dialog (FR-M15-52; URS FN-M15-6.2.3, PROPOSED content). Bottom sheet below
 * `sm`, centred modal from `sm`. "Tutup" and the scrim close it. The sticker stamps in and stays
 * still under reduced motion.
 */
import { DsArt3D, DsDialog, DsSticker } from '@/ds'

import type { MysteryBoxOpened } from '../api'
import { BOX_COPY } from './copy'

defineProps<{ result: MysteryBoxOpened | null }>()
const emit = defineEmits<{ close: [] }>()

function onOpen(value: boolean): void {
  if (!value) emit('close')
}
</script>

<template>
  <DsDialog
    :open="result !== null"
    :title="result?.boxName ?? BOX_COPY.heading"
    data-testid="box-result"
    @update:open="onOpen"
  >
    <div v-if="result" class="flex flex-col items-center gap-4 text-center">
      <DsArt3D name="party" size="hero" float data-testid="box-result-icon" />
      <p class="text-heading text-highlighted" data-testid="box-result-name">
        {{ result.boxName }}
      </p>
      <DsSticker art="coin">
        <span data-testid="box-result-reward">+{{ result.coins }} 🪙 · +{{ result.xp }} XP</span>
      </DsSticker>
    </div>
    <template #footer>
      <UButton size="xl" class="min-h-14" data-testid="box-result-close" @click="emit('close')">
        {{ BOX_COPY.close }}
      </UButton>
    </template>
  </DsDialog>
</template>
