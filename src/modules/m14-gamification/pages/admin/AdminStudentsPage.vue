<script setup lang="ts">
/**
 * `/admin/gamification/students` "Pelajar Gamifikasi" (V2 `admin/gamification/students.blade.php`; M14 S4), read only:
 * filter bar (Tier, "Cari (nama / emel)") over the wallet table, 20 a page. The query string holds the filter, as on the
 * V2 GET form. The tier select posts the tier id, as V2 does (the API also takes the key); the "Streak" column (`streak`,
 * T-C12; 0 when the mock sends none) is the last one. The "Beri syiling" award (`#29`) is not on the V2 blade and is not built here.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsBadge,
  DsCluster,
  DsDataTable,
  DsFilterBar,
  DsIcon,
  DsNativeSelect,
  DsPage,
  DsStack,
  DsText,
  formatCount,
} from '@/ds'

import { fetchAdminStudents, fetchAdminTiers } from '../../api/admin'
import type { AdminStudentRow } from '../../api/types'
import { ADMIN_COMMON, STUDENTS_COPY as COPY } from '../../lib/admin/copy'
import { tierText, tierTone } from '../../lib/admin/format'

const PAGE_SIZE = 20
const PATH = '/admin/gamification/students'

const route = useRoute()
const router = useRouter()

function queryText(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value
  return first ?? ''
}

const applied = computed(() => ({ tier: queryText(route.query.tier), q: queryText(route.query.q).trim() }))
const tier = ref(queryText(route.query.tier))
const search = ref(queryText(route.query.q))
const page = ref(1)
watch(
  () => [route.query.tier, route.query.q] as const,
  ([t, q]) => {
    tier.value = queryText(t)
    search.value = queryText(q)
    page.value = 1
  },
)

const tiers = useApi((signal) => fetchAdminTiers({ signal }))
const list = useApi(
  (signal) =>
    fetchAdminStudents({
      tier: applied.value.tier,
      search: applied.value.q,
      page: page.value,
      signal,
    }),
  [() => route.query.tier, () => route.query.q, page],
)

const tierList = computed(() => tiers.data.value ?? [])
type Row = AdminStudentRow & Record<string, unknown>
const rows = computed(() => (list.data.value?.data ?? []) as Row[])
const total = computed(() => list.data.value?.meta.totalItems ?? 0)
const filtered = computed(() => applied.value.tier !== '' || applied.value.q !== '')

const chips = computed<{ key: string; label: string }[]>(() => {
  const out: { key: string; label: string }[] = []
  if (applied.value.tier !== '') out.push({ key: 'tier', label: tierText(tierList.value, applied.value.tier) })
  if (applied.value.q !== '') out.push({ key: 'q', label: applied.value.q })
  return out
})

async function push(next: { tier: string; q: string }): Promise<void> {
  const query: Record<string, string> = {}
  if (next.tier !== '') query.tier = next.tier
  if (next.q !== '') query.q = next.q
  if (next.tier === applied.value.tier && next.q === applied.value.q) await list.reload()
  else await router.push({ path: PATH, query })
}
const submit = (): Promise<void> => push({ tier: tier.value, q: search.value.trim() })
const reset = (): Promise<void> => push({ tier: '', q: '' })
function removeChip(key: string): Promise<void> {
  return push({ tier: key === 'tier' ? '' : applied.value.tier, q: key === 'q' ? '' : applied.value.q })
}

const COLUMNS: TableColumn<Row>[] = [
  { accessorKey: 'name', header: COPY.columns.student },
  { accessorKey: 'tierKey', header: COPY.columns.tier },
  { accessorKey: 'level', header: COPY.columns.level },
  { accessorKey: 'currentSyiling', header: COPY.columns.balance },
  { accessorKey: 'tokenBalance', header: COPY.columns.token },
  { accessorKey: 'totalSyilingEarned', header: COPY.columns.lifetime },
  { accessorKey: 'xp', header: COPY.columns.xp },
  { accessorKey: 'streak', header: COPY.columns.streak },
]
</script>

<template>
  <DsPage layout="list" data-testid="gam-students">
    <DsFilterBar
      :chips="chips"
      :active-count="chips.length"
      data-testid="gam-students-filter"
      @apply="submit"
      @reset="reset"
      @remove-chip="removeChip"
    >
      <template #search>
        <UInput
          v-model="search"
          type="text"
          name="q"
          :aria-label="COPY.searchLabel"
          :placeholder="COPY.searchPlaceholder"
          icon="i-ph-magnifying-glass"
          data-testid="gam-students-search"
        />
      </template>
      <DsNativeSelect v-model="tier" name="tier" :aria-label="COPY.tierLabel" data-testid="gam-students-tier">
        <option value="">{{ COPY.allTiers }}</option>
        <option v-for="t in tierList" :key="t.id" :value="t.id">{{ t.icon }} {{ t.labelMs }}</option>
      </DsNativeSelect>
    </DsFilterBar>

    <DsDataTable
      v-model:page="page"
      :data="rows"
      :columns="COLUMNS"
      :caption="COPY.caption"
      variant="flush"
      density="tight"
      :page-size="PAGE_SIZE"
      :total="total"
      :filtered="filtered"
      :loading="list.loading.value && !list.data.value"
      :error="list.error.value ? ADMIN_COMMON.loadFailed : undefined"
      :empty-title="COPY.empty"
      row-key="userId"
      data-testid="gam-students-table"
      @retry="list.reload()"
    >
      <template #name-cell="{ row }">
        <DsStack gap="xs">
          <DsText variant="body" truncate>{{ row.original.name }}</DsText>
          <DsText variant="caption" tone="muted" truncate>
            {{ row.original.email }} · ID: {{ row.original.userId }}
          </DsText>
        </DsStack>
      </template>
      <template #tierKey-cell="{ row }">
        <DsBadge
          v-if="row.original.tierKey"
          :label="tierText(tierList, row.original.tierKey)"
          :tone="tierTone(row.original.tierColor)"
          size="sm"
        />
        <DsText v-else variant="caption" tone="muted">—</DsText>
      </template>
      <template #level-cell="{ row }">{{ row.original.level }}</template>
      <template #currentSyiling-cell="{ row }">
        <DsText variant="body-strong" tone="warning" tabular>{{ formatCount(row.original.currentSyiling) }}</DsText>
      </template>
      <template #tokenBalance-cell="{ row }">
        <DsText variant="body-strong" tone="success" tabular>{{ formatCount(row.original.tokenBalance) }}</DsText>
      </template>
      <template #totalSyilingEarned-cell="{ row }">{{ formatCount(row.original.totalSyilingEarned) }}</template>
      <template #xp-cell="{ row }">{{ formatCount(row.original.xp) }}</template>
      <template #streak-cell="{ row }">
        <DsCluster gap="xs" as="span" justify="end" :wrap="false">
          <DsIcon name="fire" />
          <DsText variant="body" tone="muted" as="span" tabular>{{ row.original.streak ?? 0 }}</DsText>
        </DsCluster>
      </template>
    </DsDataTable>
  </DsPage>
</template>
