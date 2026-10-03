<script setup lang="ts">
/**
 * S12 `/gamification/convert` "Tukar Syiling → Token" (M14-T2a; FR-M14-27…33, BR-M14-10, 11). Reads #5,
 * posts #6; the PROPOSED success and error messages are SRS §8.2.
 */
import { RefreshCw } from '@lucide/vue'
import { ref } from 'vue'

import { ApiError } from '@/api'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
import { formatCount } from '@/lib/number'

import { fetchConvertView, convertSyiling } from '../api'
import S12ConvertForm from '../components/student-a/S12ConvertForm.vue'
import S12TierRates from '../components/student-a/S12TierRates.vue'

const info = useApi((signal) => fetchConvertView({ signal }))

/** Balances after a conversion (the response carries the new ones). */
const balances = ref<{ syiling: number; token: number } | null>(null)
const submitting = ref(false)
const success = ref('')
const failure = ref('')

const syiling = () => balances.value?.syiling ?? info.data.value?.currentSyiling ?? 0
const token = () => balances.value?.token ?? info.data.value?.tokenBalance ?? 0

async function onConvert(amount: number): Promise<void> {
  submitting.value = true
  success.value = ''
  failure.value = ''
  try {
    const res = await convertSyiling(amount)
    balances.value = { syiling: res.currentSyiling, token: res.tokenBalance }
    success.value = `Berjaya! ${formatCount(res.syilingDebited)} syiling ditukar kepada ${formatCount(res.tokensCredited)} token.`
  } catch (err) {
    failure.value =
      err instanceof ApiError && err.status === 422
        ? 'Jumlah syiling tidak sah.'
        : 'Ralat berlaku. Sila cuba lagi.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="gamification-convert-page">
    <AlertBox v-if="info.error.value" messages="Ralat berlaku. Sila cuba lagi." />

    <div
      v-else-if="!info.data.value"
      class="flex justify-center py-10 text-slate-400"
      data-testid="s12-loading"
    >
      <LoadingSpinner :size="28" />
    </div>

    <template v-else>
      <section
        class="gam-hero min-w-0 rounded-3xl bg-linear-to-r from-blue-800 to-blue-400 p-4 text-white shadow-lg sm:p-6"
        data-testid="s12-hero"
      >
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="min-w-0">
            <h1 class="flex items-center gap-2 font-heading text-2xl font-bold text-white">
              <RefreshCw class="h-6 w-6" />Tukar Syiling → Token
            </h1>
            <p class="mt-1 text-sm text-white">
              Tukar syiling anda kepada token untuk tebus hadiah
            </p>
          </div>
          <div class="flex shrink-0 gap-6 text-center">
            <div>
              <p class="text-2xl font-bold text-white" data-testid="s12-balance-syiling">
                {{ formatCount(syiling()) }}
              </p>
              <p class="text-xs text-white">Baki Syiling</p>
            </div>
            <div>
              <p class="text-2xl font-bold text-white" data-testid="s12-balance-token">
                {{ formatCount(token()) }}
              </p>
              <p class="text-xs text-white">Baki Token</p>
            </div>
          </div>
        </div>
      </section>

      <AlertBox v-if="success" variant="success" :messages="success" />
      <AlertBox v-if="failure" :messages="failure" />

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <S12ConvertForm
          :balance="syiling()"
          :rate="info.data.value.rate"
          :tier-label="info.data.value.tierLabel"
          :submitting="submitting"
          @convert="onConvert"
        />
        <S12TierRates :tiers="info.data.value.tiers" />
      </div>
    </template>
  </div>
</template>
