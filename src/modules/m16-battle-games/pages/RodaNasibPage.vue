<script setup lang="ts">
/**
 * S18 `/permainan/roda-nasib` Roda Nasib (FR-M16-93..95; URS FT-M16-7.1; BR-M16-29).
 * One spin per MYT day. `POST …/spin` is sent at the click (the server picks the segment), the wheel then
 * turns 4.2 s and the prize modal opens. A refused spin shows a native `alert(message)` and locks the
 * button. Syiling shown = credited (DV-M16-23): the modal lines "+n Syiling" and "Ditambah ke akaun
 * kamu!" appear only for a credited amount.
 */
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'

import { alertNative } from '@/composables/native-dialogs'

import { fetchSpinPage, spinWheel } from '../api'
import type { SpinPage } from '../api'
import LoadState from '../components/solo/LoadState.vue'
import { nextWheelRotation, WHEEL_SPIN_MS } from '../components/solo/solo-lib'
import { useGameTimers } from '../components/solo/useGameTimers'
import WheelCanvas from '../components/wheel/WheelCanvas.vue'

const timers = useGameTimers()

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
    timers.after(() => {
      prize.value = { icon: result.icon, label: result.label, type: result.type, credited }
      spins.value += 1
      won.value += credited
      alreadySpun.value = true
      spinning.value = false
    }, WHEEL_SPIN_MS)
  } catch (e) {
    console.error('Spin error:', e)
    spinning.value = false
  }
}

onMounted(() => void loadPage())
</script>

<template>
  <div class="mx-auto w-full max-w-2xl space-y-5 px-2 sm:px-6" data-testid="roda-nasib">
    <div>
      <RouterLink
        to="/permainan"
        class="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-800"
      >
        <ArrowLeft :size="16" /> Permainan
      </RouterLink>
      <h2 class="font-heading text-2xl font-extrabold text-slate-800">🎯 Roda Nasib</h2>
      <p class="text-sm text-slate-500">Pusing roda sekali sehari untuk hadiah misteri!</p>
    </div>

    <LoadState :loading="loading" :error="error" />

    <template v-if="page">
      <div class="flex flex-wrap gap-3 text-sm font-bold text-slate-700">
        <span class="rounded-xl bg-white px-4 py-2.5 shadow-sm" data-testid="spin-count"
          >🎰 {{ spins }} kali spin</span
        >
        <span class="rounded-xl bg-white px-4 py-2.5 shadow-sm" data-testid="spin-won"
          >🪙 {{ won }} Syiling dimenangkan</span
        >
      </div>

      <WheelCanvas :segments="page.segments" :rotation="rotation" />

      <button
        type="button"
        class="mx-auto flex min-h-14 w-48 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-violet-800 px-4 py-3 text-lg font-extrabold text-white shadow-xl shadow-violet-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="spinning || alreadySpun"
        data-testid="spin-button"
        @click="spin"
      >
        {{ buttonLabel }}
      </button>
    </template>

    <Teleport to="body">
      <div
        v-if="prize"
        class="fixed inset-0 z-[200] flex animate-fade-in items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        data-testid="prize-overlay"
        @click.self="prize = null"
      >
        <div class="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
          <div class="text-6xl" data-testid="prize-icon">{{ prize.icon }}</div>
          <h3
            class="mt-2 font-heading text-2xl font-extrabold text-slate-800"
            data-testid="prize-label"
          >
            {{ prize.label }}
          </h3>
          <template v-if="prize.type === 'syiling' && prize.credited > 0">
            <!-- Live: bright orange on white (≈ 2.1:1); DV-M16-48 uses amber-600 (≈ 3.2:1, large text), and the line "Ditambah ke akaun kamu!" (≈ 2.6:1 on live) is slate-500 (≈ 4.8:1). -->
            <p class="mt-2 text-4xl font-extrabold text-amber-600" data-testid="prize-amount">
              +{{ prize.credited }} Syiling
            </p>
            <p class="text-sm text-slate-500">Ditambah ke akaun kamu!</p>
          </template>
          <p v-else-if="prize.type === 'nothing'" class="mt-2 text-sm text-slate-500">
            Jangan risau, cuba lagi esok!
          </p>
          <button
            type="button"
            class="mt-5 min-h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 to-violet-800 px-3 py-3.5 text-base font-bold text-white shadow-lg hover:brightness-110"
            data-testid="prize-close"
            @click="prize = null"
          >
            Tutup
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
