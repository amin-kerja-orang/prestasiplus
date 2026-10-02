<script setup lang="ts">
/**
 * S14 `/admin/school-subscriptions/:id` "Langganan {school} - Admin PRESTASIPLUS" (M02-T9; FR-M02-88..96).
 *
 * Summary card (quota bar, tier box and tiles, note), the "Tindakan" card (Ubah Kuota, Cetak Invoice,
 * Naik Taraf ke Penuh for basic only, Batalkan, Lanjutkan Tempoh; the three panels toggle independently)
 * and "Senarai Pelajar ({total})" with the "Tunjuk" page size and the Laravel pager (`?per_page=&page=`).
 * Every mutation replaces the page data with the API result and shows the API `status` as the flash;
 * a dismissed native confirm sends nothing. Native HTML5 validation only.
 */
import {
  ArrowLeft,
  ArrowUp,
  CalendarPlus,
  CircleAlert,
  Eye,
  Infinity as InfinityIcon,
  Info,
  Printer,
  Save,
  SlidersHorizontal,
  StickyNote,
  Users,
  X,
} from '@lucide/vue'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { LaravelPager, TABLE_CLASSES as T, DataTableCard } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { confirmNative } from '@/components/overlay'
import { useApi, useFlash, usePageMeta } from '@/composables'
import { formatDate, formatDateTime } from '@/lib/time'
import { formatNumber } from '@/lib/number'

import {
  cancelSubscription,
  extendSubscription,
  fetchSubscription,
  fetchSubscriptionStudents,
  SUBSCRIPTION_PER_PAGE_OPTIONS,
  updateSubscriptionQuota,
  upgradeSubscription,
  type SubscriptionMutation,
} from '../api/subscriptions'
import { errorLines } from '../lib/school-errors'
import {
  barClass,
  isNotFound,
  EXTEND_PRESETS,
  money,
  QUOTA_MAX,
  QUOTA_MIN,
  STATUS_BADGE,
  SUBSCRIPTION_ROUTES,
  SUBSCRIPTIONS_LIST_PATH,
  TIER_LABEL,
} from '../lib/subscription-options'

const props = defineProps<{ id: number }>()

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const pageMeta = usePageMeta()

function queryText(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value
  return first ?? ''
}

const {
  data: sub,
  error: loadError,
  reload: reloadSub,
} = useApi(
  (signal) => fetchSubscription(props.id, { signal }),
  () => props.id,
)

watch(
  sub,
  (row) => {
    if (!row) return
    pageMeta.setHeader({ title: 'Detail Langganan', subtitle: row.school.name })
    pageMeta.setTitle(`Langganan ${row.school.name} - Admin PRESTASIPLUS`)
  },
  { immediate: true },
)

watch(
  () => isNotFound(loadError.value),
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

// Students: `?per_page=` and `?page=` (S14 query parameters).
const perPageQuery = computed(() => Number.parseInt(queryText(route.query.per_page), 10) || null)
const pageQuery = computed(() => Math.max(1, Number.parseInt(queryText(route.query.page), 10) || 1))
const {
  data: students,
  error: studentsError,
  reload: reloadStudents,
} = useApi(
  (signal) =>
    fetchSubscriptionStudents(props.id, {
      perPage: perPageQuery.value,
      page: pageQuery.value,
      signal,
    }),
  [() => props.id, () => route.query.per_page, () => route.query.page],
)

const meta = computed(() => students.value?.meta ?? null)
const total = computed(() => meta.value?.totalItems ?? 0)
const pageSize = computed(() => meta.value?.pageSize ?? 50)
const firstNo = computed(() => (total.value === 0 ? 0 : (pageQuery.value - 1) * pageSize.value + 1))
const lastNo = computed(() =>
  Math.min(
    total.value,
    (pageQuery.value - 1) * pageSize.value + (students.value?.data.length ?? 0),
  ),
)

function onPerPage(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  void router.push({ path: route.path, query: { per_page: value } })
}

const pagerQuery = computed(() => ({
  per_page: perPageQuery.value === null ? '' : String(pageSize.value),
}))
function goToPage(page: number): void {
  const query: Record<string, string> = {}
  if (perPageQuery.value !== null) query.per_page = String(pageSize.value)
  void router.push({ path: route.path, query: { ...query, page: String(page) } })
}

// Actions ------------------------------------------------------------------------------------
const open = reactive({ quota: false, extend: false, upgrade: false })
const quotaForm = reactive<{ quota: number | null; notes: string }>({ quota: null, notes: '' })
const extendForm = reactive<{ days: number | null; reason: string }>({ days: null, reason: '' })
const upgradeForm = reactive({ reference: '', notes: '' })
const alertBox = ref<HTMLElement | null>(null)
const busy = ref(false)
const errors = ref<string[]>([])

function toggleQuota(): void {
  open.quota = !open.quota
  if (open.quota && sub.value) quotaForm.quota = sub.value.studentQuota
}

async function run(action: () => Promise<SubscriptionMutation>): Promise<boolean> {
  if (busy.value) return false
  busy.value = true
  errors.value = []
  try {
    const result = await action()
    sub.value = result.data
    flash.show({ type: 'success', message: result.status })
    // The student list follows the school, not the subscription; a quota change leaves it untouched.
    return true
  } catch (err) {
    errors.value = errorLines(err)
    await nextTick()
    alertBox.value?.scrollIntoView?.({ block: 'start' })
    return false
  } finally {
    busy.value = false
  }
}

async function saveQuota(): Promise<void> {
  if (quotaForm.quota === null) return
  const ok = await run(() =>
    updateSubscriptionQuota(props.id, {
      studentQuota: quotaForm.quota ?? 0,
      notes: quotaForm.notes || null,
    }),
  )
  if (ok) {
    open.quota = false
    quotaForm.notes = ''
  }
}

async function confirmUpgrade(): Promise<void> {
  if (!confirmNative('Naik taraf ke Pakej Penuh? Ini akan menukar langganan ke tanpa had soalan.'))
    return
  const ok = await run(() =>
    upgradeSubscription(props.id, {
      paymentReference: upgradeForm.reference || null,
      paymentNotes: upgradeForm.notes || null,
    }),
  )
  if (ok) {
    open.upgrade = false
    upgradeForm.reference = ''
    upgradeForm.notes = ''
  }
}

async function cancel(): Promise<void> {
  if (!confirmNative('Adakah anda pasti mahu batalkan langganan ini?')) return
  await run(() => cancelSubscription(props.id))
}

async function extend(): Promise<void> {
  if (extendForm.days === null) return
  if (!confirmNative('Lanjutkan tempoh langganan?')) return
  const ok = await run(() =>
    extendSubscription(props.id, { days: extendForm.days ?? 0, reason: extendForm.reason || null }),
  )
  if (ok) {
    open.extend = false
    extendForm.days = null
    extendForm.reason = ''
  }
}

const BTN =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-wait disabled:opacity-60'
const TILE = 'rounded-xl p-3 text-center'
const PANEL_INPUT = [FORM_INPUT_CLASS, 'min-h-11']
</script>

<template>
  <div class="space-y-4 sm:space-y-6" data-testid="sub-detail-page">
    <RouterLink
      :to="SUBSCRIPTIONS_LIST_PATH"
      class="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 transition hover:text-slate-700"
      data-testid="sub-list-back"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" />
      Senarai Langganan
    </RouterLink>

    <div v-if="loadError && !isNotFound(loadError)" class="space-y-3" data-testid="sub-load-error">
      <AlertBox :messages="errorLines(loadError)" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-bold text-white"
        @click="reloadSub()"
      >
        Cuba Lagi
      </button>
    </div>

    <div v-else-if="!sub" class="space-y-4" data-testid="sub-skeleton">
      <div class="h-64 animate-pulse rounded-2xl bg-white shadow"></div>
      <div class="h-40 animate-pulse rounded-2xl bg-white shadow"></div>
    </div>

    <template v-else>
      <div ref="alertBox" class="scroll-mt-4">
        <AlertBox :messages="errors" data-testid="sub-action-alert" />
      </div>

      <!-- Summary card -->
      <section class="rounded-2xl bg-white p-5 shadow sm:p-6" data-testid="sub-summary-card">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h3
              class="font-heading text-lg font-bold break-words text-slate-900"
              data-testid="sub-school"
            >
              {{ sub.school.name }}
            </h3>
            <p class="text-sm text-slate-500" data-testid="sub-code">
              {{ sub.school.code }} · {{ sub.package.name }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold',
                sub.packageTier === 'basic'
                  ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700',
              ]"
              data-testid="sub-tier"
            >
              <Eye v-if="sub.packageTier === 'basic'" class="h-4 w-4" aria-hidden="true" />
              <InfinityIcon v-else class="h-4 w-4" aria-hidden="true" />
              {{ TIER_LABEL[sub.packageTier] }}
            </span>
            <span
              :class="[
                'rounded-full px-3 py-1 text-sm font-semibold',
                STATUS_BADGE[sub.status].cls,
              ]"
              data-testid="sub-status"
              >{{ STATUS_BADGE[sub.status].label }}</span
            >
          </div>
        </div>

        <div class="mt-5">
          <div class="flex items-center justify-between gap-3 text-sm">
            <span class="flex items-center gap-2 font-semibold text-slate-700">
              <Users class="h-4 w-4 text-indigo-500" aria-hidden="true" />
              Kuota Pelajar
            </span>
            <span class="font-semibold text-slate-800" data-testid="sub-usage"
              >{{ sub.used }} / {{ sub.studentQuota }}</span
            >
          </div>
          <div class="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              :class="['h-full rounded-full', barClass(sub.usedPercent)]"
              :style="{ width: `${sub.usedPercent}%` }"
              data-testid="sub-bar"
            ></div>
          </div>
          <div class="mt-1 flex justify-between text-xs text-slate-500">
            <span data-testid="sub-percent">{{ sub.usedPercent }}% digunakan</span>
            <span data-testid="sub-remaining">Baki: {{ sub.remaining }} pelajar</span>
          </div>
        </div>

        <div
          v-if="sub.packageTier === 'basic'"
          class="mt-5 flex items-center gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4"
          data-testid="sub-basic-box"
        >
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-600"
          >
            <Eye class="h-5 w-5" aria-hidden="true" />
          </span>
          <div class="min-w-0 text-sm">
            <p class="font-semibold text-slate-800">Pakej Pemantauan</p>
            <p class="break-words text-cyan-700">
              {{ sub.questionLimit ?? 500 }} soalan/bulan/pelajar · PERCUMA · Tamat
              {{ formatDate(sub.endsAt) }}
            </p>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="sub-tiles">
          <div :class="[TILE, 'bg-slate-50']">
            <p class="text-xs text-slate-500">Mula</p>
            <p class="font-heading font-bold text-slate-800">{{ formatDate(sub.startsAt) }}</p>
          </div>
          <div :class="[TILE, 'bg-slate-50']">
            <p class="text-xs text-slate-500">Tamat</p>
            <p class="font-heading font-bold text-slate-800">{{ formatDate(sub.endsAt) }}</p>
          </div>
          <template v-if="sub.packageTier === 'basic'">
            <div :class="[TILE, 'bg-cyan-50']">
              <p class="text-xs text-cyan-600">Had Soalan</p>
              <p class="font-heading font-bold text-cyan-700">
                {{ sub.questionLimit ?? 500 }}/bulan
              </p>
            </div>
            <div :class="[TILE, 'bg-cyan-50']">
              <p class="text-xs text-cyan-600">Kos</p>
              <p class="font-heading font-bold text-cyan-700">PERCUMA</p>
            </div>
          </template>
          <template v-else>
            <div :class="[TILE, 'bg-emerald-50']">
              <p class="text-xs text-emerald-600">Harga / Pelajar</p>
              <p class="font-heading font-bold text-emerald-700" data-testid="sub-price">
                {{ money(sub.package.priceAnnual) }}
              </p>
            </div>
            <div :class="[TILE, 'bg-emerald-50']">
              <p class="text-xs text-emerald-600">Jumlah</p>
              <p class="font-heading font-bold text-emerald-700" data-testid="sub-total">
                {{ money(sub.studentQuota * Number(sub.package.priceAnnual)) }}
              </p>
            </div>
          </template>
        </div>

        <p
          v-if="sub.notes"
          class="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          data-testid="sub-notes"
        >
          <StickyNote class="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <span class="min-w-0 break-words whitespace-pre-line"
            ><strong>Nota:</strong> {{ sub.notes }}</span
          >
        </p>
      </section>

      <!-- Actions -->
      <section class="rounded-2xl bg-white p-5 shadow sm:p-6" data-testid="sub-actions">
        <h3 class="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-slate-800">
          <SlidersHorizontal class="h-5 w-5 text-indigo-500" aria-hidden="true" />
          Tindakan
        </h3>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            :class="[BTN, 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100']"
            data-testid="sub-toggle-quota"
            @click="toggleQuota"
          >
            <SlidersHorizontal class="h-4 w-4" aria-hidden="true" />
            Ubah Kuota
          </button>
          <RouterLink
            :to="{ name: SUBSCRIPTION_ROUTES.invoice, params: { id: sub.id } }"
            :class="[BTN, 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100']"
            data-testid="sub-invoice"
          >
            <Printer class="h-4 w-4" aria-hidden="true" />
            Cetak Invoice
          </RouterLink>
          <button
            v-if="sub.packageTier === 'basic'"
            type="button"
            :class="[BTN, 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100']"
            data-testid="sub-toggle-upgrade"
            @click="open.upgrade = !open.upgrade"
          >
            <ArrowUp class="h-4 w-4" aria-hidden="true" />
            Naik Taraf ke Penuh
          </button>
          <button
            type="button"
            :disabled="busy"
            :class="[BTN, 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100']"
            data-testid="sub-cancel"
            @click="cancel"
          >
            <X class="h-4 w-4" aria-hidden="true" />
            Batalkan
          </button>
        </div>
        <div class="mt-2">
          <button
            type="button"
            :class="[BTN, 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700']"
            data-testid="sub-toggle-extend"
            @click="open.extend = !open.extend"
          >
            <CalendarPlus class="h-4 w-4" aria-hidden="true" />
            Lanjutkan Tempoh
          </button>
        </div>

        <!-- Ubah Kuota -->
        <form
          v-if="open.quota"
          method="post"
          class="mt-4 space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4"
          data-testid="sub-quota-form"
          @submit.prevent="saveQuota"
        >
          <div class="flex flex-wrap items-center gap-3">
            <label for="sub-new-quota" class="text-sm font-semibold text-slate-700"
              >Kuota baru:</label
            >
            <input
              id="sub-new-quota"
              v-model.number="quotaForm.quota"
              type="number"
              name="student_quota"
              required
              :min="QUOTA_MIN"
              :max="QUOTA_MAX"
              :class="[PANEL_INPUT, 'w-32']"
              data-testid="sub-quota-input"
            />
          </div>
          <input
            v-model="quotaForm.notes"
            type="text"
            name="notes"
            placeholder="Sebab perubahan (opsional)"
            :class="PANEL_INPUT"
            data-testid="sub-quota-notes"
          />
          <button
            type="submit"
            :disabled="busy"
            :class="[BTN, 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700']"
            data-testid="sub-quota-save"
          >
            <Save class="h-4 w-4" aria-hidden="true" />
            Simpan
          </button>
        </form>

        <!-- Lanjutkan Tempoh -->
        <form
          v-if="open.extend"
          method="post"
          class="mt-4 space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4"
          data-testid="sub-extend-form"
          @submit.prevent="extend"
        >
          <p class="flex items-center gap-2 text-sm text-blue-700" data-testid="sub-extend-current">
            <Info class="h-4 w-4 shrink-0" aria-hidden="true" />
            Tamat semasa: {{ formatDateTime(sub.endsAt) }}
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-semibold text-slate-700">Tambah:</span>
            <button
              v-for="preset in EXTEND_PRESETS"
              :key="preset.days"
              type="button"
              class="min-h-11 rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 lg:min-h-0"
              data-testid="sub-extend-preset"
              @click="extendForm.days = preset.days"
            >
              {{ preset.label }}
            </button>
          </div>
          <div class="flex items-center gap-3">
            <input
              v-model.number="extendForm.days"
              type="number"
              name="days"
              required
              min="1"
              max="365"
              :class="[PANEL_INPUT, 'w-28']"
              data-testid="sub-extend-days"
            />
            <span class="text-sm text-blue-700">hari</span>
          </div>
          <input
            v-model="extendForm.reason"
            type="text"
            name="reason"
            placeholder="Sebab lanjutan (opsional)"
            :class="PANEL_INPUT"
            data-testid="sub-extend-reason"
          />
          <button
            type="submit"
            :disabled="busy"
            :class="[BTN, 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700']"
            data-testid="sub-extend-submit"
          >
            <CalendarPlus class="h-4 w-4" aria-hidden="true" />
            Lanjutkan
          </button>
        </form>

        <!-- Naik Taraf ke Penuh -->
        <form
          v-if="open.upgrade && sub.packageTier === 'basic'"
          method="post"
          class="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
          data-testid="sub-upgrade-form"
          @submit.prevent="confirmUpgrade"
        >
          <p class="flex items-start gap-2 text-sm text-amber-800" data-testid="sub-upgrade-text">
            <CircleAlert class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span
              >Naik taraf dari
              <strong>Pemantauan ({{ sub.questionLimit ?? 500 }} soalan/bulan)</strong> ke
              <strong>Penuh (Tanpa Had)</strong>. Langganan akan dilanjutkan 1 tahun dari sekarang
              dengan harga {{ money(sub.package.priceAnnual) }}/pelajar.</span
            >
          </p>
          <input
            v-model="upgradeForm.reference"
            type="text"
            name="payment_reference"
            placeholder="Rujukan pembayaran (opsional)"
            :class="PANEL_INPUT"
            data-testid="sub-upgrade-reference"
          />
          <input
            v-model="upgradeForm.notes"
            type="text"
            name="payment_notes"
            placeholder="Nota (opsional)"
            :class="PANEL_INPUT"
            data-testid="sub-upgrade-notes"
          />
          <button
            type="submit"
            :disabled="busy"
            :class="[BTN, 'border-orange-500 bg-orange-500 text-white hover:bg-orange-600']"
            data-testid="sub-upgrade-submit"
          >
            <ArrowUp class="h-4 w-4" aria-hidden="true" />
            Sahkan Naik Taraf
          </button>
        </form>
      </section>

      <!-- Students -->
      <section class="space-y-3" data-testid="sub-students">
        <DataTableCard :min-width="480">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <h3 class="flex items-center gap-2 font-heading text-lg font-bold text-slate-800">
                <Users class="h-5 w-5 text-indigo-500" aria-hidden="true" />
                Senarai Pelajar ({{ formatNumber(total) }})
              </h3>
              <div class="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <label for="sub-per-page">Tunjuk</label>
                <select
                  id="sub-per-page"
                  :value="pageSize"
                  :class="[FORM_INPUT_CLASS, 'min-h-11 w-auto py-1.5']"
                  data-testid="sub-per-page"
                  @change="onPerPage"
                >
                  <option v-for="n in SUBSCRIPTION_PER_PAGE_OPTIONS" :key="n" :value="n">
                    {{ n }}
                  </option>
                </select>
                <span data-testid="sub-range"
                  >perbarisan · Memaparkan {{ firstNo }}-{{ lastNo }} dari {{ total }}</span
                >
              </div>
            </div>
          </template>

          <div v-if="studentsError" class="space-y-3 p-4" data-testid="sub-students-error">
            <AlertBox :messages="errorLines(studentsError)" />
            <button
              type="button"
              class="inline-flex min-h-11 items-center rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-bold text-white"
              @click="reloadStudents()"
            >
              Cuba Lagi
            </button>
          </div>
          <table v-else :class="T.table" data-testid="sub-students-table">
            <thead>
              <tr>
                <th scope="col" :class="T.th">#</th>
                <th scope="col" :class="T.th">Nama</th>
                <th scope="col" :class="T.th">Email ID Delima</th>
                <th scope="col" :class="T.th">Tingkatan</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="!students">
                <tr v-for="n in 5" :key="n" :class="T.row">
                  <td v-for="c in 4" :key="c" :class="T.td">
                    <div class="h-4 w-full max-w-32 animate-pulse rounded bg-slate-100"></div>
                  </td>
                </tr>
              </template>
              <template v-else>
                <tr
                  v-for="(student, i) in students.data"
                  :key="student.id"
                  :class="T.row"
                  data-testid="sub-student-row"
                >
                  <td :class="[T.td, 'text-slate-400']">{{ firstNo + i }}</td>
                  <td :class="T.td">{{ student.name }}</td>
                  <td :class="[T.td, 'break-all']">{{ student.idDelima }}</td>
                  <td :class="[T.td, 'whitespace-nowrap']">{{ student.classLevel }}</td>
                </tr>
              </template>
            </tbody>
          </table>

          <template #footer>
            <div class="border-t border-slate-100 px-4 py-3 empty:hidden" data-testid="sub-pager">
              <LaravelPager
                v-if="students"
                :page="pageQuery"
                :total="total"
                :per-page="pageSize"
                :path="route.path"
                :query="pagerQuery"
                @change="goToPage"
              />
            </div>
          </template>
        </DataTableCard>
      </section>
    </template>
  </div>
</template>
