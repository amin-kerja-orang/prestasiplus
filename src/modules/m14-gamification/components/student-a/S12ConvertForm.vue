<script setup lang="ts">
/**
 * S12 "💱 Penukaran" card (GAME-18, R1-MUR-29). `#convertForm`: number input (min = rate, max = balance,
 * required, placeholder "0", initial value = rate), the fixed choices 50, 250 and Semua, each disabled
 * when unaffordable (FR-GM-18.2), the live token preview and "Tukar Sekarang", which asks first with the
 * real debit (dialog B-055). The free input follows the same debit rule (ruling on defect 14, #500).
 */
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'

import { DsCluster, DsDialog, DsIconChip, DsStack, DsSurface, DsText } from '@/ds'
import { formatCount } from '@/lib/number'

import { s12CanConvert, s12Debit, s12ParseAmount, s12Tokens } from '../../lib/student/s12-convert'

const props = defineProps<{
  balance: number
  rate: number
  tierLabel: string
  submitting: boolean
}>()
const emit = defineEmits<{ (e: 'convert', amount: number): void }>()

const text = ref<string>(String(props.rate))
const activeQuick = ref<number | null>(null)
const confirming = ref(false)
const cancelButton = ref<ComponentPublicInstance | null>(null)

const amount = computed(() => s12ParseAmount(String(text.value)))
const tokens = computed(() => s12Tokens(amount.value ?? 0, props.rate))
const debit = computed(() => s12Debit(amount.value ?? 0, props.rate))
const canConvert = computed(
  () => !props.submitting && s12CanConvert(amount.value, props.rate, props.balance),
)
/** "Semua" is the largest multiple of the rate not above the balance (AC-GM-18.1). */
const quick = computed(() =>
  [
    { testid: 's12-quick-50', label: '50', value: 50 },
    { testid: 's12-quick-250', label: '250', value: 250 },
    { testid: 's12-quick-all', label: 'Semua', value: s12Debit(props.balance, props.rate) },
  ].map((q) => ({ ...q, usable: s12CanConvert(q.value, props.rate, props.balance) })),
)

/** After a conversion the page re-renders with the new balance: the value returns to the rate (live reloads). */
watch(
  () => props.balance,
  () => {
    text.value = String(props.rate)
    activeQuick.value = null
  },
)

/** `Batal` is the safe choice and holds the first focus (B-055). */
watch(confirming, async (open) => {
  if (!open) return
  await nextTick()
  requestAnimationFrame(() => (cancelButton.value?.$el as HTMLElement | undefined)?.focus())
})

function setAmount(index: number): void {
  const choice = quick.value[index]
  if (!choice?.usable) return
  text.value = String(choice.value)
  activeQuick.value = index
}

function onInput(): void {
  activeQuick.value = null
}

function onSubmit(): void {
  if (canConvert.value) confirming.value = true
}

/** A second click of a double click finds the dialog already closing and does nothing (AC-GM-18.3). */
function onConfirm(): void {
  const n = amount.value
  if (!confirming.value || n === null) return
  confirming.value = false
  emit('convert', n)
}
</script>

<template>
  <UCard class="min-w-0" data-testid="s12-form-card">
    <div class="flex flex-col gap-4">
      <h2 class="flex items-center gap-2 font-display text-subheading font-bold text-highlighted">
        <DsIconChip icon="arrows-clockwise" size="sm" />Penukaran
      </h2>
      <DsSurface v-if="balance < rate" level="elevated" data-testid="s12-short">
        <DsStack gap="sm" align="start">
          <div>
            <DsText variant="body"
              >Anda perlu sekurang-kurangnya {{ formatCount(rate) }} syiling</DsText
            >
            <DsText variant="body"
              >untuk menukar 1 token. Teruskan berlatih untuk mengumpul syiling.</DsText
            >
          </div>
          <UButton to="/practice" size="lg" data-testid="s12-short-practice"
            >Mula Latih Tubi</UButton
          >
        </DsStack>
      </DsSurface>
      <form
        id="convertForm"
        class="flex flex-col gap-4"
        data-testid="s12-form"
        @submit.prevent="onSubmit"
      >
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
            size="lg"
            class="w-full"
            data-testid="s12-input"
            @input="onInput"
          />
        </UFormField>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="(q, i) in quick"
            :key="q.testid"
            type="button"
            size="lg"
            :color="activeQuick === i ? 'secondary' : 'neutral'"
            :variant="activeQuick === i ? 'solid' : 'soft'"
            :data-active="activeQuick === i ? 'true' : 'false'"
            :disabled="!q.usable"
            :data-testid="q.testid"
            @click="setAmount(i)"
            >{{ q.label }}</UButton
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
          <DsCluster justify="center" gap="xs">
            <p class="text-caption text-muted" data-testid="s12-rate-line">
              Kadar tahap anda: {{ formatCount(rate) }} syiling = 1 token
            </p>
            <UBadge color="neutral" variant="soft" size="sm" data-testid="s12-tier-chip">{{
              tierLabel
            }}</UBadge>
          </DsCluster>
        </div>

        <UButton
          id="convertBtn"
          type="submit"
          size="lg"
          block
          icon="i-ph-arrows-left-right-duotone"
          :disabled="!canConvert"
          data-testid="s12-submit"
          >Tukar Sekarang</UButton
        >
      </form>
    </div>
    <DsDialog v-model:open="confirming" title="Tukar syiling kepada token?">
      <DsText variant="body" data-testid="s12-confirm-text">
        Tukar {{ formatCount(debit) }} syiling kepada {{ formatCount(tokens) }} token?
      </DsText>
      <template #footer>
        <UButton
          ref="cancelButton"
          type="button"
          color="neutral"
          variant="ghost"
          size="lg"
          data-testid="s12-confirm-cancel"
          @click="confirming = false"
          >Batal</UButton
        >
        <UButton type="button" size="lg" data-testid="s12-confirm-ok" @click="onConfirm"
          >Tukar</UButton
        >
      </template>
    </DsDialog>
  </UCard>
</template>
