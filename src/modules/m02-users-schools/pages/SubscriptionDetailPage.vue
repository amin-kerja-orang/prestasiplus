<script setup lang="ts">
/**
 * S14 `/admin/school-subscriptions/:id` "Langganan {school} - Admin PRESTASIPLUS" (M02-T9; FR-M02-88..96),
 * v2 staff theme.
 *
 * Summary card (quota bar, tier box and tiles, note), the "Tindakan" card (Ubah Kuota, Cetak Invoice,
 * Naik Taraf ke Penuh for basic only, Batalkan, Lanjutkan Tempoh; the three panels toggle independently)
 * and "Senarai Pelajar ({total})" with the "Tunjuk" page size and the pager (`?per_page=&page=`).
 * Every mutation replaces the page data with the API result and shows the API `status` as the flash;
 * a dismissed confirm (`useConfirm`, same BM text as the native confirm) sends nothing. Native HTML5
 * validation only.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, useFlash, usePageMeta } from '@/composables'
import {
  DsDataTable,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStatRow,
  DsStatusBadge,
  type StatItem,
  useConfirm,
} from '@/ds'
import { formatNumber } from '@/lib/number'
import { formatDate, formatDateTime } from '@/lib/time'

import {
  cancelSubscription,
  extendSubscription,
  fetchSubscription,
  fetchSubscriptionStudents,
  SUBSCRIPTION_PER_PAGE_OPTIONS,
  updateSubscriptionQuota,
  upgradeSubscription,
  type SubscriptionMutation,
  type SubscriptionStudent,
} from '../api/subscriptions'
import { errorLines } from '../lib/school-errors'
import {
  barColor,
  EXTEND_PRESETS,
  isNotFound,
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
const confirm = useConfirm()
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

function goToPage(page: number): void {
  const query: Record<string, string> = {}
  if (perPageQuery.value !== null) query.per_page = String(pageSize.value)
  void router.push({ path: route.path, query: { ...query, page: String(page) } })
}

// Actions ------------------------------------------------------------------------------------
const open = reactive({ quota: false, extend: false, upgrade: false })
const quotaForm = reactive<{ quota: string; notes: string }>({
  quota: '',
  notes: '',
})
const extendForm = reactive<{ days: string; reason: string }>({
  days: '',
  reason: '',
})
const upgradeForm = reactive({ reference: '', notes: '' })
const alertBox = ref<HTMLElement | null>(null)
const busy = ref(false)
const errors = ref<string[]>([])

function toggleQuota(): void {
  open.quota = !open.quota
  if (open.quota && sub.value) quotaForm.quota = String(sub.value.studentQuota)
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
  if (quotaForm.quota === '') return
  const ok = await run(() =>
    updateSubscriptionQuota(props.id, {
      studentQuota: Number(quotaForm.quota),
      notes: quotaForm.notes || null,
    }),
  )
  if (ok) {
    open.quota = false
    quotaForm.notes = ''
  }
}

async function confirmUpgrade(): Promise<void> {
  if (
    !(await confirm({
      message: 'Naik taraf ke Pakej Penuh? Ini akan menukar langganan ke tanpa had soalan.',
    }))
  )
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
  if (
    !(await confirm({ message: 'Adakah anda pasti mahu batalkan langganan ini?', tone: 'danger' }))
  )
    return
  await run(() => cancelSubscription(props.id))
}

async function extend(): Promise<void> {
  if (extendForm.days === '') return
  if (!(await confirm({ message: 'Lanjutkan tempoh langganan?' }))) return
  const ok = await run(() =>
    extendSubscription(props.id, {
      days: Number(extendForm.days),
      reason: extendForm.reason || null,
    }),
  )
  if (ok) {
    open.extend = false
    extendForm.days = ''
    extendForm.reason = ''
  }
}

type StudentRow = SubscriptionStudent & Record<string, unknown>
const studentRows = computed(() => (students.value?.data ?? []) as StudentRow[])
const STUDENT_COLUMNS: TableColumn<StudentRow>[] = [
  { id: 'no', header: '#' },
  { accessorKey: 'name', header: 'Nama' },
  { id: 'email', header: 'Email ID Delima' },
  { id: 'level', header: 'Tingkatan' },
]
/** The four detail tiles; the keys give the test ids `sub-start`, `sub-end`, `sub-price`... */
const tiles = computed<StatItem[]>(() => {
  const s = sub.value
  if (!s) return []
  const head: StatItem[] = [
    { key: 'start', label: 'Mula', value: formatDate(s.startsAt), icon: 'calendar-check' },
    { key: 'end', label: 'Tamat', value: formatDate(s.endsAt), icon: 'calendar-x', accent: 'heat' },
  ]
  return s.packageTier === 'basic'
    ? [
        ...head,
        {
          key: 'limit',
          label: 'Had Soalan',
          value: `${String(s.questionLimit ?? 500)}/bulan`,
          icon: 'question',
          accent: 'trial',
        },
        { key: 'cost', label: 'Kos', value: 'PERCUMA', icon: 'gift', accent: 'win' },
      ]
    : [
        ...head,
        {
          key: 'price',
          label: 'Harga / Pelajar',
          value: money(s.package.priceAnnual),
          icon: 'tag',
          accent: 'trial',
        },
        {
          key: 'total',
          label: 'Jumlah',
          value: money(s.studentQuota * Number(s.package.priceAnnual)),
          icon: 'coins',
          accent: 'win',
        },
      ]
})
</script>

<template>
  <DsPage
    back-label="Senarai Langganan"
    title="Langganan Sekolah"
    subtitle="Butiran langganan, kuota dan senarai pelajar."
    :back-to="SUBSCRIPTIONS_LIST_PATH"
    data-testid="sub-detail-page"
  >
    <DsLoadError
      v-if="loadError && !isNotFound(loadError)"
      message="Tidak dapat memuatkan langganan. Sila cuba semula."
      testid="sub-load-error"
      @retry="reloadSub()"
    />

    <div v-else-if="!sub" class="flex flex-col gap-4" data-testid="sub-skeleton">
      <USkeleton class="h-64 w-full" />
      <USkeleton class="h-40 w-full" />
    </div>

    <template v-else>
      <div ref="alertBox">
        <UAlert
          v-if="errors.length > 0"
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle"
          role="alert"
          data-testid="sub-action-alert"
        >
          <template #description>
            <div class="flex flex-col gap-1">
              <p v-for="m in errors" :key="m">{{ m }}</p>
            </div>
          </template>
        </UAlert>
      </div>

      <!-- Summary card -->
      <DsPanel flush data-testid="sub-summary-card">
        <div class="p-4 sm:p-6">
          <div class="flex flex-col gap-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="text-heading break-words text-highlighted" data-testid="sub-school">
                  {{ sub.school.name }}
                </h3>
                <p class="text-label text-muted" data-testid="sub-code">
                  {{ sub.school.code }} · {{ sub.package.name }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <UBadge
                  color="neutral"
                  variant="subtle"
                  :icon="sub.packageTier === 'basic' ? 'i-ph-eye' : 'i-ph-infinity'"
                  :label="TIER_LABEL[sub.packageTier]"
                  data-testid="sub-tier"
                />
                <DsStatusBadge
                  :status="STATUS_BADGE[sub.status].status"
                  :label="STATUS_BADGE[sub.status].label"
                  data-testid="sub-status"
                />
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-3 text-label">
                <span class="flex items-center gap-2 text-default">
                  <UIcon name="i-ph-users" class="size-4 text-muted" aria-hidden="true" />
                  Kuota Pelajar
                </span>
                <span class="text-highlighted" data-testid="sub-usage"
                  >{{ sub.used }} / {{ sub.studentQuota }}</span
                >
              </div>
              <UProgress
                :model-value="sub.usedPercent"
                :color="barColor(sub.usedPercent)"
                :aria-label="`Kuota digunakan ${String(sub.usedPercent)}%`"
                data-testid="sub-bar"
              />
              <div class="flex justify-between text-caption text-muted">
                <span data-testid="sub-percent">{{ sub.usedPercent }}% digunakan</span>
                <span data-testid="sub-remaining">Baki: {{ sub.remaining }} pelajar</span>
              </div>
            </div>

            <DsPanel v-if="sub.packageTier === 'basic'" tone="inset" data-testid="sub-basic-box">
              <div class="flex items-center gap-3">
                <UIcon name="i-ph-eye" class="size-6 shrink-0 text-muted" aria-hidden="true" />
                <div class="min-w-0 text-label">
                  <p class="text-highlighted">Pakej Pemantauan</p>
                  <p class="break-words text-muted">
                    {{ sub.questionLimit ?? 500 }} soalan/bulan/pelajar · PERCUMA · Tamat
                    {{ formatDate(sub.endsAt) }}
                  </p>
                </div>
              </div>
            </DsPanel>

            <DsStatRow
              prefix="sub"
              :items="tiles"
              compact
              :cols="4"
              aria-label="Butiran langganan"
              data-testid="sub-tiles"
            />

            <DsPanel v-if="sub.notes" tone="inset" data-testid="sub-notes">
              <div class="flex items-start gap-2 text-label text-default">
                <UIcon
                  name="i-ph-note"
                  class="mt-1 size-4 shrink-0 text-muted"
                  aria-hidden="true"
                />
                <span class="min-w-0 break-words whitespace-pre-line"
                  ><strong>Nota:</strong> {{ sub.notes }}</span
                >
              </div>
            </DsPanel>
          </div>
        </div>
      </DsPanel>

      <!-- Actions -->
      <DsPanel flush data-testid="sub-actions">
        <div class="p-4 sm:p-6">
          <div class="flex flex-col gap-4">
            <h3 class="flex items-center gap-2 text-subheading text-highlighted">
              <UIcon name="i-ph-sliders-horizontal" class="size-5 text-muted" aria-hidden="true" />
              Tindakan
            </h3>
            <div class="flex flex-wrap gap-2">
              <UButton
                type="button"
                color="neutral"
                variant="soft"
                icon="i-ph-sliders-horizontal"
                label="Ubah Kuota"
                data-testid="sub-toggle-quota"
                @click="toggleQuota"
              />
              <UButton
                :to="{ name: SUBSCRIPTION_ROUTES.invoice, params: { id: sub.id } }"
                color="neutral"
                variant="soft"
                icon="i-ph-printer"
                label="Cetak Invoice"
                data-testid="sub-invoice"
              />
              <UButton
                v-if="sub.packageTier === 'basic'"
                type="button"
                color="neutral"
                variant="soft"
                icon="i-ph-arrow-up"
                label="Naik Taraf ke Penuh"
                data-testid="sub-toggle-upgrade"
                @click="open.upgrade = !open.upgrade"
              />
              <UButton
                type="button"
                color="error"
                variant="soft"
                icon="i-ph-x"
                label="Batalkan"
                :disabled="busy"
                data-testid="sub-cancel"
                @click="cancel"
              />
              <UButton
                type="button"
                icon="i-ph-calendar-plus"
                label="Lanjutkan Tempoh"
                data-testid="sub-toggle-extend"
                @click="open.extend = !open.extend"
              />
            </div>

            <!-- Ubah Kuota -->
            <DsPanel
              v-if="open.quota"
              tone="inset"
              as="form"
              method="post"
              data-testid="sub-quota-form"
              @submit.prevent="saveQuota"
            >
              <div class="flex flex-col gap-3">
                <div class="flex flex-wrap items-center gap-3">
                  <label for="sub-new-quota" class="text-label text-default">Kuota baru:</label>
                  <UInput
                    id="sub-new-quota"
                    v-model="quotaForm.quota"
                    type="number"
                    name="student_quota"
                    required
                    :min="QUOTA_MIN"
                    :max="QUOTA_MAX"
                    class="w-32"
                    data-testid="sub-quota-input"
                  />
                </div>
                <UInput
                  v-model="quotaForm.notes"
                  type="text"
                  name="notes"
                  placeholder="Sebab perubahan (opsional)"
                  aria-label="Sebab perubahan"
                  class="w-full"
                  data-testid="sub-quota-notes"
                />
                <div>
                  <UButton
                    type="submit"
                    icon="i-ph-floppy-disk"
                    label="Simpan"
                    :disabled="busy"
                    data-testid="sub-quota-save"
                  />
                </div>
              </div>
            </DsPanel>

            <!-- Lanjutkan Tempoh -->
            <DsPanel
              v-if="open.extend"
              tone="inset"
              as="form"
              method="post"
              data-testid="sub-extend-form"
              @submit.prevent="extend"
            >
              <div class="flex flex-col gap-3">
                <p
                  class="flex items-center gap-2 text-label text-muted"
                  data-testid="sub-extend-current"
                >
                  <UIcon name="i-ph-info" class="size-4 shrink-0" aria-hidden="true" />
                  Tamat semasa: {{ formatDateTime(sub.endsAt) }}
                </p>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-label text-default">Tambah:</span>
                  <UButton
                    v-for="preset in EXTEND_PRESETS"
                    :key="preset.days"
                    type="button"
                    color="neutral"
                    variant="soft"
                    :label="preset.label"
                    data-testid="sub-extend-preset"
                    @click="extendForm.days = String(preset.days)"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <UInput
                    v-model="extendForm.days"
                    type="number"
                    name="days"
                    required
                    min="1"
                    max="365"
                    aria-label="Bilangan hari"
                    class="w-28"
                    data-testid="sub-extend-days"
                  />
                  <span class="text-label text-muted">hari</span>
                </div>
                <UInput
                  v-model="extendForm.reason"
                  type="text"
                  name="reason"
                  placeholder="Sebab lanjutan (opsional)"
                  aria-label="Sebab lanjutan"
                  class="w-full"
                  data-testid="sub-extend-reason"
                />
                <div>
                  <UButton
                    type="submit"
                    icon="i-ph-calendar-plus"
                    label="Lanjutkan"
                    :disabled="busy"
                    data-testid="sub-extend-submit"
                  />
                </div>
              </div>
            </DsPanel>

            <!-- Naik Taraf ke Penuh -->
            <DsPanel
              v-if="open.upgrade && sub.packageTier === 'basic'"
              tone="inset"
              as="form"
              method="post"
              data-testid="sub-upgrade-form"
              @submit.prevent="confirmUpgrade"
            >
              <div class="flex flex-col gap-3">
                <p
                  class="flex items-start gap-2 text-label text-default"
                  data-testid="sub-upgrade-text"
                >
                  <UIcon
                    name="i-ph-warning-circle"
                    class="mt-1 size-4 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                  <span
                    >Naik taraf dari
                    <strong>Pemantauan ({{ sub.questionLimit ?? 500 }} soalan/bulan)</strong> ke
                    <strong>Penuh (Tanpa Had)</strong>. Langganan akan dilanjutkan 1 tahun dari
                    sekarang dengan harga {{ money(sub.package.priceAnnual) }}/pelajar.</span
                  >
                </p>
                <UInput
                  v-model="upgradeForm.reference"
                  type="text"
                  name="payment_reference"
                  placeholder="Rujukan pembayaran (opsional)"
                  aria-label="Rujukan pembayaran"
                  class="w-full"
                  data-testid="sub-upgrade-reference"
                />
                <UInput
                  v-model="upgradeForm.notes"
                  type="text"
                  name="payment_notes"
                  placeholder="Nota (opsional)"
                  aria-label="Nota"
                  class="w-full"
                  data-testid="sub-upgrade-notes"
                />
                <div>
                  <UButton
                    type="submit"
                    icon="i-ph-arrow-up"
                    label="Sahkan Naik Taraf"
                    :disabled="busy"
                    data-testid="sub-upgrade-submit"
                  />
                </div>
              </div>
            </DsPanel>
          </div>
        </div>
      </DsPanel>

      <!-- Students -->
      <section data-testid="sub-students">
        <DsDataTable
          :data="studentRows"
          :columns="STUDENT_COLUMNS"
          variant="flush"
          caption="Senarai pelajar langganan"
          :loading="!students && !studentsError"
          :error="studentsError ? errorLines(studentsError).join(' ') : undefined"
          :page-size="Math.max(studentRows.length, 1)"
          card-title="name"
          data-testid="sub-students-table"
          @retry="reloadStudents()"
        >
          <template #toolbar>
            <div class="flex flex-wrap items-center justify-between gap-3 p-4">
              <h3 class="flex items-center gap-2 text-subheading text-highlighted">
                <UIcon name="i-ph-users" class="size-5 text-muted" aria-hidden="true" />
                Senarai Pelajar ({{ formatNumber(total) }})
              </h3>
              <div class="flex flex-wrap items-center gap-2 text-label text-muted">
                <label for="sub-per-page">Tunjuk</label>
                <div class="w-24">
                  <DsNativeSelect
                    id="sub-per-page"
                    :model-value="pageSize"
                    data-testid="sub-per-page"
                    @change="onPerPage"
                  >
                    <option v-for="n in SUBSCRIPTION_PER_PAGE_OPTIONS" :key="n" :value="n">
                      {{ n }}
                    </option>
                  </DsNativeSelect>
                </div>
                <span data-testid="sub-range"
                  >perbarisan · Memaparkan {{ firstNo }}-{{ lastNo }} dari {{ total }}</span
                >
              </div>
            </div>
          </template>
          <template #no-cell="{ row }">
            <span data-testid="sub-student-row">{{ firstNo + row.index }}</span>
          </template>
          <template #email-cell="{ row }">
            <span class="break-all">{{ row.original.idDelima }}</span>
          </template>
          <template #level-cell="{ row }">
            <span class="text-nowrap">{{ row.original.classLevel }}</span>
          </template>
          <template #card="{ row }">
            <p class="text-body text-highlighted" data-testid="sub-student-row">{{ row.name }}</p>
            <p class="text-label break-all text-muted">{{ row.idDelima }}</p>
            <p class="text-label text-muted">{{ row.classLevel }}</p>
          </template>
        </DsDataTable>
        <div v-if="students && total > pageSize" class="p-3" data-testid="sub-pager">
          <UPagination
            :page="pageQuery"
            :total="total"
            :items-per-page="pageSize"
            :prev="{ 'aria-label': 'Sebelum' }"
            :next="{ 'aria-label': 'Seterusnya' }"
            @update:page="goToPage"
          />
        </div>
      </section>
    </template>
  </DsPage>
</template>
