<script setup lang="ts">
/**
 * R1-ADM-P2-07 `/admin/hadiah` "Kedai Hadiah Digital" (30 P2-07, P07-01..15; S7-T11), and the same page in
 * `mode` create / edit for `/admin/hadiah/baharu` and `/admin/hadiah/:id/edit` (one form, `AdminHadiahForm`).
 * List: four tiles from `meta.cards`, the category pills (a link each, so the filter and the page live in the
 * URL), the table (cards below `md`) at 50 a page, the bulk toolbar "{n} hadiah dipilih" with its seven
 * actions, and the "Tebusan Queue" card (`AdminRedemptionsPage`, decision 4 on #562). A page past the last
 * goes back to the last one; the empty copy is for a category filter only (FR-ADM-P2-07.2). `Padam` keeps a
 * reward that has a redemption and says so (FR-ADM-P2-07.4). The queue sits below the catalogue at every width
 * (V2 clipped the last column of a two-column layout).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { useApi, useFlash } from '@/composables'
import {
  DsBadge,
  DsCallout,
  DsCluster,
  DsDataTable,
  DsDialog,
  DsFormBar,
  DsFormField,
  DsPage,
  DsPillNav,
  DsStack,
  DsStatRow,
  DsText,
  formatCount,
  type PillItem,
  type StatItem,
} from '@/ds'
import { formatNumber } from '@/lib/number'

import { bulkHadiah, fetchHadiahList } from '../api/admin'
import {
  HADIAH_CATEGORIES,
  HADIAH_CATEGORY_LABELS,
  type BulkAction,
  type HadiahListItem,
} from '../api/types'
import AdminHadiahForm from '../components/AdminHadiahForm.vue'
import {
  COMMON_COPY,
  HADIAH_ADMIN_COPY as COPY,
  HADIAH_ADMIN_PROPOSED as PROPOSED,
} from '../components/copy'
import AdminRedemptionsPage from './AdminRedemptionsPage.vue'

const props = withDefaults(
  defineProps<{ mode?: 'list' | 'create' | 'edit'; id?: string }>(),
  { mode: 'list', id: undefined },
)

type Row = HadiahListItem & Record<string, unknown>

const PAGE_SIZE = 50
const LIST_PATH = '/admin/hadiah'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

// --- the form modes --------------------------------------------------------------------------------------

async function onSaved(): Promise<void> {
  flash.set({ type: 'success', message: props.mode === 'create' ? PROPOSED.created : PROPOSED.saved })
  await router.push(LIST_PATH)
}

// --- the list ----------------------------------------------------------------------------------------------

const first = (value: unknown): string | undefined => {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === 'string' ? v : undefined
}
const cat = computed(() => first(route.query.cat) ?? 'all')
const page = computed(() => {
  const n = Number(first(route.query.page))
  return Number.isInteger(n) && n >= 1 ? n : 1
})

const list = useApi(
  (signal) => fetchHadiahList({ cat: cat.value, page: page.value, signal }),
  [cat, page],
  { immediate: props.mode === 'list' },
)

const rows = computed<Row[]>(() => (list.data.value?.data ?? []) as Row[])
const meta = computed(() => list.data.value?.meta ?? null)

/** The query of the route without its page: the category stays, page 1 leaves the URL clean. */
const withoutPage = (): Record<string, string | null | (string | null)[]> =>
  Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== 'page'))

/** Moves to a page of the same category. */
function goToPage(next: number): void {
  void router.push({ path: LIST_PATH, query: next > 1 ? { ...withoutPage(), page: String(next) } : withoutPage() })
}
const tablePage = computed({
  get: () => page.value,
  set: (next: number) => goToPage(next),
})

// A page past the last goes back to the last one (FR-ADM-P2-07.2).
watch(list.data, (value) => {
  if (!value || value.meta.page <= value.meta.totalPages) return
  const last = value.meta.totalPages
  void router.replace({
    path: LIST_PATH,
    query: last > 1 ? { ...withoutPage(), page: String(last) } : withoutPage(),
  })
})

// The selection belongs to the page it was made on.
const selection = ref<Row[]>([])
watch([cat, page], () => {
  selection.value = []
})

const tiles = computed<StatItem[]>(() => {
  const cards = meta.value?.cards
  return [
    { key: 'total', label: COPY.tiles.total, value: cards?.total ?? null, icon: 'gift', accent: 'action' },
    { key: 'active', label: COPY.tiles.active, value: cards?.active ?? null, icon: 'check-circle', accent: 'win' },
    { key: 'month', label: COPY.tiles.month, value: cards?.redemptionsThisMonth ?? null, icon: 'coins', accent: 'heat' },
    { key: 'pending', label: COPY.tiles.pending, value: cards?.pendingAdmin ?? null, icon: 'hourglass', accent: 'trial' },
  ]
})

const pills = computed<PillItem<string>[]>(() => [
  { key: 'all', label: COPY.pillAll, to: { path: LIST_PATH }, testid: 'all' },
  ...HADIAH_CATEGORIES.map((key) => ({
    key: String(key),
    label: HADIAH_CATEGORY_LABELS[key].pill,
    to: { path: LIST_PATH, query: { cat: key } },
  })),
])

const COLUMNS: TableColumn<Row>[] = [
  { id: 'reward', header: COPY.columns.reward },
  { id: 'category', header: COPY.columns.category },
  { id: 'rm', header: COPY.columns.rm },
  { id: 'token', header: COPY.columns.token },
  { id: 'stock', header: COPY.columns.stock },
  { id: 'redemptions', header: COPY.columns.redemptions },
  { id: 'status', header: COPY.columns.status },
  { id: 'actions', header: COPY.columns.actions },
]
const CARD_FIELDS = [
  { key: 'vendor', label: COPY.columns.reward },
  { key: 'tokenCost', label: COPY.columns.token },
  { key: 'redemptionCount', label: COPY.columns.redemptions },
]

const categoryLabel = (row: HadiahListItem): string => HADIAH_CATEGORY_LABELS[row.category].pill
const rm = (row: HadiahListItem): string =>
  formatNumber(row.denominationRm, { decimals: 2, dropZeroFraction: true })
const stock = (row: HadiahListItem): string =>
  row.stockQuantity === null ? COPY.unlimited : formatCount(row.stockQuantity)
const editTo = (row: HadiahListItem): string => `${LIST_PATH}/${row.id}/edit`
const statusWord = (row: HadiahListItem): string => (row.isActive ? COPY.statusOn : COPY.statusOff)

// --- the bulk toolbar (P07-15) ---------------------------------------------------------------------------

const busy = ref(false)
const bulkFailure = ref('')

const ids = computed(() => selection.value.map((r) => r.id))

/** A failed write: the server's message, else the common one. */
const failureOf = (err: unknown): string => (isApiError(err) ? err.message : COMMON_COPY.actionFailed)

/** One bulk write (P07-15); it throws what the server refused with, for the caller to place. */
async function runBulk(
  action: BulkAction,
  extra: { stockValue?: string; maxPerMonthValue?: string; tokenCostDeltaPct?: string } = {},
): Promise<void> {
  busy.value = true
  bulkFailure.value = ''
  try {
    const result = await bulkHadiah({ action, ids: ids.value, ...extra })
    const kept = result.keptIds ?? []
    if (action === 'delete' && kept.length > 0) {
      flash.show({ type: 'error', message: COPY.hasRedemptions })
      // The kept ones stay selected, so `Nyahaktifkan` is one click away.
      selection.value = selection.value.filter((r) => kept.includes(r.id))
    } else {
      const done = action === 'delete' ? PROPOSED.bulkDeleted : PROPOSED.bulkDone
      flash.show({ type: 'success', message: done(result.affected) })
      selection.value = []
    }
    await list.reload()
  } finally {
    busy.value = false
  }
}

async function activate(on: boolean): Promise<void> {
  if (busy.value) return
  try {
    await runBulk(on ? 'activate' : 'deactivate')
  } catch (err) {
    bulkFailure.value = failureOf(err)
  }
}

/** The value dialogs: `Set Stok`, `Had/Bulan`, `Pelaras Token` (one input each, the server's message at it). */
type Prompt = 'stock' | 'maxPerMonth' | 'tokenCost'
interface PromptSpec {
  title: string
  label: string
  placeholder?: string
  action: BulkAction
  /** The request key of the value, which is also the key of the server's field message. */
  key: 'stockValue' | 'maxPerMonthValue' | 'tokenCostDeltaPct'
}
const PROMPTS: Record<Prompt, PromptSpec> = {
  stock: { title: COPY.bulk.stock, label: PROPOSED.stockPrompt, action: 'set_stock', key: 'stockValue' },
  maxPerMonth: {
    title: COPY.bulk.maxPerMonth,
    label: PROPOSED.maxPerMonthPrompt,
    action: 'set_max_per_month',
    key: 'maxPerMonthValue',
  },
  tokenCost: {
    title: COPY.bulk.tokenCost,
    label: PROPOSED.tokenCostPrompt,
    placeholder: PROPOSED.tokenCostPlaceholder,
    action: 'set_token_cost',
    key: 'tokenCostDeltaPct',
  },
}
const prompt = ref<Prompt | null>(null)
const promptOpen = computed({
  get: () => prompt.value !== null,
  set: (open: boolean) => {
    if (!open) prompt.value = null
  },
})
const promptValue = ref('')
const promptError = ref<string | undefined>()

function openPrompt(kind: Prompt): void {
  promptValue.value = ''
  promptError.value = undefined
  prompt.value = kind
}

async function submitPrompt(): Promise<void> {
  const kind = prompt.value
  if (kind === null || busy.value) return
  const spec = PROMPTS[kind]
  promptError.value = undefined
  try {
    await runBulk(spec.action, { [spec.key]: promptValue.value })
    prompt.value = null
  } catch (err) {
    promptError.value = (isApiError(err) ? err.fields?.[spec.key] : undefined) ?? failureOf(err)
  }
}

const deleteOpen = ref(false)
async function confirmDelete(): Promise<void> {
  if (busy.value) return
  try {
    await runBulk('delete')
  } catch (err) {
    bulkFailure.value = failureOf(err)
  } finally {
    deleteOpen.value = false
  }
}

const listStatus = computed(() =>
  list.error.value ? 'error' : list.data.value ? 'ready' : 'loading',
)
</script>

<template>
  <DsPage
    layout="list"
    :back-to="mode === 'list' ? undefined : LIST_PATH"
    data-testid="hadiah-page"
  >
    <template v-if="mode === 'list'" #actions>
      <UButton
        to="/admin/hadiah/tebusan"
        color="neutral"
        :label="COPY.queueLink"
        data-testid="hadiah-queue-link"
      />
      <UButton
        to="/admin/hadiah/baharu"
        :label="COPY.addNew"
        data-testid="hadiah-add"
      />
    </template>

    <AdminHadiahForm v-if="mode !== 'list'" :id="id" :mode="mode" @saved="onSaved" />

    <DsStack v-else gap="section">
      <DsStatRow :items="tiles" prefix="hadiah-tile" density="compact" :loading="listStatus === 'loading'" />

      <DsPillNav
        :items="pills"
        :active="meta ? meta.activeCat : cat"
        :label="COPY.pillsLabel"
        testid-prefix="hadiah-pill"
      />

      <DsCallout v-if="bulkFailure" tone="error" :description="bulkFailure" data-testid="hadiah-bulk-failure" />

      <DsStack gap="md">
        <DsText variant="subheading" as="p">{{ COPY.catalogue }}</DsText>
        <DsDataTable
          v-model:page="tablePage"
          v-model:selection="selection"
          :data="rows"
          :columns="COLUMNS"
          :caption="COPY.catalogue"
          variant="flush"
          density="compact"
          selectable
          row-key="id"
          :page-size="PAGE_SIZE"
          :total="meta?.totalItems ?? 0"
          :loading="listStatus === 'loading'"
          :error="list.error.value ? COMMON_COPY.loadFailed : undefined"
          :empty-title="cat !== 'all' ? COPY.empty : undefined"
          :filtered="cat !== 'all'"
          card-title="title"
          :card-fields="CARD_FIELDS"
          data-testid="hadiah-table"
          @retry="list.reload()"
        >
          <template #reward-cell="{ row }">
            <DsStack gap="xs">
              <DsText variant="body" :data-testid="`hadiah-title-${row.original.id}`">
                {{ row.original.iconEmoji }} {{ row.original.title }}
              </DsText>
              <DsText variant="caption" tone="muted">{{ row.original.vendor }}</DsText>
            </DsStack>
          </template>
          <template #category-cell="{ row }">{{ categoryLabel(row.original) }}</template>
          <template #rm-cell="{ row }">{{ rm(row.original) }}</template>
          <template #token-cell="{ row }">{{ formatCount(row.original.tokenCost) }}</template>
          <template #stock-cell="{ row }">{{ stock(row.original) }}</template>
          <template #redemptions-cell="{ row }">{{ formatCount(row.original.redemptionCount) }}</template>
          <template #status-cell="{ row }">
            <DsBadge
              :label="statusWord(row.original)"
              :tone="row.original.isActive ? 'success' : 'neutral'"
              :data-testid="`hadiah-status-${row.original.id}`"
            />
          </template>
          <template #actions-cell="{ row }">
            <UButton
              :to="editTo(row.original)"
              color="neutral"
              :label="COPY.edit"
              :data-testid="`hadiah-edit-${row.original.id}`"
            />
          </template>

          <template #card="{ row }">
            <DsStack gap="xs" :data-testid="`hadiah-card-${String(row.id)}`">
              <DsText variant="body-strong">
                {{ (row as Row).iconEmoji }} {{ (row as Row).title }}
              </DsText>
              <DsText variant="caption" tone="muted">
                {{ (row as Row).vendor }} · {{ categoryLabel(row as Row) }}
              </DsText>
              <DsCluster gap="sm">
                <DsBadge
                  :label="statusWord(row as Row)"
                  :tone="(row as Row).isActive ? 'success' : 'neutral'"
                  :data-testid="`hadiah-status-${String(row.id)}`"
                />
                <DsText variant="caption" tone="muted">
                  RM {{ rm(row as Row) }} · {{ formatCount((row as Row).tokenCost) }} {{ COPY.columns.token }}
                  · {{ COPY.columns.stock }} {{ stock(row as Row) }} · {{ COPY.columns.redemptions }}
                  {{ formatCount((row as Row).redemptionCount) }}
                </DsText>
              </DsCluster>
              <DsCluster gap="sm">
                <UButton
                  :to="editTo(row as Row)"
                  color="neutral"
                  :label="COPY.edit"
                  :data-testid="`hadiah-edit-${String(row.id)}`"
                />
              </DsCluster>
            </DsStack>
          </template>
        </DsDataTable>
      </DsStack>

      <AdminRedemptionsPage embedded @changed="list.reload()" />

      <DsFormBar v-if="selection.length > 0" :show-cancel="false" data-testid="hadiah-bulk">
        <template #status>
          <DsText variant="body-strong" data-testid="hadiah-selected">
            {{ COPY.selected(selection.length) }}
          </DsText>
        </template>
        <template #extra>
          <UButton :label="COPY.bulk.activate" :disabled="busy" data-testid="hadiah-bulk-activate" @click="activate(true)" />
          <UButton color="neutral" :label="COPY.bulk.deactivate" :disabled="busy" data-testid="hadiah-bulk-deactivate" @click="activate(false)" />
          <UButton color="neutral" :label="COPY.bulk.stock" :disabled="busy" data-testid="hadiah-bulk-stock" @click="openPrompt('stock')" />
          <UButton color="neutral" :label="COPY.bulk.maxPerMonth" :disabled="busy" data-testid="hadiah-bulk-max" @click="openPrompt('maxPerMonth')" />
          <UButton color="neutral" :label="COPY.bulk.tokenCost" :disabled="busy" data-testid="hadiah-bulk-cost" @click="openPrompt('tokenCost')" />
          <UButton color="error" :label="COPY.bulk.remove" :disabled="busy" data-testid="hadiah-bulk-delete" @click="deleteOpen = true" />
        </template>
        <template #submit>
          <UButton color="neutral" :label="COPY.bulk.cancel" :disabled="busy" data-testid="hadiah-bulk-clear" @click="selection = []" />
        </template>
      </DsFormBar>
    </DsStack>

    <DsDialog v-model:open="promptOpen" :title="prompt ? PROMPTS[prompt].title : COPY.catalogue" size="sm" :loading="busy">
      <DsStack
        id="hadiah-prompt-form"
        as="form"
        gap="md"
        data-testid="hadiah-prompt-form"
        @submit.prevent="submitPrompt"
      >
        <DsFormField v-if="prompt" native :label="PROMPTS[prompt].label" :error="promptError">
          <template #default="f">
            <UInput
              :id="f.id"
              v-model="promptValue"
              type="text"
              :placeholder="PROMPTS[prompt].placeholder"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="hadiah-prompt-value"
            />
          </template>
        </DsFormField>
        <DsText variant="caption" tone="muted">{{ COPY.selected(selection.length) }}</DsText>
      </DsStack>
      <template #footer>
        <UButton color="neutral" :label="COPY.bulk.cancel" data-testid="hadiah-prompt-close" @click="promptOpen = false" />
        <UButton
          type="submit"
          form="hadiah-prompt-form"
          :label="PROPOSED.apply"
          :loading="busy"
          data-testid="hadiah-prompt-go"
        />
      </template>
    </DsDialog>

    <DsDialog v-model:open="deleteOpen" :title="PROPOSED.deleteTitle" size="sm" tone="error" :loading="busy">
      <DsStack gap="sm" data-testid="hadiah-delete-body">
        <DsText variant="body">{{ PROPOSED.deleteBody(selection.length) }}</DsText>
      </DsStack>
      <template #footer>
        <UButton color="neutral" :label="COPY.bulk.cancel" data-testid="hadiah-delete-keep" @click="deleteOpen = false" />
        <UButton color="error" :label="PROPOSED.deleteGo" :loading="busy" data-testid="hadiah-delete-go" @click="confirmDelete" />
      </template>
    </DsDialog>
  </DsPage>
</template>
