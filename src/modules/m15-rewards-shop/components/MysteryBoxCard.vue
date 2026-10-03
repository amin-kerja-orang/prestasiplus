<script setup lang="ts">
/**
 * One mystery-box card and its form (FR-M15-48..50; URS FN-M15-6.1.2..6.1.5). The whole card keeps
 * `cursor-pointer` and lifts on hover, and the icon shakes, also when the button is disabled (live,
 * DV-M15-11 replicate). The submit is disabled with "🔒 Token Tidak Cukup" when the balance is below
 * the cost (BR-M15-17); otherwise it reads "Buka Kotak" on the box gradient (PROPOSED).
 */
import { computed } from 'vue'

import type { MysteryBoxView } from '../api'
import { BOX_COPY } from './copy'

const props = defineProps<{ box: MysteryBoxView; tokenBalance: number; busy: boolean }>()
const emit = defineEmits<{ open: [boxId: number] }>()

const affordable = computed(() => props.tokenBalance >= props.box.costTokens)

function submit(): void {
  if (affordable.value) emit('open', props.box.id)
}
const gradient = computed(() => ({
  backgroundImage: `linear-gradient(135deg, ${props.box.color1}, ${props.box.color2})`,
}))
const ribbonStyle = computed(() =>
  props.box.rarity === 'legendary'
    ? { backgroundImage: 'linear-gradient(135deg, #f59e0b, #ef4444)' }
    : props.box.rarity === 'rare'
      ? { backgroundColor: '#3b82f6' }
      : { backgroundColor: '#8b5cf6' },
)
</script>

<template>
  <form
    class="box-card relative flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-md transition hover:-translate-y-1 hover:shadow-xl"
    :data-testid="`box-${String(box.id)}`"
    @submit.prevent="submit"
  >
    <div
      class="relative flex flex-col items-center justify-center overflow-hidden px-4 py-6 text-center"
      :style="gradient"
    >
      <span
        v-if="box.rarity"
        class="absolute top-4 -right-9 w-32 rotate-45 py-0.5 text-center text-xs font-bold tracking-wide text-white uppercase"
        :style="ribbonStyle"
        :data-testid="`box-${String(box.id)}-ribbon`"
        >{{ box.rarity }}</span
      >
      <span class="box-icon text-5xl leading-none">{{ box.icon }}</span>
      <h3 class="mt-3 text-base font-bold text-white">{{ box.name }}</h3>
    </div>
    <div class="flex flex-1 flex-col items-center gap-2 px-4 py-4 text-center">
      <p class="text-sm text-gray-600">{{ box.description }}</p>
      <p class="text-2xl font-bold text-violet-600">
        {{ box.costTokens }}
        <span class="text-xs font-normal text-gray-500">{{ BOX_COPY.token }}</span>
      </p>
      <p class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-600">
        <span
          >🪙 <strong class="text-gray-800">{{ box.coinMin }}-{{ box.coinMax }}</strong></span
        >
        <span
          >⭐ <strong class="text-gray-800">{{ box.xpMin }}-{{ box.xpMax }}</strong> XP</span
        >
      </p>
    </div>
    <button
      v-if="affordable"
      type="submit"
      class="min-h-11 w-full cursor-pointer px-4 py-3 text-sm font-bold text-white disabled:opacity-70"
      :style="gradient"
      :disabled="busy"
      :data-testid="`box-${String(box.id)}-btn`"
    >
      {{ BOX_COPY.open }}
    </button>
    <button
      v-else
      type="submit"
      disabled
      class="min-h-11 w-full cursor-not-allowed bg-[#d1d5db] px-4 py-3 text-sm font-bold text-[#4b5563]"
      :data-testid="`box-${String(box.id)}-btn`"
    >
      {{ BOX_COPY.locked }}
    </button>
  </form>
</template>

<style scoped>
.box-card:hover .box-icon {
  animation: boxShake 0.5s;
}
@keyframes boxShake {
  0%,
  100% {
    transform: rotate(0deg);
  }
  20% {
    transform: rotate(-12deg);
  }
  40% {
    transform: rotate(12deg);
  }
  60% {
    transform: rotate(-8deg);
  }
  80% {
    transform: rotate(8deg);
  }
}
</style>
