<script setup lang="ts">
/**
 * S12 "💱 Penukaran" card (FN-M14-3.1.2–3.1.5, 3.1.8; FR-M14-28…31, 33). `#convertForm`: number input
 * (min = rate, max = balance, required, placeholder "0", initial value = rate), quick buttons that set
 * the amount and mark themselves active, the live token preview and "Tukar Sekarang".
 */
import { ArrowDown, ArrowRightLeft, RefreshCw } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { formatCount } from '@/lib/number'

import { s12CanConvert, s12ParseAmount, s12Tokens } from '../../lib/student/s12-convert'

const props = defineProps<{
  balance: number
  rate: number
  tierLabel: string
  submitting: boolean
}>()
const emit = defineEmits<{ (e: 'convert', amount: number): void }>()

const text = ref<string | number>(String(props.rate))
const activeQuick = ref<number | null>(null)

const amount = computed(() => s12ParseAmount(String(text.value)))
const tokens = computed(() => s12Tokens(amount.value ?? 0, props.rate))
const canConvert = computed(
  () => !props.submitting && s12CanConvert(amount.value, props.rate, props.balance),
)
const quick = computed(() => [props.rate, props.rate * 5, props.balance])

/** After a conversion the page re-renders with the new balance: the value returns to the rate (live reloads). */
watch(
  () => props.balance,
  () => {
    text.value = String(props.rate)
    activeQuick.value = null
  },
)

function setAmount(index: number): void {
  text.value = String(quick.value[index])
  activeQuick.value = index
}

function onInput(): void {
  activeQuick.value = null
}

function onSubmit(): void {
  const n = amount.value
  if (n === null || !canConvert.value) return
  emit('convert', n)
}

const quickClass = (i: number) =>
  activeQuick.value === i
    ? 'border-amber-500 bg-amber-500 text-white'
    : 'border-slate-200 bg-white text-slate-700 hover:border-amber-400'
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow sm:p-6" data-testid="s12-form-card">
    <h2 class="flex items-center gap-2 font-heading text-lg font-bold">
      <RefreshCw class="h-5 w-5 text-blue-500" />Penukaran
    </h2>
    <form id="convertForm" class="mt-4" data-testid="s12-form" @submit.prevent="onSubmit">
      <label for="syilingInput" class="block text-sm font-medium text-slate-700"
        >Syiling untuk ditukar</label
      >
      <input
        id="syilingInput"
        v-model="text"
        type="number"
        name="syiling_amount"
        required
        placeholder="0"
        :min="rate"
        :max="balance"
        class="mt-2 min-h-11 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-center text-2xl font-bold text-slate-800 focus:border-amber-400 focus:outline-none"
        data-testid="s12-input"
        @input="onInput"
      />
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          class="min-h-11 rounded-xl border-2 px-4 py-2 text-sm font-semibold"
          :class="quickClass(0)"
          data-testid="s12-quick-rate"
          @click="setAmount(0)"
        >
          {{ formatCount(rate) }} syiling
        </button>
        <button
          type="button"
          class="min-h-11 rounded-xl border-2 px-4 py-2 text-sm font-semibold"
          :class="quickClass(1)"
          data-testid="s12-quick-five"
          @click="setAmount(1)"
        >
          {{ formatCount(rate * 5) }} syiling
        </button>
        <button
          type="button"
          class="min-h-11 rounded-xl border-2 px-4 py-2 text-sm font-semibold"
          :class="quickClass(2)"
          data-testid="s12-quick-all"
          @click="setAmount(2)"
        >
          Semua ({{ formatCount(balance) }})
        </button>
      </div>

      <div class="my-3 flex justify-center text-blue-500"><ArrowDown class="h-6 w-6" /></div>

      <div
        class="rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-4 text-center"
        data-testid="s12-preview"
      >
        <p class="text-sm text-slate-600">Anda akan terima</p>
        <p
          id="tokenPreview"
          class="text-4xl font-bold text-blue-800"
          data-testid="s12-preview-tokens"
        >
          {{ formatCount(tokens) }}
        </p>
        <p class="text-sm text-slate-600">Token 🎫</p>
        <p class="mt-1 text-xs text-slate-500" data-testid="s12-rate-line">
          Kadar: {{ rate }} syiling = 1 token ({{ tierLabel }})
        </p>
      </div>

      <button
        id="convertBtn"
        type="submit"
        :disabled="!canConvert"
        class="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 px-4 py-3 font-bold text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="s12-submit"
      >
        <ArrowRightLeft class="h-5 w-5" />Tukar Sekarang
      </button>
    </form>
  </section>
</template>
