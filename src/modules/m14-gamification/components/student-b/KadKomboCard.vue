<script setup lang="ts">
/** S18 "Kad Kombo" card (FN-M14-6.2.3): streak from the single M14 store (DV-M14-08). */
import type { ShareCards } from '../../api'
import { KAD_COPY } from '../../lib/student/kadkongsi-lib'

defineProps<{ data: ShareCards }>()
</script>

<template>
  <div class="rounded-2xl bg-linear-to-br from-orange-500 to-red-600 p-6 text-center text-white">
    <div class="text-5xl">🔥</div>
    <div class="text-5xl font-bold" data-testid="kad-kombo-current">{{ data.kombo.current }}</div>
    <div class="text-sm">{{ KAD_COPY.hariBerturut }}</div>
    <div class="mt-4 flex justify-center gap-3">
      <div class="min-w-0 flex-1 rounded-xl bg-white/20 px-2 py-2">
        <div class="text-xl font-bold" data-testid="kad-kombo-best">{{ data.kombo.best }}</div>
        <div class="text-xs text-white/80">{{ KAD_COPY.rekodTerbaik }}</div>
      </div>
      <div class="min-w-0 flex-1 rounded-xl bg-white/20 px-2 py-2">
        <div class="text-xl font-bold text-green-300" data-testid="kad-kombo-mult">
          {{ data.kombo.multiplier.toFixed(1) }}x
        </div>
        <div class="text-xs text-white/80">{{ KAD_COPY.pengganda }}</div>
      </div>
    </div>
    <div class="mt-4 text-base font-bold wrap-anywhere" data-testid="kad-kombo-name">
      {{ data.name }}
    </div>
    <div class="text-xs text-white/80">{{ KAD_COPY.site }}</div>
  </div>
</template>
