<script setup lang="ts">
/**
 * S18 `/permainan/roda-nasib` Roda Nasib (FR-M16-93..95; URS FT-M16-7.1; BR-M16-29).
 * One spin per MYT day. `POST …/spin` is sent at the click (the server picks the segment), the wheel then
 * turns 4.2 s and the prize modal opens. A refused spin shows a native `alert(message)` and locks the
 * button. Syiling shown = credited (DV-M16-23): the modal lines "+n Syiling" and "Ditambah ke akaun
 * kamu!" appear only for a credited amount.
 */
import { computed, onMounted, ref } from 'vue'
import { alertNative } from '@/composables/native-dialogs'
import { DsPage, DsLoadError, DsStack, DsCluster, DsHeading, DsText } from '@/ds'
import { useMedia } from '@/ds/useMedia'

import { fetchSpinPage, spinWheel } from '../api'
import type { SpinPage } from '../api'
import PrizeModal from '../components/solo/PrizeModal.vue'
import { nextWheelRotation, WHEEL_SPIN_MS } from '../components/solo/solo-lib'
import { useGameTimers } from '../components/solo/useGameTimers'
import WheelCanvas from '../components/wheel/WheelCanvas.vue'

const timers = useGameTimers()
const reduced = useMedia('(prefers-reduced-motion: reduce)', false)

const page = ref<SpinPage | null>(null)
const loading = ref(true)
const error = ref('')
const spinning = ref(false)
const alreadySpun = ref(false)
const spins = ref(0)
const won = ref(0)
const rotation = ref(0)
const prize = ref<{ icon: string; label: string; type: string; credited: number } | null>(null)

const buttonLabel = computed(() => {
  if (spinning.value) return '⏳ Sedang Pusing...'
  if (alreadySpun.value) return '✅ Sudah Spin Hari Ini'
  return '🎯 SPIN!'
})

async function loadPage(): Promise<void> {
  try {
    const data = await fetchSpinPage()
    page.value = data
    spins.value = data.spins
    won.value = data.won
    alreadySpun.value = data.alreadySpun
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ralat memuatkan Roda Nasib.'
  } finally {
    loading.value = false
  }
}

async function spin(): Promise<void> {
  if (spinning.value || alreadySpun.value) return
  spinning.value = true
  try {
    const res = await spinWheel()
    const result = res.body.result
    if (res.status < 200 || res.status >= 300 || !res.body.success || !result) {
      alertNative(res.body.message)
      alreadySpun.value = true
      spinning.value = false
      return
    }
    const credited = res.body.coinsCredited ?? 0
    rotation.value = nextWheelRotation(rotation.value, result.segment_index)
    timers.after(
      () => {
        prize.value = { icon: result.icon, label: result.label, type: result.type, credited }
        spins.value += 1
        won.value += credited
        alreadySpun.value = true
        spinning.value = false
      },
      reduced.value ? 0 : WHEEL_SPIN_MS,
    )
  } catch (e) {
    console.error('Spin error:', e)
    spinning.value = false
  }
}

onMounted(() => void loadPage())
</script>

<template>
  <DsPage data-testid="roda-nasib">
    <DsStack gap="2xs" align="start">
      <UButton
        to="/permainan"
        color="neutral"
        variant="ghost"
        icon="i-ph-arrow-left"
        class="min-h-11"
      >
        Permainan
      </UButton>
      <DsHeading :level="1">🎯 Roda Nasib</DsHeading>
      <DsText variant="body" tone="muted">Pusing roda sekali sehari untuk hadiah misteri!</DsText>
    </DsStack>

    <DsStack v-if="loading" gap="sm" aria-busy="true" data-testid="solo-loading">
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </DsStack>
    <DsLoadError v-else-if="error" :message="error" @retry="loadPage()" />

    <template v-if="page">
      <DsCluster align="stretch">
        <UBadge color="neutral" variant="soft" size="xl" data-testid="spin-count"
          >🎰 {{ spins }} kali spin</UBadge
        >
        <UBadge color="neutral" variant="soft" size="xl" data-testid="spin-won"
          >🪙 {{ won }} Syiling dimenangkan</UBadge
        >
      </DsCluster>

      <WheelCanvas :segments="page.segments" :rotation="rotation" />

      <UButton
        type="button"
        size="xl"
        color="primary"
        variant="solid"
        class="mx-auto min-h-14 w-full justify-center sm:w-auto"
        :disabled="spinning || alreadySpun"
        data-testid="spin-button"
        @click="spin"
      >
        {{ buttonLabel }}
      </UButton>
    </template>

    <PrizeModal
      v-if="prize"
      :icon="prize.icon"
      :label="prize.label"
      :type="prize.type"
      :credited="prize.credited"
      @close="prize = null"
    />
  </DsPage>
</template>
