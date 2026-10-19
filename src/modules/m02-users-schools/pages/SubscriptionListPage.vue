<script setup lang="ts">
/**
 * S12 `/admin/school-subscriptions` "Langganan Sekolah - Admin PRESTASIPLUS" (M02-T9; FR-M02-82, 83), v2
 * staff theme.
 *
 * - Four stat tiles (`meta.counts`, over all subscriptions: Aktif, Tempoh Ihsan, Tamat Tempoh, Jumlah
 *   Kuota Pelajar of the active rows only).
 * - Filter bar (`search`, `status`, `form_level`) and "Langganan Baru". The query string is the state, as
 *   on the live GET form.
 * - All rows, no pagination; the table scrolls inside its card from `md`, below `md` each row is a card.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsDataTable,
  DsEmptyState,
  DsFilterBar,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStatRow,
  DsStatusBadge,
  type StatItem,
} from '@/ds'
import { formatNumber } from '@/lib/number'
import { formatDate } from '@/lib/time'

import {
  fetchSubscriptions,
  type SchoolFormLevel,
  type SubscriptionListItem,
  type SubscriptionStatus,
} from '../api/subscriptions'
import {
  barColor,
  FORM_LEVEL_FILTER_OPTIONS,
  levelLabel,
  STATUS_BADGE,
  STATUS_FILTER_OPTIONS,
  SUBSCRIPTION_ROUTES,
  SUBSCRIPTIONS_LIST_PATH,
  TIER_LABEL,
} from '../lib/subscription-options'

const route = useRoute()
const router = useRouter()

function queryText(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value
  return first ?? ''
}

const applied = computed(() => ({
  search: queryText(route.query.search).trim(),
  status: queryText(route.query.status),
  formLevel: queryText(route.query.form_level),
}))

const search = ref(queryText(route.query.search))
const status = ref(queryText(route.query.status))
const formLevel = ref(queryText(route.query.form_level))
watch(
  () => [route.query.search, route.query.status, route.query.form_level] as const,
  ([s, st, fl]) => {
    search.value = queryText(s)
    status.value = queryText(st)
    formLevel.value = queryText(fl)
  },
)

const { data, error, reload } = useApi(
  (signal) =>
    fetchSubscriptions({
      search: applied.value.search || null,
      status: (applied.value.status || null) as SubscriptionStatus | null,
      formLevel: (applied.value.formLevel || null) as SchoolFormLevel | null,
      signal,
    }),
  [() => route.query.search, () => route.query.status, () => route.query.form_level],
)

const rows = computed(() => data.value?.data ?? [])
const counts = computed(() => data.value?.meta.counts ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)
const chips = computed<{ key: string; label: string }[]>(() => {
  const out: { key: string; label: string }[] = []
  const st = STATUS_FILTER_OPTIONS.find((o) => o.value === applied.value.status)
  if (st) out.push({ key: 'status', label: st.label })
  const fl = FORM_LEVEL_FILTER_OPTIONS.find((o) => o.value === applied.value.formLevel)
  if (fl) out.push({ key: 'form_level', label: fl.label })
  return out
})

async function removeChip(key: string): Promise<void> {
  const query: Record<string, string> = {}
  if (applied.value.search !== '') query.search = applied.value.search
  if (applied.value.status !== '' && key !== 'status') query.status = applied.value.status
  if (applied.value.formLevel !== '' && key !== 'form_level')
    query.form_level = applied.value.formLevel
  await router.push({ path: SUBSCRIPTIONS_LIST_PATH, query })
}

async function submitFilter(): Promise<void> {
  const query: Record<string, string> = {}
  const s = search.value.trim()
  if (s !== '') query.search = s
  if (status.value !== '') query.status = status.value
  if (formLevel.value !== '') query.form_level = formLevel.value
  const current: Record<string, string> = {}
  if (applied.value.search !== '') current.search = applied.value.search
  if (applied.value.status !== '') current.status = applied.value.status
  if (applied.value.formLevel !== '') current.form_level = applied.value.formLevel
  if (JSON.stringify(current) === JSON.stringify(query)) await reload()
  else await router.push({ path: SUBSCRIPTIONS_LIST_PATH, query })
}

async function resetFilter(): Promise<void> {
  search.value = ''
  status.value = ''
  formLevel.value = ''
  await submitFilter()
}

function percent(used: number, quota: number): number {
  return quota > 0 ? Math.min(100, Math.round((used * 100) / quota)) : 0
}

type SubRow = SubscriptionListItem & Record<string, unknown>
const tableRows = computed(() => rows.value as SubRow[])
const activeCount = computed(() => chips.value.length + (applied.value.search !== '' ? 1 : 0))
const stats = computed<StatItem[]>(() => {
  const k = counts.value
  if (!k) return []
  return [
    {
      key: 'active',
      label: 'Aktif',
      value: formatNumber(k.active),
      icon: 'check-circle',
      accent: 'win',
    },
    {
      key: 'grace',
      label: 'Tempoh Ihsan',
      value: formatNumber(k.grace),
      icon: 'hourglass-medium',
      accent: 'trial',
    },
    {
      key: 'expired',
      label: 'Tamat Tempoh',
      value: formatNumber(k.expired),
      icon: 'calendar-x',
      accent: 'heat',
    },
    {
      key: 'quota',
      label: 'Jumlah Kuota Pelajar',
      value: formatNumber(k.totalQuota),
      icon: 'users',
      accent: 'action',
    },
  ]
})
const COLUMNS: TableColumn<SubRow>[] = [
  { id: 'school', header: 'Sekolah' },
  { id: 'level', header: 'Tingkatan' },
  { id: 'tier', header: 'Pakej' },
  { id: 'quota', header: 'Kuota' },
  { id: 'status', header: 'Status' },
  { id: 'start', header: 'Mula' },
  { id: 'end', header: 'Tamat' },
  { id: 'view', header: 'Tindakan' },
]
</script>

<template>
  <DsPage
    title="Langganan Sekolah"
    subtitle="Pantau langganan sekolah, kuota pelajar dan tarikh tamat."
    data-testid="subs-page"
  >
    <template #actions>
      <UButton
        :to="{ name: SUBSCRIPTION_ROUTES.create }"
        icon="i-ph-plus"
        label="Langganan Baru"
        data-testid="subs-add"
      />
    </template>

    <DsStatRow
      prefix="subs-stat"
      :items="stats"
      :loading="counts === null"
      density="compact"
      :cols="4"
      aria-label="Ringkasan langganan"
    />

    <DsFilterBar
      :chips="chips"
      :active-count="activeCount"
      data-testid="subs-filter"
      @apply="submitFilter"
      @reset="resetFilter"
      @remove-chip="removeChip"
    >
      <template #search>
        <UInput
          v-model="search"
          type="text"
          name="search"
          aria-label="Cari"
          placeholder="Cari sekolah..."
          icon="i-ph-magnifying-glass"
          class="w-full md:min-w-64 md:flex-1"
          data-testid="subs-search"
        />
      </template>
      <DsNativeSelect
        v-model="status"
        name="status"
        aria-label="Status"
        class="md:w-48"
        data-testid="subs-status"
      >
        <option value="">Semua Status</option>
        <option v-for="o in STATUS_FILTER_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </DsNativeSelect>
      <DsNativeSelect
        v-model="formLevel"
        name="form_level"
        aria-label="Tingkatan"
        class="md:w-48"
        data-testid="subs-level"
      >
        <option value="">Semua Tingkatan</option>
        <option v-for="o in FORM_LEVEL_FILTER_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </DsNativeSelect>
    </DsFilterBar>

    <DsLoadError
      v-if="error"
      message="Tidak dapat memuatkan senarai langganan. Sila cuba semula."
      testid="subs-error"
      @retry="reload()"
    />

    <DsPanel v-else-if="firstLoad" padding="none" data-testid="subs-table">
      <div class="flex flex-col gap-3 p-4">
        <USkeleton v-for="n in 5" :key="n" class="h-12 w-full" data-testid="subs-skeleton" />
      </div>
    </DsPanel>

    <DsDataTable
      v-else
      :data="tableRows"
      :columns="COLUMNS"
      variant="flush"
      density="compact"
      caption="Senarai langganan sekolah"
      :page-size="Math.max(tableRows.length, 1)"
      data-testid="subs-table"
    >
      <template #school-cell="{ row }">
        <div class="flex flex-col gap-1" data-testid="subs-row" :data-sub-id="row.original.id">
          <span class="max-w-56 text-body whitespace-normal text-highlighted">{{
            row.original.school.name
          }}</span>
          <span class="text-label text-muted">{{ row.original.school.code }}</span>
        </div>
      </template>
      <template #level-cell="{ row }">
        <UBadge
          color="neutral"
          variant="subtle"
          :label="levelLabel(row.original.formLevel)"
          data-testid="subs-level-badge"
        />
      </template>
      <template #tier-cell="{ row }">
        <UBadge
          color="neutral"
          variant="subtle"
          :icon="row.original.packageTier === 'basic' ? 'i-ph-eye' : 'i-ph-infinity'"
          :label="TIER_LABEL[row.original.packageTier]"
          data-testid="subs-tier-badge"
        />
      </template>
      <template #quota-cell="{ row }">
        <div class="flex items-center gap-2">
          <UProgress
            class="w-24"
            :model-value="percent(row.original.used, row.original.studentQuota)"
            :color="barColor(percent(row.original.used, row.original.studentQuota))"
            :aria-label="`Kuota digunakan ${String(percent(row.original.used, row.original.studentQuota))}%`"
          />
          <span class="text-label text-muted" data-testid="subs-quota"
            >{{ row.original.used }}/{{ row.original.studentQuota }}</span
          >
        </div>
      </template>
      <template #status-cell="{ row }">
        <DsStatusBadge
          :status="STATUS_BADGE[row.original.status].status"
          :label="STATUS_BADGE[row.original.status].label"
          data-testid="subs-status-badge"
        />
      </template>
      <template #start-cell="{ row }">
        <span class="text-nowrap">{{ formatDate(row.original.startsAt) }}</span>
      </template>
      <template #end-cell="{ row }">
        <span class="text-nowrap">{{ formatDate(row.original.endsAt) }}</span>
      </template>
      <template #view-cell="{ row }">
        <UButton
          :to="{ name: SUBSCRIPTION_ROUTES.detail, params: { id: row.original.id } }"
          color="neutral"
          variant="soft"
          trailing-icon="i-ph-arrow-right"
          label="Lihat"
          data-testid="subs-view"
        />
      </template>
      <template #empty>
        <DsEmptyState
          size="sm"
          icon="file-text"
          title="Tiada langganan dijumpai."
          data-testid="subs-empty"
        />
      </template>
      <template #card="{ row }">
        <div class="flex flex-col gap-1" data-testid="subs-row" :data-sub-id="row.id">
          <span class="text-body text-highlighted">{{
            (row.school as { name: string }).name
          }}</span>
          <span class="text-label text-muted">
            {{ levelLabel(row.formLevel as SchoolFormLevel) }} · {{ row.used }}/{{
              row.studentQuota
            }}
          </span>
        </div>
        <DsStatusBadge
          class="w-fit"
          :status="STATUS_BADGE[row.status as SubscriptionStatus].status"
          :label="STATUS_BADGE[row.status as SubscriptionStatus].label"
        />
      </template>
      <template #card-actions="{ row }">
        <UButton
          :to="{ name: SUBSCRIPTION_ROUTES.detail, params: { id: row.id as number } }"
          color="neutral"
          variant="soft"
          trailing-icon="i-ph-arrow-right"
          label="Lihat"
        />
      </template>
    </DsDataTable>
  </DsPage>
</template>
