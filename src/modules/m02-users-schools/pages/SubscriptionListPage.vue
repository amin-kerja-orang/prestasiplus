<script setup lang="ts">
/**
 * S12 `/admin/school-subscriptions` "Langganan Sekolah - Admin PRESTASIPLUS" (M02-T9; FR-M02-82, 83).
 *
 * - Four stat cards (`meta.counts`, over all subscriptions: Aktif, Tempoh Ihsan, Tamat Tempoh, Jumlah
 *   Kuota Pelajar of the active rows only).
 * - GET filter (`search`, `status`, `form_level`, "Cari") and "Langganan Baru". The query string is the
 *   state, as on the live GET form.
 * - All rows, no pagination; the table scrolls inside its card below its natural width.
 */
import { ArrowRight, FilePenLine, Infinity as InfinityIcon, Eye, Plus, Search } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { FORM_INPUT_CLASS } from '@/components/form'
import { useApi } from '@/composables'
import { formatDate } from '@/lib/time'
import { formatNumber } from '@/lib/number'

import {
  fetchSubscriptions,
  type SchoolFormLevel,
  type SubscriptionStatus,
} from '../api/subscriptions'
import { errorLines } from '../lib/school-errors'
import {
  barClass,
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

function percent(used: number, quota: number): number {
  return quota > 0 ? Math.min(100, Math.round((used * 100) / quota)) : 0
}

const COLUMNS = ['Sekolah', 'Tingkatan', 'Pakej', 'Kuota', 'Status', 'Mula', 'Tamat', ''] as const
const SKELETON_ROWS = 5
const STAT_CARD = 'rounded-2xl p-5 shadow'
const STAT_NUMBER = 'font-heading text-3xl font-bold'
</script>

<template>
  <div class="space-y-4 sm:space-y-6" data-testid="subs-page">
    <section class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <div :class="[STAT_CARD, 'bg-emerald-50 text-emerald-600']" data-testid="subs-stat-active">
        <div v-if="counts" :class="STAT_NUMBER">{{ formatNumber(counts.active) }}</div>
        <div v-else class="h-9 w-16 animate-pulse rounded-lg bg-white/70"></div>
        <p class="text-sm">Aktif</p>
      </div>
      <div :class="[STAT_CARD, 'bg-amber-50 text-amber-600']" data-testid="subs-stat-grace">
        <div v-if="counts" :class="STAT_NUMBER">{{ formatNumber(counts.grace) }}</div>
        <div v-else class="h-9 w-16 animate-pulse rounded-lg bg-white/70"></div>
        <p class="text-sm">Tempoh Ihsan</p>
      </div>
      <div :class="[STAT_CARD, 'bg-red-50 text-red-600']" data-testid="subs-stat-expired">
        <div v-if="counts" :class="STAT_NUMBER">{{ formatNumber(counts.expired) }}</div>
        <div v-else class="h-9 w-16 animate-pulse rounded-lg bg-white/70"></div>
        <p class="text-sm">Tamat Tempoh</p>
      </div>
      <div :class="[STAT_CARD, 'bg-blue-50 text-blue-600']" data-testid="subs-stat-quota">
        <div v-if="counts" :class="STAT_NUMBER">{{ formatNumber(counts.totalQuota) }}</div>
        <div v-else class="h-9 w-16 animate-pulse rounded-lg bg-white/70"></div>
        <p class="text-sm">Jumlah Kuota Pelajar</p>
      </div>
    </section>

    <form
      method="get"
      class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow sm:p-5 md:flex-row md:items-center"
      data-testid="subs-filter"
      @submit.prevent="submitFilter"
    >
      <input
        v-model="search"
        type="text"
        name="search"
        placeholder="Cari sekolah..."
        :class="[FORM_INPUT_CLASS, 'min-h-11 md:min-w-0 md:flex-1']"
        data-testid="subs-search"
      />
      <select
        v-model="status"
        name="status"
        :class="[FORM_INPUT_CLASS, 'min-h-11 md:w-auto']"
        data-testid="subs-status"
      >
        <option value="">Semua Status</option>
        <option v-for="o in STATUS_FILTER_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>
      <select
        v-model="formLevel"
        name="form_level"
        :class="[FORM_INPUT_CLASS, 'min-h-11 md:w-auto']"
        data-testid="subs-level"
      >
        <option value="">Semua Tingkatan</option>
        <option v-for="o in FORM_LEVEL_FILTER_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>
      <button
        type="submit"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        data-testid="subs-search-submit"
      >
        <Search class="h-4 w-4" aria-hidden="true" />
        Cari
      </button>
      <RouterLink
        :to="{ name: SUBSCRIPTION_ROUTES.create }"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 md:ml-auto"
        data-testid="subs-add"
      >
        <Plus class="h-4 w-4" aria-hidden="true" />
        Langganan Baru
      </RouterLink>
    </form>

    <div v-if="error" class="space-y-3" data-testid="subs-error">
      <AlertBox :messages="errorLines(error)" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-600"
        data-testid="subs-retry"
        @click="reload()"
      >
        Cuba Lagi
      </button>
    </div>

    <DataTableCard v-else :min-width="880">
      <table :class="T.table" data-testid="subs-table">
        <thead>
          <tr>
            <th v-for="(label, i) in COLUMNS" :key="i" scope="col" :class="T.th">{{ label }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="firstLoad">
            <tr v-for="n in SKELETON_ROWS" :key="n" :class="T.row" data-testid="subs-skeleton">
              <td v-for="(_, i) in COLUMNS" :key="i" :class="T.td">
                <div class="h-4 w-full max-w-32 animate-pulse rounded bg-slate-100"></div>
              </td>
            </tr>
          </template>

          <tr v-else-if="rows.length === 0" :class="T.row" data-testid="subs-empty">
            <td :colspan="COLUMNS.length" class="px-4 py-12 text-center text-slate-400">
              <FilePenLine
                class="mr-2 inline-block h-10 w-10 align-middle text-slate-400"
                aria-hidden="true"
              />
              <span class="align-middle">Tiada langganan dijumpai.</span>
            </td>
          </tr>

          <template v-else>
            <tr
              v-for="row in rows"
              :key="row.id"
              :class="[T.row, 'align-middle']"
              data-testid="subs-row"
              :data-sub-id="row.id"
            >
              <td :class="[T.td, 'min-w-48']">
                <div class="font-semibold text-slate-800">{{ row.school.name }}</div>
                <div class="font-mono text-xs text-slate-400">{{ row.school.code }}</div>
              </td>
              <td :class="T.td">
                <span
                  class="inline-block rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-purple-700"
                  data-testid="subs-level-badge"
                  >{{ levelLabel(row.formLevel) }}</span
                >
              </td>
              <td :class="T.td">
                <span
                  :class="[
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                    row.packageTier === 'basic'
                      ? 'bg-cyan-100 text-cyan-700'
                      : 'bg-emerald-100 text-emerald-700',
                  ]"
                  data-testid="subs-tier-badge"
                >
                  <Eye v-if="row.packageTier === 'basic'" class="h-3 w-3" aria-hidden="true" />
                  <InfinityIcon v-else class="h-3 w-3" aria-hidden="true" />
                  {{ TIER_LABEL[row.packageTier] }}
                </span>
              </td>
              <td :class="[T.td, 'whitespace-nowrap']">
                <div class="flex items-center gap-2">
                  <div class="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                    <div
                      :class="[
                        'h-full rounded-full',
                        barClass(percent(row.used, row.studentQuota)),
                      ]"
                      :style="{ width: `${percent(row.used, row.studentQuota)}%` }"
                    ></div>
                  </div>
                  <span class="text-xs text-slate-600" data-testid="subs-quota"
                    >{{ row.used }}/{{ row.studentQuota }}</span
                  >
                </div>
              </td>
              <td :class="T.td">
                <span
                  :class="[
                    'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                    STATUS_BADGE[row.status].cls,
                  ]"
                  data-testid="subs-status-badge"
                  >{{ STATUS_BADGE[row.status].label }}</span
                >
              </td>
              <td :class="[T.td, 'whitespace-nowrap']">{{ formatDate(row.startsAt) }}</td>
              <td :class="[T.td, 'whitespace-nowrap']">{{ formatDate(row.endsAt) }}</td>
              <td :class="T.td">
                <RouterLink
                  :to="{ name: SUBSCRIPTION_ROUTES.detail, params: { id: row.id } }"
                  class="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800 lg:min-h-0"
                  data-testid="subs-view"
                >
                  Lihat <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
                </RouterLink>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </DataTableCard>
  </div>
</template>
