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

import { useApi } from '@/composables'
import { DsFilterBar, DsPage, DsStatTile } from '@/ds'
import { formatNumber } from '@/lib/number'
import { formatDate } from '@/lib/time'

import {
  fetchSubscriptions,
  type SchoolFormLevel,
  type SubscriptionStatus,
} from '../api/subscriptions'
import AdminAlert from '../components/AdminAlert.vue'
import CardCell from '../components/native/CardCell.vue'
import CardRow from '../components/native/CardRow.vue'
import CardTable from '../components/native/CardTable.vue'
import NativeSelect from '../components/native/NativeSelect.vue'
import { errorLines } from '../lib/school-errors'
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
const activeCount = computed(() => [status.value, formLevel.value].filter((v) => v !== '').length)

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
  { key: 'view', label: 'Tindakan' },
]
const SKELETON_ROWS = 5
</script>

<template>
  <DsPage data-testid="subs-page">
    <template #actions>
      <UButton
        :to="{ name: SUBSCRIPTION_ROUTES.create }"
        icon="i-ph-plus"
        label="Langganan Baru"
        data-testid="subs-add"
      />
    </template>

    <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div data-testid="subs-stat-active">
        <DsStatTile
          v-if="counts"
          :value="formatNumber(counts.active)"
          unit="Aktif"
          icon="i-ph-check-circle"
        />
        <USkeleton v-else class="h-24 w-full" />
      </div>
      <div data-testid="subs-stat-grace">
        <DsStatTile
          v-if="counts"
          :value="formatNumber(counts.grace)"
          unit="Tempoh Ihsan"
          icon="i-ph-hourglass-medium"
        />
        <USkeleton v-else class="h-24 w-full" />
      </div>
      <div data-testid="subs-stat-expired">
        <DsStatTile
          v-if="counts"
          :value="formatNumber(counts.expired)"
          unit="Tamat Tempoh"
          icon="i-ph-calendar-x"
        />
        <USkeleton v-else class="h-24 w-full" />
      </div>
      <div data-testid="subs-stat-quota">
        <DsStatTile
          v-if="counts"
          :value="formatNumber(counts.totalQuota)"
          unit="Jumlah Kuota Pelajar"
          icon="i-ph-users"
        />
        <USkeleton v-else class="h-24 w-full" />
      </div>
    </section>

    <DsFilterBar
      :active-count="activeCount"
      data-testid="subs-filter"
      @apply="submitFilter"
      @reset="resetFilter"
    >
      <template #search>
        <UInput
          v-model="search"
          type="text"
          name="search"
          aria-label="Cari"
          placeholder="Cari sekolah..."
          icon="i-ph-magnifying-glass"
          size="lg"
          class="md:w-72"
          data-testid="subs-search"
        />
      </template>
      <NativeSelect
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
      </NativeSelect>
      <NativeSelect
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
      </NativeSelect>
    </DsFilterBar>

    <div v-if="error" class="flex flex-col gap-3" data-testid="subs-error">
      <AdminAlert :messages="errorLines(error)" />
      <div>
        <UButton label="Cuba Lagi" data-testid="subs-retry" @click="reload()" />
      </div>
    </div>

    <CardTable v-else :columns="COLUMNS" caption="Senarai langganan sekolah" data-testid="subs-table">
      <template v-if="firstLoad">
        <CardRow v-for="n in SKELETON_ROWS" :key="n" data-testid="subs-skeleton">
          <CardCell v-for="c in COLUMNS" :key="c.key">
            <USkeleton class="h-4 w-full max-w-32" />
          </CardCell>
        </CardRow>
      </template>

      <CardRow v-else-if="rows.length === 0" data-testid="subs-empty">
        <CardCell :colspan="COLUMNS.length">
          <UIcon name="i-ph-file-text" class="mx-auto mb-2 size-8 text-muted" aria-hidden="true" />
          <p class="text-label text-default">Tiada langganan dijumpai.</p>
        </CardCell>
      </CardRow>

      <template v-else>
        <CardRow v-for="row in rows" :key="row.id" data-testid="subs-row" :data-sub-id="row.id">
          <CardCell label="Sekolah">
            <div class="flex flex-col gap-1">
              <span class="text-label text-highlighted">{{ row.school.name }}</span>
              <span class="text-caption text-muted">{{ row.school.code }}</span>
            </div>
          </CardCell>
          <CardCell label="Tingkatan">
            <UBadge
              color="neutral"
              variant="subtle"
              :label="levelLabel(row.formLevel)"
              data-testid="subs-level-badge"
            />
          </CardCell>
          <CardCell label="Pakej">
            <UBadge
              color="neutral"
              variant="subtle"
              :icon="row.packageTier === 'basic' ? 'i-ph-eye' : 'i-ph-infinity'"
              :label="TIER_LABEL[row.packageTier]"
              data-testid="subs-tier-badge"
            />
          </CardCell>
          <CardCell label="Kuota">
            <div class="flex items-center gap-2">
              <UProgress
                class="w-20"
                :model-value="percent(row.used, row.studentQuota)"
                :color="barColor(percent(row.used, row.studentQuota))"
                :aria-label="`Kuota digunakan ${String(percent(row.used, row.studentQuota))}%`"
              />
              <span class="text-caption text-muted" data-testid="subs-quota"
                >{{ row.used }}/{{ row.studentQuota }}</span
              >
            </div>
          </CardCell>
          <CardCell label="Status">
            <UBadge
              :color="STATUS_BADGE[row.status].color"
              variant="subtle"
              :label="STATUS_BADGE[row.status].label"
              data-testid="subs-status-badge"
            />
          </CardCell>
          <CardCell label="Mula">
            <span class="text-nowrap">{{ formatDate(row.startsAt) }}</span>
          </CardCell>
          <CardCell label="Tamat">
            <span class="text-nowrap">{{ formatDate(row.endsAt) }}</span>
          </CardCell>
          <CardCell label="Tindakan">
            <UButton
              :to="{ name: SUBSCRIPTION_ROUTES.detail, params: { id: row.id } }"
              size="sm"
              color="neutral"
              variant="soft"
              trailing-icon="i-ph-arrow-right"
              label="Lihat"
              data-testid="subs-view"
            />
          </CardCell>
        </CardRow>
      </template>
    </CardTable>
  </DsPage>
</template>
