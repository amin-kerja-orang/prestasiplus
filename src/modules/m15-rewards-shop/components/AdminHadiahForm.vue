<script setup lang="ts">
/**
 * The one form of `/admin/hadiah/baharu` and `/admin/hadiah/:id/edit` (30 P2-07, field list P07-02..14;
 * S7-T11). PUT replaces, so every field is sent. Validation is the server's: its BM message shows at the
 * field and nothing is saved, so the number inputs carry no min, max or step a browser would refuse
 * first. `Kategori` and `Delivery` use the OPT words (`manual` and `instant` only: `api` is not offered,
 * FR-ADM-P2-07.3), `Aktif` is off on a new reward (P07-14) and the parent consent field is neither shown
 * nor sent (48 D-GAME-5).
 */
import { computed, nextTick, reactive, ref, watch } from 'vue'

import { isApiError } from '@/api'
import { useApi } from '@/composables'
import {
  DsCallout,
  DsFormBar,
  DsFormField,
  DsFormSection,
  DsNativeSelect,
  DsStack,
  DsStateView,
} from '@/ds'

import { createHadiah, fetchHadiah, updateHadiah } from '../api/admin'
import {
  HADIAH_CATEGORIES,
  HADIAH_CATEGORY_LABELS,
  type HadiahInput,
  type HadiahReward,
} from '../api/types'
import { HADIAH_ADMIN_COPY, COMMON_COPY } from './copy'

const COPY = HADIAH_ADMIN_COPY.form

const props = withDefaults(defineProps<{ mode: 'create' | 'edit'; id?: string }>(), { id: undefined })
const emit = defineEmits<{ saved: [reward: HadiahReward] }>()

/** Every control holds text, so a half-typed or empty number is kept as it is until the server judges it. */
interface FormValues {
  category: string
  vendor: string
  title: string
  description: string
  denominationRm: string
  tokenCost: string
  iconEmoji: string
  stockQuantity: string
  maxPerMonthPerStudent: string
  voucherValidityDays: string
  deliveryMethod: 'manual' | 'instant'
  vendorSku: string
  displayOrder: string
  imageUrl: string
  termsText: string
  isActive: boolean
}

const blank = (): FormValues => ({
  category: '',
  vendor: '',
  title: '',
  description: '',
  denominationRm: '',
  tokenCost: '',
  iconEmoji: '',
  stockQuantity: '',
  maxPerMonthPerStudent: '',
  voucherValidityDays: '365',
  deliveryMethod: 'manual',
  vendorSku: '',
  displayOrder: '100',
  imageUrl: '',
  termsText: '',
  isActive: false,
})

const values = reactive<FormValues>(blank())
const errors = ref<Record<string, string>>({})
const failure = ref('')
const saving = ref(false)
const root = ref<{ $el: HTMLElement } | null>(null)

const categoryItems = HADIAH_CATEGORIES.map((key) => ({
  label: HADIAH_CATEGORY_LABELS[key].pill,
  value: key,
}))
const deliveryItems = [
  { label: COPY.deliveryManual, value: 'manual' },
  { label: COPY.deliveryInstant, value: 'instant' },
]

const loaded = useApi((signal) => fetchHadiah(props.id ?? '', { signal }), undefined, {
  immediate: props.mode === 'edit',
})

const text = (value: string | number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value)

function fill(reward: HadiahReward): void {
  Object.assign(values, {
    category: reward.category,
    vendor: reward.vendor,
    title: reward.title,
    description: text(reward.description),
    denominationRm: text(reward.denominationRm),
    tokenCost: text(reward.tokenCost),
    iconEmoji: text(reward.iconEmoji),
    stockQuantity: text(reward.stockQuantity),
    maxPerMonthPerStudent: text(reward.maxPerMonthPerStudent),
    voucherValidityDays: text(reward.voucherValidityDays),
    // A stored `api` row cannot be written back: the form starts on the default.
    deliveryMethod: reward.deliveryMethod === 'instant' ? 'instant' : 'manual',
    vendorSku: text(reward.vendorSku),
    displayOrder: text(reward.displayOrder),
    imageUrl: text(reward.imageUrl),
    termsText: text(reward.termsText),
    isActive: reward.isActive,
  })
}
watch(loaded.data, (reward) => {
  if (reward) fill(reward)
})

const status = computed(() =>
  props.mode === 'create' ? 'ready' : loaded.error.value ? 'error' : loaded.data.value ? 'ready' : 'loading',
)

/** A number the admin typed: `null` when empty. Text that is not a number goes as typed, for the server to refuse. */
function numeric(value: string): number | string | null {
  const t = text(value).trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isNaN(n) ? t : n
}
const optional = (value: string): string | null => (value.trim() === '' ? null : value.trim())

/** The body of the write: every field of the form, never the consent field. */
function body(): HadiahInput {
  const v = values
  const validity = numeric(v.voucherValidityDays)
  const order = numeric(v.displayOrder)
  return {
    category: v.category,
    vendor: v.vendor.trim(),
    title: v.title.trim(),
    description: optional(v.description),
    denominationRm: numeric(v.denominationRm),
    tokenCost: numeric(v.tokenCost),
    iconEmoji: optional(v.iconEmoji),
    stockQuantity: numeric(v.stockQuantity),
    maxPerMonthPerStudent: numeric(v.maxPerMonthPerStudent),
    // Blank takes the server default (365 days, order 100).
    ...(validity === null ? {} : { voucherValidityDays: validity }),
    deliveryMethod: v.deliveryMethod,
    vendorSku: optional(v.vendorSku),
    ...(order === null ? {} : { displayOrder: order }),
    imageUrl: optional(v.imageUrl),
    termsText: optional(v.termsText),
    isActive: v.isActive,
    // The server is the judge of what is blank or out of range (it answers the P07 message).
  } as unknown as HadiahInput
}

async function submit(): Promise<void> {
  if (saving.value) return
  saving.value = true
  errors.value = {}
  failure.value = ''
  try {
    const saved =
      props.mode === 'create' ? await createHadiah(body()) : await updateHadiah(props.id ?? '', body())
    emit('saved', saved)
  } catch (err) {
    const fields = isApiError(err) ? (err.fields ?? {}) : {}
    if (Object.keys(fields).length > 0) {
      errors.value = fields
      // Keyboard and screen reader users land on the first field that needs a fix.
      await nextTick()
      root.value?.$el.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    } else {
      failure.value = isApiError(err) ? err.message : COMMON_COPY.actionFailed
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsStateView
    :status="status"
    skeleton="text"
    :error="loaded.error.value?.message"
    data-testid="hadiah-form-state"
    @retry="loaded.reload()"
  >
    <DsStack
      ref="root"
      as="form"
      gap="md"
      data-testid="hadiah-form"
      @submit.prevent="submit"
    >
      <DsFormSection :title="mode === 'create' ? COPY.createTitle : COPY.editTitle" icon="gift" :columns="2">
        <DsFormField native :label="COPY.category" required :error="errors.category">
          <template #default="f">
            <DsNativeSelect
              :id="f.id"
              v-model="values.category"
              blank
              :items="categoryItems"
              :invalid="f.invalid"
              data-testid="hadiah-category"
            />
          </template>
        </DsFormField>
        <DsFormField native :label="COPY.vendor" required :error="errors.vendor">
          <template #default="f">
            <UInput
              :id="f.id"
              v-model="values.vendor"
              type="text"
              :placeholder="COPY.vendorPlaceholder"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="hadiah-vendor"
            />
          </template>
        </DsFormField>
        <DsFormField native :label="COPY.title" required :error="errors.title">
          <template #default="f">
            <UInput
              :id="f.id"
              v-model="values.title"
              type="text"
              :placeholder="COPY.titlePlaceholder"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="hadiah-title"
            />
          </template>
        </DsFormField>
        <DsFormField native :label="COPY.description" :error="errors.description">
          <template #default="f">
            <UTextarea
              :id="f.id"
              v-model="values.description"
              :rows="3"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="hadiah-description"
            />
          </template>
        </DsFormField>
        <DsFormField native :label="COPY.denominationRm" required :error="errors.denominationRm">
          <template #default="f">
            <UInput
              :id="f.id"
              v-model="values.denominationRm"
              type="number"
              inputmode="decimal"
              step="any"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="hadiah-denomination"
            />
          </template>
        </DsFormField>
        <DsFormField
          native
          :label="COPY.tokenCost"
          required
          :hint="COPY.tokenCostHint"
          :error="errors.tokenCost"
        >
          <template #default="f">
            <UInput
              :id="f.id"
              v-model="values.tokenCost"
              type="number"
              inputmode="numeric"
              step="any"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="hadiah-token-cost"
            />
          </template>
        </DsFormField>
        <DsFormField native :label="COPY.iconEmoji" :error="errors.iconEmoji">
          <template #default="f">
            <UInput
              :id="f.id"
              v-model="values.iconEmoji"
              type="text"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="hadiah-icon"
            />
          </template>
        </DsFormField>
        <DsFormField native :label="COPY.stockQuantity" :error="errors.stockQuantity">
          <template #default="f">
            <UInput
              :id="f.id"
              v-model="values.stockQuantity"
              type="number"
              inputmode="numeric"
              step="any"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="hadiah-stock"
            />
          </template>
        </DsFormField>
        <DsFormField native :label="COPY.maxPerMonthPerStudent" :error="errors.maxPerMonthPerStudent">
          <template #default="f">
            <UInput
              :id="f.id"
              v-model="values.maxPerMonthPerStudent"
              type="number"
              inputmode="numeric"
              step="any"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="hadiah-max-per-month"
            />
          </template>
        </DsFormField>
        <DsFormField native :label="COPY.voucherValidityDays" :error="errors.voucherValidityDays">
          <template #default="f">
            <UInput
              :id="f.id"
              v-model="values.voucherValidityDays"
              type="number"
              inputmode="numeric"
              step="any"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="hadiah-validity"
            />
          </template>
        </DsFormField>
        <DsFormField native :label="COPY.deliveryMethod" :error="errors.deliveryMethod">
          <template #default="f">
            <DsNativeSelect
              :id="f.id"
              v-model="values.deliveryMethod"
              :items="deliveryItems"
              :invalid="f.invalid"
              data-testid="hadiah-delivery"
            />
          </template>
        </DsFormField>
        <DsFormField native :label="COPY.vendorSku" :error="errors.vendorSku">
          <template #default="f">
            <UInput
              :id="f.id"
              v-model="values.vendorSku"
              type="text"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="hadiah-sku"
            />
          </template>
        </DsFormField>
        <DsFormField native :label="COPY.displayOrder" :error="errors.displayOrder">
          <template #default="f">
            <UInput
              :id="f.id"
              v-model="values.displayOrder"
              type="number"
              inputmode="numeric"
              step="any"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="hadiah-order"
            />
          </template>
        </DsFormField>
        <DsFormField native :label="COPY.imageUrl" :error="errors.imageUrl">
          <template #default="f">
            <UInput
              :id="f.id"
              v-model="values.imageUrl"
              type="text"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="hadiah-image"
            />
          </template>
        </DsFormField>
        <DsFormField native :label="COPY.termsText" :error="errors.termsText">
          <template #default="f">
            <UTextarea
              :id="f.id"
              v-model="values.termsText"
              :rows="3"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="hadiah-terms"
            />
          </template>
        </DsFormField>
        <UCheckbox v-model="values.isActive" :label="COPY.isActive" data-testid="hadiah-active" />

        <template v-if="failure" #footer>
          <DsCallout tone="error" :description="failure" data-testid="hadiah-failure" />
        </template>
      </DsFormSection>

      <DsFormBar
        :submit-label="mode === 'create' ? COPY.create : COPY.save"
        :saving="saving"
        cancel-to="/admin/hadiah"
      />
    </DsStack>
  </DsStateView>
</template>
