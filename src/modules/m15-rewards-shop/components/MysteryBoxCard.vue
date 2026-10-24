<script setup lang="ts">
/**
 * One mystery-box card and its form (FR-M15-48..50; URS FN-M15-6.1.2..6.1.5). The submit is
 * disabled with "🔒 Token Tidak Cukup" when the balance is below the cost (BR-M15-17); otherwise it
 * reads "Buka Kotak" (PROPOSED). The art bobs gently and stays still under reduced motion.
 */
import { computed } from 'vue'

import { DsArt3D, DsRewardChip } from '@/ds'
import type { Art3DName } from '@/ds'

import type { MysteryBoxView } from '../api'
import { BOX_COPY } from './copy'

const props = defineProps<{ box: MysteryBoxView; tokenBalance: number; busy: boolean }>()
const emit = defineEmits<{ open: [boxId: number] }>()

const affordable = computed(() => props.tokenBalance >= props.box.costTokens)

function submit(): void {
  if (affordable.value) emit('open', props.box.id)
}

const art = computed<Art3DName>(() =>
  props.box.rarity === 'legendary' ? 'trophy' : props.box.rarity === 'rare' ? 'rocket' : 'party',
)
const ribbonColor = computed(() =>
  props.box.rarity === 'legendary' ? 'warning' : props.box.rarity === 'rare' ? 'info' : 'primary',
)

/** BM word of the API rarity (FB-025). */
const RARITY_LABEL = { rare: 'Jarang', epic: 'Epik', legendary: 'Legenda' } as const
</script>

<template>
  <UCard class="h-full">
    <form
      class="flex h-full flex-col items-center gap-3 text-center"
      :data-testid="`box-${String(box.id)}`"
      @submit.prevent="submit"
    >
      <div class="flex w-full items-start justify-end">
        <UBadge
          v-if="box.rarity"
          :color="ribbonColor"
          variant="solid"
          :data-testid="`box-${String(box.id)}-ribbon`"
          >{{ RARITY_LABEL[box.rarity] }}</UBadge
        >
      </div>
      <DsArt3D :name="art" size="hero" float />
      <h3 class="text-heading text-highlighted">{{ box.name }}</h3>
      <p class="text-body text-muted">{{ box.description }}</p>
      <p class="text-caption text-muted">
        <span class="tabular text-title text-highlighted">{{ box.costTokens }}</span>
        {{ BOX_COPY.token }}
      </p>
      <p class="flex flex-wrap items-center justify-center gap-2">
        <DsRewardChip :value="`${box.coinMin}-${box.coinMax}`" art="coin" />
        <DsRewardChip :value="`${box.xpMin}-${box.xpMax} XP`" art="bolt" />
      </p>
      <UButton
        v-if="affordable"
        type="submit"
        size="xl"
        block
        class="mt-auto min-h-14"
        :disabled="busy"
        :data-testid="`box-${String(box.id)}-btn`"
      >
        {{ BOX_COPY.open }}
      </UButton>
      <UButton
        v-else
        type="submit"
        size="xl"
        block
        color="neutral"
        variant="soft"
        disabled
        class="mt-auto min-h-14"
        :data-testid="`box-${String(box.id)}-btn`"
      >
        {{ BOX_COPY.locked }}
      </UButton>
    </form>
  </UCard>
</template>
