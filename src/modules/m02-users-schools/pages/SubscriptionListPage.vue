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
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { AdminKpiStrip, AdminPageHeader, AdminToolbar, type ToolbarChip } from '@/ds/admin'
import { useApi } from '@/composables'
import { DsPage, DsStatTile } from '@/ds'
import { formatNumber } from '@/lib/number'
import { formatDate } from '@/lib/time'

import {
  fetchSubscriptions,
  type SchoolFormLevel,
  type SubscriptionStatus,
} from '../api/subscriptions'
import AdminAlert from '../components/AdminAlert.vue'
import { errorLines } from '../lib/school-errors'
import AdminCell from '../components/native/AdminCell.vue'
import AdminRow from '../components/native/AdminRow.vue'
import AdminSelect from '../components/native/AdminSelect.vue'
import AdminTable from '../components/native/AdminTable.vue'
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
const chips = computed<ToolbarChip[]>(() => {
  const out: ToolbarChip[] = []
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

const COLUMNS = [
  { key: 'school', label: 'Sekolah' },
  { key: 'level', label: 'Tingkatan' },
  { key: 'tier', label: 'Pakej' },
  { key: 'quota', label: 'Kuota' },
  { key: 'status', label: 'Status' },
  { key: 'start', label: 'Mula' },
  { key: 'end', label: 'Tamat' },
  { key: 'view', label: 'Tindakan', cls: 'text-end' },
]
const SKELETON_ROWS = 5
</script>

<template>
  <DsPage data-testid="subs-page">
    <AdminPageHeader
      title="Langganan Sekolah"
      subtitle="Pantau langganan sekolah, kuota pelajar dan tarikh tamat."
    >
      <template #actions>
        <UButton
          :to="{ name: SUBSCRIPTION_ROUTES.create }"
          icon="i-ph-plus"
          label="Langganan Baru"
          data-testid="subs-add"
        />
      </template>
    </AdminPageHeader>

    <AdminKpiStrip label="Ringkasan langganan" class="xl:grid-cols-4 2xl:grid-cols-4">
      <div data-testid="subs-stat-active">
        <DsStatTile
          v-if="counts"
          compact
          accent="win"
          :value="formatNumber(counts.active)"
          unit="Aktif"
          icon="i-ph-check-circle"
        />
        <USkeleton v-else class="h-20 w-full" />
      </div>
      <div data-testid="subs-stat-grace">
        <DsStatTile
          v-if="counts"
          compact
          accent="trial"
          :value="formatNumber(counts.grace)"
          unit="Tempoh Ihsan"
          icon="i-ph-hourglass-medium"
        />
        <USkeleton v-else class="h-20 w-full" />
      </div>
      <div data-testid="subs-stat-expired">
        <DsStatTile
          v-if="counts"
          compact
          accent="heat"
          :value="formatNumber(counts.expired)"
          unit="Tamat Tempoh"
          icon="i-ph-calendar-x"
        />
        <USkeleton v-else class="h-20 w-full" />
      </div>
      <div data-testid="subs-stat-quota">
        <DsStatTile
          v-if="counts"
          compact
          accent="action"
          :value="formatNumber(counts.totalQuota)"
          unit="Jumlah Kuota Pelajar"
          icon="i-ph-users"
        />
        <USkeleton v-else class="h-20 w-full" />
      </div>
    </AdminKpiStrip>

    <AdminToolbar
      :chips="chips"
      data-testid="subs-filter"
      @apply="submitFilter"
      @reset="resetFilter"
      @remove="removeChip"
    >
      <template #search>
        <UInput
          v-model="search"
          type="text"
          name="search"
          aria-label="Cari"
          placeholder="Cari sekolah..."
          icon="i-ph-magnifying-glass"
          class="w-full"
          data-testid="subs-search"
        />
      </template>
      <AdminSelect
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
      </AdminSelect>
      <AdminSelect
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
      </AdminSelect>
    </AdminToolbar>

    <div v-if="error" class="flex flex-col gap-3" data-testid="subs-error">
      <AdminAlert :messages="errorLines(error)" />
      <div>
        <UButton label="Cuba Lagi" data-testid="subs-retry" @click="reload()" />
      </div>
    </div>

    <AdminTable
      v-else
      :columns="COLUMNS"
      caption="Senarai langganan sekolah"
      data-testid="subs-table"
    >
      <template v-if="firstLoad">
        <AdminRow v-for="n in SKELETON_ROWS" :key="n" data-testid="subs-skeleton">
          <AdminCell v-for="c in COLUMNS" :key="c.key">
            <USkeleton class="h-4 w-full max-w-32" />
          </AdminCell>
        </AdminRow>
      </template>

      <AdminRow v-else-if="rows.length === 0" data-testid="subs-empty">
        <AdminCell :colspan="COLUMNS.length">
          <UIcon name="i-ph-file-text" class="mx-auto mb-3 size-10 text-muted" aria-hidden="true" />
          <p class="text-label text-default">Tiada langganan dijumpai.</p>
        </AdminCell>
      </AdminRow>

      <template v-else>
        <AdminRow v-for="row in rows" :key="row.id" data-testid="subs-row" :data-sub-id="row.id">
          <AdminCell label="Sekolah">
            <div class="flex flex-col gap-1">
              <span class="text-body text-highlighted">{{ row.school.name }}</span>
              <span class="text-label text-muted">{{ row.school.code }}</span>
            </div>
          </AdminCell>
          <AdminCell label="Tingkatan">
            <UBadge
              color="neutral"
              variant="subtle"
              :label="levelLabel(row.formLevel)"
              data-testid="subs-level-badge"
            />
          </AdminCell>
          <AdminCell label="Pakej">
            <UBadge
              color="neutral"
              variant="subtle"
              :icon="row.packageTier === 'basic' ? 'i-ph-eye' : 'i-ph-infinity'"
              :label="TIER_LABEL[row.packageTier]"
              data-testid="subs-tier-badge"
            />
          </AdminCell>
          <AdminCell label="Kuota">
            <div class="flex items-center gap-2">
              <UProgress
                class="w-24"
                :model-value="percent(row.used, row.studentQuota)"
                :color="barColor(percent(row.used, row.studentQuota))"
                :aria-label="`Kuota digunakan ${String(percent(row.used, row.studentQuota))}%`"
              />
              <span class="text-label text-muted" data-testid="subs-quota"
                >{{ row.used }}/{{ row.studentQuota }}</span
              >
            </div>
          </AdminCell>
          <AdminCell label="Status">
            <UBadge
              :color="STATUS_BADGE[row.status].color"
              variant="subtle"
              :label="STATUS_BADGE[row.status].label"
              data-testid="subs-status-badge"
            />
          </AdminCell>
          <AdminCell label="Mula">
            <span class="text-nowrap">{{ formatDate(row.startsAt) }}</span>
          </AdminCell>
          <AdminCell label="Tamat">
            <span class="text-nowrap">{{ formatDate(row.endsAt) }}</span>
          </AdminCell>
          <AdminCell label="Tindakan">
            <UButton
              :to="{ name: SUBSCRIPTION_ROUTES.detail, params: { id: row.id } }"
              color="neutral"
              variant="soft"
              trailing-icon="i-ph-arrow-right"
              label="Lihat"
              data-testid="subs-view"
            />
          </AdminCell>
        </AdminRow>
      </template>
    </AdminTable>
  </DsPage>
</template>
