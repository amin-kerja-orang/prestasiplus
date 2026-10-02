<script setup lang="ts">
/**
 * S13 `/admin/school-subscriptions/create` "Langganan Baru - Admin PRESTASIPLUS" (M02-T9; FR-M02-84..87).
 *
 * Card "Borang Langganan Baru": school picker, tier radio cards (Pemantauan default, Penuh), package
 * radio cards from #30 (none checked), student count (1-2000, default 100), live summary (DV-M02-08:
 * basic = 500 questions / 1 month), payment reference and note. Native HTML5 validation; a server
 * `VALIDATION_ERROR` (e.g. no school or package) shows the red alert and keeps the input. Success goes
 * to the new subscription's S14 with the flash.
 */
import {
  ArrowLeft,
  Check,
  FileText,
  GraduationCap,
  Layers,
  NotebookText,
  Receipt,
  Users,
} from '@lucide/vue'
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS, FORM_TEXTAREA_CLASS } from '@/components/form'
import { useApi, useFlash } from '@/composables'

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
const form = reactive<{
  tier: PackageTier
  packageId: number | null
  quota: number | null
  reference: string
  notes: string
}>({ tier: 'basic', packageId: null, quota: 100, reference: '', notes: '' })

const {
  data: packages,
  error: packagesError,
  reload: reloadPackages,
} = useApi((signal) => fetchSchoolPackages({ signal }))

const chosen = computed(() => packages.value?.find((p) => p.id === form.packageId) ?? null)
const quotaValue = computed(() => (typeof form.quota === 'number' ? form.quota : 0))

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

const LABEL = 'mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700'
const CARD_BASE =
  'flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl border-2 p-4 text-center transition peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300'
</script>

<template>
  <div data-testid="sub-create-page">
    <form
      method="post"
      class="space-y-6 rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="sub-form"
      @submit.prevent="submit"
    >
      <h2 class="flex items-center gap-2 font-heading text-lg font-bold text-slate-800">
        <FileText class="h-5 w-5 text-purple-500" aria-hidden="true" />
        Borang Langganan Baru
      </h2>

      <AlertBox :messages="errors" data-testid="sub-form-alert" />

      <SubscriptionSchoolPicker v-model="school" />

      <fieldset>
        <legend :class="LABEL">
          <Layers class="h-4 w-4 text-purple-500" aria-hidden="true" />
          Jenis Pakej <span class="text-red-500">*</span>
        </legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="relative block">
            <input
              v-model="form.tier"
              type="radio"
              name="package_tier"
              value="basic"
              class="peer sr-only"
              data-testid="sub-tier-basic"
            />
            <span
              :class="[
                CARD_BASE,
                form.tier === 'basic'
                  ? 'border-emerald-500 bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow'
                  : 'border-slate-200 text-slate-700',
              ]"
            >
              <span class="font-heading font-bold">Pemantauan</span>
              <span class="text-sm">500 soalan/bulan · PERCUMA</span>
              <span class="text-xs">1 bulan (demo/trial)</span>
            </span>
          </label>
          <label class="relative block">
            <input
              v-model="form.tier"
              type="radio"
              name="package_tier"
              value="full"
              class="peer sr-only"
              data-testid="sub-tier-full"
            />
            <span
              :class="[
                CARD_BASE,
                form.tier === 'full'
                  ? 'border-emerald-500 bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow'
                  : 'border-slate-200 text-slate-700',
              ]"
            >
              <span class="font-heading font-bold">Penuh</span>
              <span class="text-sm">Tanpa had · RM30/pelajar</span>
              <span class="text-xs">1 tahun</span>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend :class="LABEL">
          <GraduationCap class="h-4 w-4 text-blue-500" aria-hidden="true" />
          Tingkatan <span class="text-red-500">*</span>
        </legend>
        <div v-if="packagesError" class="space-y-3" data-testid="sub-packages-error">
          <AlertBox :messages="errorLines(packagesError)" />
          <button
            type="button"
            class="inline-flex min-h-11 items-center rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-bold text-white"
            @click="reloadPackages()"
          >
            Cuba Lagi
          </button>
        </div>
        <div v-else-if="!packages" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div v-for="n in 4" :key="n" class="h-24 animate-pulse rounded-xl bg-slate-100"></div>
        </div>
        <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="sub-packages">
          <label v-for="pkg in packages" :key="pkg.id" class="relative block">
            <input
              v-model="form.packageId"
              type="radio"
              name="school_package_id"
              :value="pkg.id"
              class="peer sr-only"
              data-testid="sub-package"
            />
            <span
              :class="[
                CARD_BASE,
                form.packageId === pkg.id
                  ? 'border-blue-500 bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow'
                  : 'border-slate-200 text-slate-700',
              ]"
            >
              <span class="font-heading font-bold">{{ pkg.code }}</span>
              <span class="text-sm">{{ pkg.name }}</span>
              <span class="text-xs">{{ pkg.maxRenewals + 1 }} tahun</span>
            </span>
          </label>
        </div>
      </fieldset>

      <div>
        <label for="sub-quota" :class="LABEL">
          <Users class="h-4 w-4 text-orange-500" aria-hidden="true" />
          Bilangan Pelajar <span class="text-red-500">*</span>
        </label>
        <input
          id="sub-quota"
          v-model.number="form.quota"
          type="number"
          name="student_quota"
          required
          :min="QUOTA_MIN"
          :max="QUOTA_MAX"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="sub-quota"
        />
      </div>

      <div
        v-if="summary"
        class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800"
        data-testid="sub-summary"
      >
        <template v-if="summary.kind === 'basic'">
          <p class="text-sm">
            Pakej Pemantauan: <strong>PERCUMA</strong> · 500 soalan/bulan/pelajar · 1 bulan
          </p>
          <p class="mt-1 border-t border-amber-200 pt-1 text-xs text-amber-700">
            Sekolah boleh naik taraf ke Pakej Penuh bila-bila masa.
          </p>
        </template>
        <template v-else>
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span class="text-sm" data-testid="sub-summary-line">{{ summary.line }}</span>
            <span class="font-heading text-xl font-bold" data-testid="sub-summary-total">{{
              summary.total
            }}</span>
          </div>
          <p
            v-if="summary.grand"
            class="mt-1 border-t border-amber-200 pt-1 text-xs text-amber-700"
            data-testid="sub-summary-grand"
          >
            {{ summary.grand }}
          </p>
        </template>
      </div>

      <div>
        <label for="sub-reference" :class="LABEL">
          <Receipt class="h-4 w-4 text-emerald-500" aria-hidden="true" />
          Rujukan Pembayaran
        </label>
        <input
          id="sub-reference"
          v-model="form.reference"
          type="text"
          name="payment_reference"
          placeholder="cth: Bank transfer ref, nombor resit"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="sub-reference"
        />
      </div>

      <div>
        <label for="sub-notes" :class="LABEL">
          <NotebookText class="h-4 w-4 text-slate-500" aria-hidden="true" />
          Nota
        </label>
        <textarea
          id="sub-notes"
          v-model="form.notes"
          name="payment_notes"
          rows="3"
          placeholder="Nota tambahan (opsional)"
          :class="FORM_TEXTAREA_CLASS"
          data-testid="sub-notes"
        ></textarea>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <RouterLink
          :to="SUBSCRIPTIONS_LIST_PATH"
          class="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 transition hover:text-slate-700"
          data-testid="sub-back"
        >
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          Kembali
        </RouterLink>
        <button
          type="submit"
          :disabled="saving"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow transition hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-wait disabled:opacity-60"
          data-testid="sub-submit"
        >
          <Check class="h-4 w-4" aria-hidden="true" />
          Cipta Langganan
        </button>
      </div>
    </form>
  </div>
</template>
