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

import { AdminCard, AdminFormSection, AdminPageHeader } from '@/ds/admin'
import { useApi, useFlash } from '@/composables'
import { DsPage } from '@/ds'

import type { SchoolSummary } from '../api/schools'
import { createSubscription, fetchSchoolPackages, type PackageTier } from '../api/subscriptions'
import AdminAlert from '../components/AdminAlert.vue'
import AdminField from '../components/AdminField.vue'
import NativeChoice from '../components/native/NativeChoice.vue'
import NativePanel from '../components/native/NativePanel.vue'
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
  <DsPage data-testid="sub-create-page">
    <AdminPageHeader title="Langganan Baru" subtitle="Cipta langganan baharu untuk sekolah.">
      <template #actions>
        <UButton
          :to="SUBSCRIPTIONS_LIST_PATH"
          color="neutral"
          variant="soft"
          icon="i-ph-arrow-left"
          label="Kembali"
          data-testid="sub-back"
        />
      </template>
    </AdminPageHeader>

    <form
      method="post"
      class="grid grid-cols-1 items-start gap-6 xl:grid-cols-3"
      data-testid="sub-form"
      @submit.prevent="submit"
    >
      <div class="flex min-w-0 flex-col gap-6 xl:col-span-2">
        <h2 class="sr-only">Borang Langganan Baru</h2>

        <AdminAlert :messages="errors" data-testid="sub-form-alert" />

        <AdminFormSection
          title="Sekolah"
          description="Cari dan pilih sekolah untuk langganan ini."
          icon="i-ph-buildings"
        >
          <div class="md:col-span-2"><SubscriptionSchoolPicker v-model="school" /></div>
        </AdminFormSection>

        <AdminFormSection
          title="Pakej"
          description="Jenis pakej, tingkatan dan bilangan pelajar."
          icon="i-ph-stack"
        >
          <fieldset class="flex min-w-0 flex-col gap-3 md:col-span-2">
            <legend class="mb-3 text-label text-default">
              Jenis Pakej <span class="text-error">*</span>
            </legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NativeChoice
                v-model="form.tier"
                name="package_tier"
                value="basic"
                input-testid="sub-tier-basic"
              >
                <span class="flex flex-col items-center gap-1 py-1">
                  <span class="text-body">Pemantauan</span>
                  <span class="text-label">500 soalan/bulan · PERCUMA</span>
                  <span class="text-label">1 bulan (demo/trial)</span>
                </span>
              </NativeChoice>
              <NativeChoice
                v-model="form.tier"
                name="package_tier"
                value="full"
                input-testid="sub-tier-full"
              >
                <span class="flex flex-col items-center gap-1 py-1">
                  <span class="text-body">Penuh</span>
                  <span class="text-label">Tanpa had · RM30/pelajar</span>
                  <span class="text-label">1 tahun</span>
                </span>
              </NativeChoice>
            </div>
          </fieldset>

          <fieldset class="flex min-w-0 flex-col gap-3 md:col-span-2">
            <legend class="mb-3 text-label text-default">
              Tingkatan <span class="text-error">*</span>
            </legend>
            <div v-if="packagesError" class="flex flex-col gap-4" data-testid="sub-packages-error">
              <AdminAlert :messages="errorLines(packagesError)" />
              <div>
                <UButton label="Cuba Lagi" @click="reloadPackages()" />
              </div>
            </div>
            <div v-else-if="!packages" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <USkeleton v-for="n in 4" :key="n" class="h-24 w-full" />
            </div>
            <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="sub-packages">
              <NativeChoice
                v-for="pkg in packages"
                :key="pkg.id"
                v-model="form.packageId"
                name="school_package_id"
                :value="pkg.id"
                input-testid="sub-package"
              >
                <span class="flex flex-col items-center gap-1 py-1">
                  <span class="text-body">{{ pkg.code }}</span>
                  <span class="text-label">{{ pkg.name }}</span>
                  <span class="text-label">{{ pkg.maxRenewals + 1 }} tahun</span>
                </span>
              </NativeChoice>
            </div>
          </fieldset>

          <AdminField for="sub-quota" label="Bilangan Pelajar" icon="i-ph-users" required>
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
          </AdminField>
        </AdminFormSection>

        <AdminFormSection
          title="Pembayaran"
          description="Rujukan dan nota pembayaran."
          icon="i-ph-receipt"
        >
          <AdminField for="sub-reference" label="Rujukan Pembayaran" icon="i-ph-receipt">
            <UInput
              id="sub-reference"
              v-model="form.reference"
              type="text"
              name="payment_reference"
              placeholder="cth: Bank transfer ref, nombor resit"
              class="w-full"
              data-testid="sub-reference"
            />
          </AdminField>

          <div class="md:col-span-2">
            <AdminField for="sub-notes" label="Nota" icon="i-ph-note">
              <UTextarea
                id="sub-notes"
                v-model="form.notes"
                name="payment_notes"
                :rows="3"
                placeholder="Nota tambahan (opsional)"
                class="w-full"
                data-testid="sub-notes"
              />
            </AdminField>
          </div>
        </AdminFormSection>
      </div>

      <aside class="flex min-w-0 flex-col gap-6 xl:sticky xl:top-6">
        <AdminCard class="flex flex-col gap-4">
          <NativePanel
            v-if="summary"
            tone="soft"
            class="flex flex-col gap-2 p-4"
            data-testid="sub-summary"
          >
            <template v-if="summary.kind === 'basic'">
              <p class="text-body text-default">
                Pakej Pemantauan: <strong>PERCUMA</strong> · 500 soalan/bulan/pelajar · 1 bulan
              </p>
              <p class="text-label text-muted">
                Sekolah boleh naik taraf ke Pakej Penuh bila-bila masa.
              </p>
            </template>
            <template v-else>
              <span class="text-body text-default" data-testid="sub-summary-line">{{
                summary.line
              }}</span>
              <span class="text-title text-highlighted" data-testid="sub-summary-total">{{
                summary.total
              }}</span>
              <p v-if="summary.grand" class="text-label text-muted" data-testid="sub-summary-grand">
                {{ summary.grand }}
              </p>
            </template>
          </NativePanel>
          <UButton
            type="submit"
            block
            icon="i-ph-check"
            label="Cipta Langganan"
            :loading="saving"
            :disabled="saving"
            data-testid="sub-submit"
          />
        </AdminCard>
      </aside>
    </form>
  </DsPage>
</template>
