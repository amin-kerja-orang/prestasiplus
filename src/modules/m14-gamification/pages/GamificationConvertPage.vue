<script setup lang="ts">
/**
 * S12 `/gamification/convert` "Tukar Syiling → Token" (M14-T2a; FR-M14-27…33, BR-M14-10, 11). Reads #5,
 * posts #6; the PROPOSED success and error messages are SRS §8.2.
 */
import { ref } from 'vue'

import { ApiError } from '@/api'
import { useApi } from '@/composables'
import { DsPage, DsRewardChip } from '@/ds'
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
  <DsPage data-testid="gamification-convert-page">
    <UAlert
      v-if="info.error.value"
      color="error"
      variant="subtle"
      title="Ralat berlaku. Sila cuba lagi."
    />

    <div
      v-else-if="!info.data.value"
      class="flex flex-col gap-4"
      aria-busy="true"
      data-testid="s12-loading"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>

    <template v-else>
      <UCard data-testid="s12-hero">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex min-w-0 flex-col gap-1">
            <h1 class="text-title text-highlighted">
              Tukar Syiling → Token
            </h1>
            <p class="text-body text-muted">Tukar syiling anda kepada token untuk tebus hadiah</p>
          </div>
          <div class="flex shrink-0 gap-4 text-center">
            <div class="flex flex-col items-center gap-1">
              <DsRewardChip art="coin" :value="formatCount(syiling())" data-testid="s12-balance-syiling" />
              <span class="text-caption text-muted">Baki Syiling</span>
            </div>
            <div class="flex flex-col items-center gap-1">
              <DsRewardChip art="bolt" :value="formatCount(token())" data-testid="s12-balance-token" />
              <span class="text-caption text-muted">Baki Token</span>
            </div>
          </div>
        </div>
      </UCard>

      <UAlert v-if="success" color="success" variant="subtle" :title="success" />
      <UAlert v-if="failure" color="error" variant="subtle" :title="failure" />

      <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
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
  </DsPage>
</template>
