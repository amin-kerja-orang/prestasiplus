<script setup lang="ts">
/**
 * S11 `/cikgu/hadiah/saya` (FR-M15-73..75; URS FT-M15-10.2): title row (h1 left, "🎁 Kedai Hadiah"
 * right on one row at every width) and the white empty card. The list is empty for every account
 * (BR-M15-28): #20 never returns rows and the M15 redemption store is not read.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchDigitalRedemptions } from '../api'
import { MY_REDEMPTIONS_COPY } from '../components/copy'
import LoadError from '../components/LoadError.vue'

const list = useApi((signal) => fetchDigitalRedemptions({ signal }))
const ready = computed(() => list.data.value !== null)

const BTN =
  'inline-flex min-h-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-bold text-white hover:bg-violet-700'
</script>

<template>
  <div class="mx-auto max-w-[53rem] min-w-0 space-y-5" data-testid="m15-redemptions-page">
    <section class="flex items-center justify-between gap-3">
      <h1
        class="min-w-0 font-heading text-2xl font-bold text-slate-800"
        data-testid="redemptions-title"
      >
        {{ MY_REDEMPTIONS_COPY.heading }}
      </h1>
      <RouterLink to="/cikgu/hadiah" :class="BTN" data-testid="redemptions-to-shop">
        {{ MY_REDEMPTIONS_COPY.toShop }}
      </RouterLink>
    </section>

    <LoadError v-if="list.error.value" @retry="list.reload()" />
    <div
      v-else-if="!ready"
      class="flex justify-center py-10 text-slate-400"
      data-testid="redemptions-loading"
    >
      <LoadingSpinner :size="28" />
    </div>
    <section
      v-else
      class="rounded-2xl bg-white px-4 py-8 text-center shadow-sm sm:px-6"
      data-testid="redemptions-empty"
    >
      <div class="text-5xl leading-none" data-testid="redemptions-icon">
        {{ MY_REDEMPTIONS_COPY.icon }}
      </div>
      <p class="mt-3 text-sm text-slate-600">{{ MY_REDEMPTIONS_COPY.empty }}</p>
      <RouterLink to="/cikgu/hadiah" :class="[BTN, 'mt-4 px-6']" data-testid="redemptions-browse">
        {{ MY_REDEMPTIONS_COPY.browse }}
      </RouterLink>
    </section>
  </div>
</template>
