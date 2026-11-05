<script setup lang="ts">
/**
 * S12 `/gamification/convert` "Tukar Syiling → Token" (GAME-18, R1-MUR-29). Reads #5 and #4 (`type=convert`,
 * "Sejarah penukaran", FR-MUR-29-3) and posts #6. Each press sends one `clientUuid`, and a retry after an
 * unknown outcome reuses it, so the server moves the wallet once (AC-GM-18.3, FR-ERR-9).
 */
import { computed, ref } from 'vue'

import { ApiError } from '@/api'
import { useApi } from '@/composables'
import { DsPage, DsRewardChip } from '@/ds'
import { formatCount } from '@/lib/number'
import { formatDateTime } from '@/lib/time/format'

import { convertSyiling, fetchConvertView, fetchGamificationTransactions } from '../api'
import S12ConvertForm from '../components/student-a/S12ConvertForm.vue'
import S12TierRates from '../components/student-a/S12TierRates.vue'
import { s12NewClientUuid } from '../lib/student/s12-convert'

const info = useApi((signal) => fetchConvertView({ signal }))
const history = useApi((signal) => fetchGamificationTransactions({ type: 'convert' }, { signal }))

/** Balances after a conversion (the response carries the new ones). */
const balances = ref<{ syiling: number; token: number } | null>(null)
const submitting = ref(false)
const success = ref('')
const failure = ref('')

const syiling = () => balances.value?.syiling ?? info.data.value?.currentSyiling ?? 0
const token = () => balances.value?.token ?? info.data.value?.tokenBalance ?? 0

/** The tier chip of the rate line, for example "🥉 Gangsa". */
const tierChip = computed(() => {
  const view = info.data.value
  const icon = view?.tiers.find((t) => t.isMine)?.icon
  return icon ? `${icon} ${view?.tierLabel ?? ''}` : (view?.tierLabel ?? '')
})

/** The request whose outcome is unknown: pressing again with the same amount repeats its key. */
let unsettled: { amount: number; clientUuid: string } | null = null

/** The server answered and moved nothing, so the next press is a new request; 408 and 429 may be repeated as they are. */
function refused(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500 && ![408, 429].includes(err.status)
}

async function onConvert(amount: number): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  success.value = ''
  failure.value = ''
  const request =
    unsettled?.amount === amount ? unsettled : { amount, clientUuid: s12NewClientUuid() }
  unsettled = request
  try {
    const res = await convertSyiling(request.amount, request.clientUuid)
    unsettled = null
    balances.value = { syiling: res.currentSyiling, token: res.tokenBalance }
    success.value = `Berjaya menukar ${formatCount(res.syilingDebited)} syiling kepada ${formatCount(res.tokensCredited)} token.`
    void history.reload()
  } catch (err) {
    if (refused(err)) unsettled = null
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
    <h1 v-if="info.error.value || !info.data.value" class="sr-only">Tukar Syiling → Token</h1>
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
          :tier-label="tierChip"
          :submitting="submitting"
          @convert="onConvert"
        />
        <S12TierRates :tiers="info.data.value.tiers" />
      </div>

      <UCard class="min-w-0" data-testid="s12-history">
        <div class="flex flex-col gap-4">
          <h2 class="text-subheading text-highlighted">Sejarah penukaran</h2>
          <UAlert
            v-if="history.error.value"
            color="error"
            variant="subtle"
            title="Ralat berlaku. Sila cuba lagi."
          />
          <USkeleton v-else-if="!history.data.value" class="h-16 w-full" aria-busy="true" />
          <p
            v-else-if="history.data.value.data.length === 0"
            class="text-body text-muted"
            data-testid="s12-history-empty"
          >
            Belum ada penukaran.
          </p>
          <ul v-else class="flex flex-col gap-2">
            <li v-for="r in history.data.value.data" :key="r.id" class="min-w-0">
              <UCard
                :ui="{ body: 'flex flex-col gap-1 p-3 sm:p-3' }"
                data-testid="s12-history-row"
              >
                <p class="text-label break-words text-highlighted">{{ r.description }}</p>
                <p class="text-caption text-muted">{{ formatDateTime(r.createdAt) }}</p>
              </UCard>
            </li>
          </ul>
        </div>
      </UCard>
    </template>
  </DsPage>
</template>
