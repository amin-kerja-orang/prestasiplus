<script setup lang="ts">
/**
 * S12 "💱 Penukaran" card (FN-M14-3.1.2–3.1.5, 3.1.8; FR-M14-28…31, 33). `#convertForm`: number input
 * (min = rate, max = balance, required, placeholder "0", initial value = rate), quick buttons that set
 * the amount and mark themselves active, the live token preview and "Tukar Sekarang".
 */
import { computed, ref, watch } from 'vue'

import { DsIconChip } from '@/ds'
import { formatCount } from '@/lib/number'

import { s12CanConvert, s12ParseAmount, s12Tokens } from '../../lib/student/s12-convert'

const props = defineProps<{
  balance: number
  rate: number
  tierLabel: string
  submitting: boolean
}>()
const emit = defineEmits<{ (e: 'convert', amount: number): void }>()

const text = ref<string>(String(props.rate))
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
</script>

<template>
  <UCard class="min-w-0" data-testid="s12-form-card">
    <div class="flex flex-col gap-4">
      <h2 class="flex items-center gap-2 font-display text-subheading font-bold text-highlighted">
        <DsIconChip icon="arrows-clockwise" size="sm" />Penukaran
      </h2>
      <form id="convertForm" class="flex flex-col gap-4" data-testid="s12-form" @submit.prevent="onSubmit">
        <UFormField label="Syiling untuk ditukar" for="syilingInput">
          <UInput
            id="syilingInput"
            v-model="text"
            type="number"
            name="syiling_amount"
            required
            placeholder="0"
            :min="rate"
            :max="balance"
            size="xl"
            class="w-full"
            data-testid="s12-input"
            @input="onInput"
          />
        </UFormField>
        <div class="flex flex-wrap gap-2">
          <UButton
            type="button"
            size="lg"
            :color="activeQuick === 0 ? 'secondary' : 'neutral'"
            :variant="activeQuick === 0 ? 'solid' : 'soft'"
            :data-active="activeQuick === 0 ? 'true' : 'false'"
            data-testid="s12-quick-rate"
            @click="setAmount(0)"
            >{{ formatCount(rate) }} syiling</UButton
          >
          <UButton
            type="button"
            size="lg"
            :color="activeQuick === 1 ? 'secondary' : 'neutral'"
            :variant="activeQuick === 1 ? 'solid' : 'soft'"
            :data-active="activeQuick === 1 ? 'true' : 'false'"
            data-testid="s12-quick-five"
            @click="setAmount(1)"
            >{{ formatCount(rate * 5) }} syiling</UButton
          >
          <UButton
            type="button"
            size="lg"
            :color="activeQuick === 2 ? 'secondary' : 'neutral'"
            :variant="activeQuick === 2 ? 'solid' : 'soft'"
            :data-active="activeQuick === 2 ? 'true' : 'false'"
            data-testid="s12-quick-all"
            @click="setAmount(2)"
            >Semua ({{ formatCount(balance) }})</UButton
          >
        </div>

        <div class="flex justify-center text-primary-t" aria-hidden="true">
          <UIcon name="i-ph-arrow-down-bold" class="size-6" />
        </div>

        <div
          class="flex flex-col items-center gap-1 rounded-card bg-primary-soft p-4 text-center"
          data-testid="s12-preview"
        >
          <p class="text-label text-muted">Anda akan terima</p>
          <p
            id="tokenPreview"
            class="tabular font-display text-display font-extrabold text-highlighted"
            data-testid="s12-preview-tokens"
          >
            {{ formatCount(tokens) }}
          </p>
          <p class="text-label text-muted">Token 🎫</p>
          <p class="text-caption text-muted" data-testid="s12-rate-line">
            Kadar: {{ rate }} syiling = 1 token ({{ tierLabel }})
          </p>
        </div>

        <UButton
          id="convertBtn"
          type="submit"
          size="xl"
          block
          icon="i-ph-arrows-left-right-duotone"
          :disabled="!canConvert"
          data-testid="s12-submit"
          >Tukar Sekarang</UButton
        >
      </form>
    </div>
  </UCard>
</template>
