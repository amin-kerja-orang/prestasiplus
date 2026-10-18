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
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { AdminCard, AdminKpiStrip, AdminPageHeader } from '@/ds/admin'
import { useApi, useFlash, usePageMeta } from '@/composables'
import { DsPage, DsStatTile, useConfirm } from '@/ds'
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
} from '../api/subscriptions'
import AdminAlert from '../components/AdminAlert.vue'
import NativePanel from '../components/native/NativePanel.vue'
import { errorLines } from '../lib/school-errors'
import AdminCell from '../components/native/AdminCell.vue'
import AdminRow from '../components/native/AdminRow.vue'
import AdminSelect from '../components/native/AdminSelect.vue'
import AdminTable from '../components/native/AdminTable.vue'
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

const STUDENT_COLUMNS = [
  { key: 'no', label: '#' },
  { key: 'name', label: 'Nama' },
  { key: 'email', label: 'Email ID Delima' },
  { key: 'level', label: 'Tingkatan' },
]
</script>

<template>
  <DsPage data-testid="sub-detail-page">
    <AdminPageHeader
      title="Langganan Sekolah"
      subtitle="Butiran langganan, kuota dan senarai pelajar."
    >
      <template #actions>
        <UButton
          :to="SUBSCRIPTIONS_LIST_PATH"
          color="neutral"
          variant="soft"
          icon="i-ph-arrow-left"
          label="Senarai Langganan"
          data-testid="sub-list-back"
        />
      </template>
    </AdminPageHeader>

    <div
      v-if="loadError && !isNotFound(loadError)"
      class="flex flex-col gap-3"
      data-testid="sub-load-error"
    >
      <AdminAlert :messages="errorLines(loadError)" />
      <div>
        <UButton label="Cuba Lagi" @click="reloadSub()" />
      </div>
    </div>

    <div v-else-if="!sub" class="flex flex-col gap-4" data-testid="sub-skeleton">
      <USkeleton class="h-64 w-full" />
      <USkeleton class="h-40 w-full" />
    </div>

    <template v-else>
      <div ref="alertBox">
        <AdminAlert :messages="errors" data-testid="sub-action-alert" />
      </div>

      <!-- Summary card -->
      <AdminCard data-testid="sub-summary-card">
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
              <UBadge
                :color="STATUS_BADGE[sub.status].color"
                variant="subtle"
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

          <NativePanel
            v-if="sub.packageTier === 'basic'"
            tone="soft"
            class="flex items-center gap-3"
            data-testid="sub-basic-box"
          >
            <UIcon name="i-ph-eye" class="size-6 shrink-0 text-muted" aria-hidden="true" />
            <div class="min-w-0 text-label">
              <p class="text-highlighted">Pakej Pemantauan</p>
              <p class="break-words text-muted">
                {{ sub.questionLimit ?? 500 }} soalan/bulan/pelajar · PERCUMA · Tamat
                {{ formatDate(sub.endsAt) }}
              </p>
            </div>
          </NativePanel>

          <AdminKpiStrip label="Butiran langganan" data-testid="sub-tiles">
            <DsStatTile
              compact
              :value="formatDate(sub.startsAt)"
              unit="Mula"
              icon="i-ph-calendar-check"
            />
            <DsStatTile
              compact
              accent="heat"
              :value="formatDate(sub.endsAt)"
              unit="Tamat"
              icon="i-ph-calendar-x"
            />
            <template v-if="sub.packageTier === 'basic'">
              <DsStatTile
                compact
                accent="trial"
                :value="`${String(sub.questionLimit ?? 500)}/bulan`"
                unit="Had Soalan"
                icon="i-ph-question"
              />
              <DsStatTile compact accent="win" value="PERCUMA" unit="Kos" icon="i-ph-gift" />
            </template>
            <template v-else>
              <div data-testid="sub-price">
                <DsStatTile
                  compact
                  accent="trial"
                  :value="money(sub.package.priceAnnual)"
                  unit="Harga / Pelajar"
                  icon="i-ph-tag"
                />
              </div>
              <div data-testid="sub-total">
                <DsStatTile
                  compact
                  accent="win"
                  :value="money(sub.studentQuota * Number(sub.package.priceAnnual))"
                  unit="Jumlah"
                  icon="i-ph-coins"
                />
              </div>
            </template>
          </AdminKpiStrip>

          <NativePanel
            v-if="sub.notes"
            tone="soft"
            class="flex items-start gap-2 text-label text-default"
            data-testid="sub-notes"
          >
            <UIcon name="i-ph-note" class="mt-1 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span class="min-w-0 break-words whitespace-pre-line"
              ><strong>Nota:</strong> {{ sub.notes }}</span
            >
          </NativePanel>
        </div>
      </AdminCard>

      <!-- Actions -->
      <AdminCard data-testid="sub-actions">
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
          <NativePanel
            v-if="open.quota"
            as="form"
            tone="soft"
            class="flex flex-col gap-3 p-4"
            method="post"
            data-testid="sub-quota-form"
            @submit.prevent="saveQuota"
          >
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
          </NativePanel>

          <!-- Lanjutkan Tempoh -->
          <NativePanel
            v-if="open.extend"
            as="form"
            tone="soft"
            class="flex flex-col gap-3 p-4"
            method="post"
            data-testid="sub-extend-form"
            @submit.prevent="extend"
          >
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
          </NativePanel>

          <!-- Naik Taraf ke Penuh -->
          <NativePanel
            v-if="open.upgrade && sub.packageTier === 'basic'"
            as="form"
            tone="soft"
            class="flex flex-col gap-3 p-4"
            method="post"
            data-testid="sub-upgrade-form"
            @submit.prevent="confirmUpgrade"
          >
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
                <strong>Penuh (Tanpa Had)</strong>. Langganan akan dilanjutkan 1 tahun dari sekarang
                dengan harga {{ money(sub.package.priceAnnual) }}/pelajar.</span
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
          </NativePanel>
        </div>
      </AdminCard>

      <!-- Students -->
      <section data-testid="sub-students">
        <AdminTable
          :columns="STUDENT_COLUMNS"
          caption="Senarai pelajar langganan"
          data-testid="sub-students-table"
        >
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3 p-4">
              <h3 class="flex items-center gap-2 text-subheading text-highlighted">
                <UIcon name="i-ph-users" class="size-5 text-muted" aria-hidden="true" />
                Senarai Pelajar ({{ formatNumber(total) }})
              </h3>
              <div class="flex flex-wrap items-center gap-2 text-label text-muted">
                <label for="sub-per-page">Tunjuk</label>
                <AdminSelect
                  id="sub-per-page"
                  :model-value="pageSize"
                  class="w-24"
                  data-testid="sub-per-page"
                  @change="onPerPage"
                >
                  <option v-for="n in SUBSCRIPTION_PER_PAGE_OPTIONS" :key="n" :value="n">
                    {{ n }}
                  </option>
                </AdminSelect>
                <span data-testid="sub-range"
                  >perbarisan · Memaparkan {{ firstNo }}-{{ lastNo }} dari {{ total }}</span
                >
              </div>
            </div>
          </template>

          <AdminRow v-if="studentsError" data-testid="sub-students-error">
            <AdminCell :colspan="STUDENT_COLUMNS.length">
              <div class="flex flex-col items-center gap-3">
                <AdminAlert :messages="errorLines(studentsError)" />
                <UButton label="Cuba Lagi" @click="reloadStudents()" />
              </div>
            </AdminCell>
          </AdminRow>
          <template v-else-if="!students">
            <AdminRow v-for="n in 5" :key="n">
              <AdminCell v-for="c in STUDENT_COLUMNS" :key="c.key">
                <USkeleton class="h-4 w-full max-w-32" />
              </AdminCell>
            </AdminRow>
          </template>
          <template v-else>
            <AdminRow
              v-for="(student, i) in students.data"
              :key="student.id"
              data-testid="sub-student-row"
            >
              <AdminCell label="#">{{ firstNo + i }}</AdminCell>
              <AdminCell label="Nama">{{ student.name }}</AdminCell>
              <AdminCell label="Email ID Delima">
                <span class="break-all">{{ student.idDelima }}</span>
              </AdminCell>
              <AdminCell label="Tingkatan">
                <span class="text-nowrap">{{ student.classLevel }}</span>
              </AdminCell>
            </AdminRow>
          </template>

          <template #footer>
            <div class="p-3 empty:hidden" data-testid="sub-pager">
              <UPagination
                v-if="students && total > pageSize"
                :page="pageQuery"
                :total="total"
                :items-per-page="pageSize"
                :prev="{ 'aria-label': 'Sebelum' }"
                :next="{ 'aria-label': 'Seterusnya' }"
                @update:page="goToPage"
              />
            </div>
          </template>
        </AdminTable>
      </section>
    </template>
  </DsPage>
</template>
