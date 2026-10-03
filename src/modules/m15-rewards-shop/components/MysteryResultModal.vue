<script setup lang="ts">
/**
 * Mystery-box result modal (FR-M15-52; URS FN-M15-6.2.3, PROPOSED content). Full-screen below
 * `md` (NFR-RESP-07), 400px centred from `md`, overlay rgba(0,0,0,0.7). "Tutup" and the overlay
 * close it.
 */
import { BaseModal } from '@/components/overlay'

import type { MysteryBoxOpened } from '../api'
import { BOX_COPY } from './copy'

defineProps<{ result: MysteryBoxOpened | null }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <BaseModal
    :open="result !== null"
    container-class="fixed inset-0 z-50 flex items-stretch justify-center md:items-center md:p-4"
    backdrop-class="absolute inset-0 bg-black/70"
    panel-class="relative flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-white p-6 text-center md:h-auto md:max-w-[400px] md:rounded-3xl md:p-8"
    data-testid="box-result"
    @update:open="$emit('close')"
  >
    <template #default="{ close }">
      <template v-if="result">
        <div class="text-6xl leading-none" data-testid="box-result-icon">{{ result.icon }}</div>
        <h2
          class="mt-4 font-heading text-xl font-bold text-slate-800"
          data-testid="box-result-name"
        >
          {{ result.boxName }}
        </h2>
        <p class="mt-3 text-xl font-bold text-[#7c3aed]" data-testid="box-result-reward">
          +{{ result.coins }} 🪙 · +{{ result.xp }} XP
        </p>
        <button
          type="button"
          class="mt-6 inline-flex min-h-11 w-full max-w-xs items-center justify-center rounded-xl bg-[#7c3aed] px-6 text-sm font-semibold text-white hover:bg-violet-700"
          data-testid="box-result-close"
          @click="close()"
        >
          {{ BOX_COPY.close }}
        </button>
      </template>
    </template>
  </BaseModal>
</template>
