<script setup lang="ts">
/**
 * S13 `/admin/school-subscriptions/create` "Langganan Baru - Admin PRESTASIPLUS" (M02-T9; FR-M02-84..87),
 * v2 staff theme.
 *
 * Card "Borang Langganan Baru": school picker, tier radio cards (Pemantauan default, Penuh), package
 * radio cards from #30 (none checked), student count (1-2000, default 100), live summary (DV-M02-08:
 * basic = 500 questions / 1 month), payment reference and note. Native HTML5 validation; a server
 * `VALIDATION_ERROR` (e.g. no school or package) shows the red alert and keeps the input. Success goes
 * to the new subscription's S14 with the flash.
 */
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import {
  DsFormField,
  DsFormSection,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStack,
  DsGrid,
  DsText,
} from '@/ds'

import type { SchoolSummary } from '../api/schools'
import { createSubscription, fetchSchoolPackages, type PackageTier } from '../api/subscriptions'
import SubscriptionSchoolPicker from '../components/SubscriptionSchoolPicker.vue'
import { errorLines } from '../lib/school-errors'
import {
  money,
  QUOTA_MAX,
  QUOTA_MIN,
  SUBSCRIPTION_ROUTES,
  SUBSCRIPTIONS_LIST_PATH,
} from '../lib/subscription-options'

const router = useRouter()
const flash = useFlash()

const school = ref<SchoolSummary | null>(null)
const tierItems = [
  {
    value: 'basic',
    label: 'Pemantauan',
    description: '500 soalan/bulan · PERCUMA\n1 bulan (demo/trial)',
  },
  {
    value: 'full',
    label: 'Penuh',
    description: 'Tanpa had · RM30/pelajar\n1 tahun',
  },
]
const packageItems = computed(() =>
  (packages.value ?? []).map((pkg) => ({
    value: pkg.id,
    label: pkg.code,
    description: `${pkg.name}\n${String(pkg.maxRenewals + 1)} tahun`,
  })),
)

const form = reactive<{
  tier: PackageTier
  packageId: number | null
  quota: string
  reference: string
  notes: string
}>({ tier: 'basic', packageId: null, quota: '100', reference: '', notes: '' })

const {
  data: packages,
  error: packagesError,
  reload: reloadPackages,
} = useApi((signal) => fetchSchoolPackages({ signal }))

const chosen = computed(() => packages.value?.find((p) => p.id === form.packageId) ?? null)
const quotaValue = computed(() => {
  const n = Number(form.quota)
  return form.quota !== '' && Number.isFinite(n) ? n : 0
})

/** FR-M02-86 live summary. */
const summary = computed(() => {
  if (quotaValue.value <= 0) return null
  if (form.tier === 'basic') return { kind: 'basic' as const }
  const pkg = chosen.value
  if (!pkg) return null
  const price = Number(pkg.priceAnnual)
  const years = pkg.maxRenewals + 1
  const total = quotaValue.value * price
  return {
    kind: 'full' as const,
    line: `${quotaValue.value} pelajar × ${money(price)}/tahun`,
    total: money(total),
    grand: pkg.maxRenewals > 0 ? `Jumlah ${years} tahun: ${money(total * years)}` : null,
  }
})

const saving = ref(false)
const errors = ref<string[]>([])

async function submit(): Promise<void> {
  if (saving.value) return
  saving.value = true
  errors.value = []
  try {
    const result = await createSubscription({
      schoolId: school.value?.id ?? null,
      packageTier: form.tier,
      schoolPackageId: form.packageId,
      studentQuota: quotaValue.value,
      paymentReference: form.reference || null,
      paymentNotes: form.notes || null,
    })
    flash.success(result.status)
    await router.push({ name: SUBSCRIPTION_ROUTES.detail, params: { id: result.data.id } })
  } catch (err) {
    errors.value = errorLines(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage
    title="Langganan Baru"
    subtitle="Cipta langganan baharu untuk sekolah."
    :back-to="SUBSCRIPTIONS_LIST_PATH"
    data-testid="sub-create-page"
  >
    <form
      method="post"
      class="grid grid-cols-1 items-start gap-6 xl:grid-cols-3"
      data-testid="sub-form"
      @submit.prevent="submit"
    >
      <div class="flex min-w-0 flex-col gap-6 xl:col-span-2">
        <h2 class="sr-only">Borang Langganan Baru</h2>

        <UAlert
          v-if="errors.length > 0"
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle"
          role="alert"
          data-testid="sub-form-alert"
        >
          <template #description>
            <DsStack gap="2xs">
              <p v-for="m in errors" :key="m">{{ m }}</p>
            </DsStack>
          </template>
        </UAlert>

        <DsFormSection
          title="Sekolah"
          description="Cari dan pilih sekolah untuk langganan ini."
          icon="buildings"
          :columns="2"
        >
          <div class="sm:col-span-2"><SubscriptionSchoolPicker v-model="school" /></div>
        </DsFormSection>

        <DsFormSection
          title="Pakej"
          description="Jenis pakej, tingkatan dan bilangan pelajar."
          icon="stack"
          :columns="2"
        >
          <div class="flex min-w-0 flex-col gap-3 sm:col-span-2">
            <DsText variant="label" as="p">Jenis Pakej <span class="text-error">*</span></DsText>
            <URadioGroup
              v-model="form.tier"
              :items="tierItems"
              legend="Jenis Pakej"
              name="package_tier"
              required
              variant="card"
              color="info"
              indicator="hidden"
              orientation="horizontal"
              :ui="{
                fieldset: 'grid grid-cols-1 gap-3 sm:grid-cols-2',
                item: 'min-h-11 items-center justify-center p-4 text-center',
                wrapper: 'w-full text-center',
                label: 'text-body',
                description: 'whitespace-pre-line text-label',
                legend: 'sr-only',
              }"
            />
          </div>

          <div class="flex min-w-0 flex-col gap-3 sm:col-span-2">
            <DsText variant="label" as="p">Tingkatan <span class="text-error">*</span></DsText>
            <DsLoadError
              v-if="packagesError"
              message="Tidak dapat memuatkan senarai pakej. Sila cuba semula."
              testid="sub-packages-error"
              @retry="reloadPackages()"
            />
            <DsGrid v-else-if="!packages" :cols="{ base: 1, sm: 2 }" gap="sm">
              <USkeleton v-for="n in 4" :key="n" class="h-24 w-full" />
            </DsGrid>
            <URadioGroup
              v-else
              :model-value="form.packageId ?? undefined"
              :items="packageItems"
              legend="Tingkatan"
              name="school_package_id"
              required
              variant="card"
              color="info"
              indicator="hidden"
              orientation="horizontal"
              :ui="{
                fieldset: 'grid grid-cols-1 gap-3 sm:grid-cols-2',
                item: 'min-h-11 items-center justify-center p-4 text-center',
                wrapper: 'w-full text-center',
                label: 'text-body',
                description: 'whitespace-pre-line text-label',
                legend: 'sr-only',
              }"
              data-testid="sub-packages"
              @update:model-value="(v) => (form.packageId = v as number)"
            />
          </div>

          <DsFormField native for="sub-quota" label="Bilangan Pelajar" required>
            <UInput
              id="sub-quota"
              v-model="form.quota"
              type="number"
              name="student_quota"
              required
              :min="QUOTA_MIN"
              :max="QUOTA_MAX"
              class="w-full"
              data-testid="sub-quota"
            />
          </DsFormField>
        </DsFormSection>

        <DsFormSection
          title="Pembayaran"
          description="Rujukan dan nota pembayaran."
          icon="receipt"
          :columns="2"
        >
          <DsFormField native for="sub-reference" label="Rujukan Pembayaran">
            <UInput
              id="sub-reference"
              v-model="form.reference"
              type="text"
              name="payment_reference"
              placeholder="cth: Bank transfer ref, nombor resit"
              class="w-full"
              data-testid="sub-reference"
            />
          </DsFormField>

          <div class="sm:col-span-2">
            <DsFormField native for="sub-notes" label="Nota">
              <UTextarea
                id="sub-notes"
                v-model="form.notes"
                name="payment_notes"
                :rows="3"
                placeholder="Nota tambahan (opsional)"
                class="w-full"
                data-testid="sub-notes"
              />
            </DsFormField>
          </div>
        </DsFormSection>
      </div>

      <aside class="flex min-w-0 flex-col gap-6 xl:sticky xl:top-6">
        <DsPanel padding="none">
          <div class="flex flex-col gap-4 p-4 sm:p-6">
            <DsPanel v-if="summary" tone="inset" data-testid="sub-summary">
              <DsStack gap="xs">
                <template v-if="summary.kind === 'basic'">
                  <DsText variant="body">
                    Pakej Pemantauan: <strong>PERCUMA</strong> · 500 soalan/bulan/pelajar · 1 bulan
                  </DsText>
                  <DsText variant="label" as="p" tone="muted">
                    Sekolah boleh naik taraf ke Pakej Penuh bila-bila masa.
                  </DsText>
                </template>
                <template v-else>
                  <DsText variant="body" as="span" data-testid="sub-summary-line">{{
                    summary.line
                  }}</DsText>
                  <DsText variant="title" as="span" data-testid="sub-summary-total">{{
                    summary.total
                  }}</DsText>
                  <DsText
                    v-if="summary.grand"
                    variant="label"
                    as="p"
                    tone="muted"
                    data-testid="sub-summary-grand"
                  >
                    {{ summary.grand }}
                  </DsText>
                </template>
              </DsStack>
            </DsPanel>
            <UButton
              type="submit"
              block
              icon="i-ph-check"
              label="Cipta Langganan"
              :loading="saving"
              :disabled="saving"
              data-testid="sub-submit"
            />
          </div>
        </DsPanel>
      </aside>
    </form>
  </DsPage>
</template>
