<script setup lang="ts">
/**
 * Mystery-box result dialog (48 GAME-23 "Tahniah! Anda dapat {prize}."). Bottom sheet below `sm`, centred modal from
 * `sm`. "Tutup" and the scrim close it. The sticker stamps in and stays still under reduced motion.
 */
import { DsArt3D, DsDialog, DsSticker, DsStack, DsText } from '@/ds'

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
    @update:open="onOpen"
  >
    <DsStack v-if="result" align="center" data-testid="box-result">
      <DsArt3D name="party" size="hero" float data-testid="box-result-icon" />
      <DsText variant="heading" tone="highlighted" align="center" data-testid="box-result-name">{{
        BOX_COPY.won(result.prize.label)
      }}</DsText>
      <DsSticker :art="result.prize.kind === 'syiling' ? 'coin' : 'bolt'">
        <span data-testid="box-result-reward">{{
          result.prize.kind === 'syiling' ? `+${result.prize.amount} 🪙` : `+${result.prize.amount} token`
        }}</span>
      </DsSticker>
    </DsStack>
    <template #footer>
      <UButton size="xl" class="min-h-14" data-testid="box-result-close" @click="emit('close')">
        {{ BOX_COPY.close }}
      </UButton>
    </template>
  </DsDialog>
</template>
