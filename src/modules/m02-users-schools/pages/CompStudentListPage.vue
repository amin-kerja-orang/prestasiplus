<script setup lang="ts">
/**
 * S6 `/admin/comp-students` "Pelajar Komplimen - Admin Panel" (M02-T7; FR-M02-65…69), v2 staff theme.
 *
 * Header summary "Syiling OFF: {n} / {total} pelajar komplimen" + "Daftar Baru", three KPI tiles, the
 * sticky bulk bar (shown while a row is ticked: "{n} dipilih", four immediate actions without
 * confirmation, "Batal pilihan") and `AdminTable` of 50 rows per page (cards below `md`). After a bulk
 * action the same page reloads, the selection is cleared and the API `status` is the success flash
 * (UNVERIFIED COPY).
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { AdminCard, AdminIdentity, AdminKpiStrip, AdminPageHeader, AdminPager } from '@/ds/admin'
import { useApi, useFlash } from '@/composables'
import { DsPage, DsStatTile } from '@/ds'
import { formatNumber } from '@/lib/number'

import { bulkCompAction, fetchCompStudents, type CompBulkAction } from '../api/comp-students'
import AdminAlert from '../components/AdminAlert.vue'
import NativeCheckbox from '../components/native/NativeCheckbox.vue'
import {
  accountColor,
  BULK_BUTTONS,
  COMP_CREATE_PATH,
  COMP_LIST_PATH,
  coinsColor,
  compDetailPath,
} from '../lib/comp-students'
import { errorLines } from '../lib/user-form-errors'
import { formatUserDate } from '../lib/user-list'
import AdminCell from '../components/native/AdminCell.vue'
import AdminRow from '../components/native/AdminRow.vue'
import AdminTable from '../components/native/AdminTable.vue'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

const page = computed(() => {
  const raw = Array.isArray(route.query.page) ? route.query.page[0] : route.query.page
  return Math.max(1, Number.parseInt(raw ?? '', 10) || 1)
})

const { data, error, reload } = useApi(
  (signal) => fetchCompStudents({ page: page.value, signal }),
  () => route.query.page,
)

const rows = computed(() => data.value?.data ?? [])
const counts = computed(() => data.value?.meta.counts ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)
const summary = computed(() => {
  const meta = data.value?.meta
  if (!meta || rows.value.length === 0) return ''
  return `Menunjukkan ${String(meta.from ?? 1)}-${String(meta.to ?? rows.value.length)} daripada ${String(meta.totalItems)} hasil`
})

function goToPage(next: number): void {
  void router.push({ path: COMP_LIST_PATH, query: { page: String(next) } })
}

// --- Selection (FR-M02-67): a page change clears it.
const selected = ref<number[]>([])
const pageIds = computed(() => rows.value.map((r) => r.id))
const allSelected = computed(
  () => pageIds.value.length > 0 && pageIds.value.every((id) => selected.value.includes(id)),
)
watch(
  () => route.fullPath,
  () => {
    selected.value = []
  },
)

function toggleAll(event: Event): void {
  selected.value = (event.target as HTMLInputElement).checked ? [...pageIds.value] : []
}

const busy = ref(false)
const runningAction = ref<CompBulkAction | null>(null)

async function runBulk(action: CompBulkAction): Promise<void> {
  if (busy.value || selected.value.length === 0) return
  busy.value = true
  runningAction.value = action
  try {
    const result = await bulkCompAction(action, selected.value)
    selected.value = []
    await reload()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
    runningAction.value = null
  }
}

const SKELETON_ROWS = 6
const COLUMNS = [
  { key: 'select', label: '', cls: 'w-14' },
  { key: 'name', label: 'Nama' },
  { key: 'ic', label: 'IC' },
  { key: 'school', label: 'Sekolah' },
  { key: 'class', label: 'Kelas / Cikgu' },
  { key: 'account', label: 'Akaun' },
  { key: 'coins', label: 'Syiling' },
  { key: 'expiry', label: 'Pakej tamat' },
]
</script>

<template>
  <DsPage data-testid="comp-list-page">
    <AdminPageHeader title="Pelajar Komplimen">
      <template #subtitle>
        <p v-if="counts" class="text-body text-muted" data-testid="comp-summary">
          Syiling OFF: <strong class="text-highlighted">{{ counts.coinsOff }}</strong> /
          {{ counts.total }} pelajar komplimen
        </p>
      </template>
      <template #actions>
        <UButton
          :to="COMP_CREATE_PATH"
          icon="i-ph-user-plus"
          label="Daftar Baru"
          data-testid="comp-add"
        />
      </template>
    </AdminPageHeader>

    <AdminKpiStrip label="Ringkasan pelajar komplimen" class="xl:grid-cols-3 2xl:grid-cols-3">
      <template v-if="counts">
        <DsStatTile
          compact
          :value="formatNumber(counts.total)"
          unit="Pelajar Komplimen"
          icon="i-ph-graduation-cap"
        />
        <DsStatTile
          compact
          accent="heat"
          :value="formatNumber(counts.coinsOff)"
          unit="Syiling OFF"
          icon="i-ph-prohibit"
        />
        <DsStatTile
          compact
          accent="trial"
          :value="formatNumber(counts.total - counts.coinsOff)"
          unit="Syiling ON"
          icon="i-ph-coins"
        />
      </template>
      <template v-else>
        <USkeleton v-for="n in 3" :key="n" class="h-20 w-full" />
      </template>
    </AdminKpiStrip>

    <!-- Sticky bulk bar (FR-M02-67): only while at least one row is ticked. -->
    <AdminCard
      v-if="selected.length > 0"
      as="div"
      tone="elevated"
      sticky
      flush
      class="flex flex-wrap items-center gap-3 p-4"
      data-testid="comp-bulk-bar"
    >
      <span class="mr-2 text-body text-highlighted">
        <span data-testid="comp-selected-count">{{ selected.length }}</span> dipilih
      </span>
      <UButton
        v-for="b in BULK_BUTTONS"
        :key="b.action"
        type="button"
        :color="b.color"
        variant="soft"
        :icon="b.icon"
        :label="b.label"
        :loading="runningAction === b.action"
        :disabled="busy"
        :data-testid="`comp-bulk-${b.action}`"
        @click="runBulk(b.action)"
      />
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        label="Batal pilihan"
        data-testid="comp-bulk-clear"
        @click="selected = []"
      />
    </AdminCard>

    <div v-if="error" class="flex flex-col gap-4" data-testid="comp-error">
      <AdminAlert :messages="errorLines(error)" />
      <div>
        <UButton label="Cuba Lagi" data-testid="comp-retry" @click="reload()" />
      </div>
    </div>

    <AdminTable
      v-else
      :columns="COLUMNS"
      caption="Senarai pelajar komplimen"
      data-testid="comp-table"
    >
      <template #head-select>
        <NativeCheckbox
          :model-value="allSelected"
          aria-label="Pilih semua"
          data-testid="comp-select-all"
          @change="toggleAll"
        />
      </template>

      <template v-if="firstLoad">
        <AdminRow v-for="n in SKELETON_ROWS" :key="n" data-testid="comp-skeleton">
          <AdminCell v-for="c in COLUMNS.length" :key="c">
            <USkeleton class="h-5 w-full max-w-28" />
          </AdminCell>
        </AdminRow>
      </template>

      <template v-else>
        <AdminRow v-for="s in rows" :key="s.id" data-testid="comp-row" :data-student-id="s.id">
          <AdminCell label="Pilih">
            <NativeCheckbox
              v-model="selected"
              :value="s.id"
              :aria-label="`Pilih ${s.name}`"
              data-testid="comp-select"
            />
          </AdminCell>
          <AdminCell>
            <AdminIdentity :name="s.name" :sub="s.username">
              <template #name>
                <RouterLink
                  :to="compDetailPath(s.id)"
                  class="text-primary"
                  data-testid="comp-name"
                  >{{ s.name }}</RouterLink
                >
              </template>
            </AdminIdentity>
          </AdminCell>
          <AdminCell label="IC">
            <span class="text-nowrap text-muted">{{ s.icNumber ?? '' }}</span>
          </AdminCell>
          <AdminCell label="Sekolah">
            <span class="block max-w-32 truncate" :title="s.schoolName ?? ''">{{
              s.schoolName ?? ''
            }}</span>
          </AdminCell>
          <AdminCell label="Kelas / Cikgu">
            <div class="flex min-w-0 flex-col max-md:items-end">
              <span class="text-nowrap text-highlighted">{{ s.classLabel }}</span>
              <span class="block max-w-36 truncate text-label text-muted" :title="s.teacherName">{{
                s.teacherName
              }}</span>
            </div>
          </AdminCell>
          <AdminCell label="Akaun">
            <UBadge
              :color="accountColor(s.isActive)"
              variant="subtle"
              :label="s.isActive ? 'AKTIF' : 'TIDAK AKTIF'"
              data-testid="comp-account"
            />
          </AdminCell>
          <AdminCell label="Syiling">
            <UBadge
              :color="coinsColor(s.coinsEnabled)"
              variant="subtle"
              :label="s.coinsEnabled ? 'ON' : 'OFF'"
              data-testid="comp-coins"
            />
          </AdminCell>
          <AdminCell label="Pakej tamat">
            <span class="text-nowrap">{{ formatUserDate(s.packageExpiresAt) }}</span>
          </AdminCell>
        </AdminRow>
      </template>

      <template #footer>
        <!-- Empty page: outside the table body, centred in the card (FR-M02-69). -->
        <p
          v-if="data && rows.length === 0"
          class="px-4 py-12 text-center text-body text-muted"
          data-testid="comp-empty"
        >
          Tiada pelajar komplimen lagi.
          <RouterLink :to="COMP_CREATE_PATH" class="text-primary" data-testid="comp-empty-link"
            >Daftar baru.</RouterLink
          >
        </p>
        <AdminPager
          :summary="summary"
          :total="data?.meta.totalItems ?? 0"
          :page="data?.meta.page ?? 1"
          :page-size="data?.meta.pageSize ?? 50"
          data-testid="comp-pager"
          @update:page="goToPage"
        />
      </template>
    </AdminTable>
  </DsPage>
</template>
