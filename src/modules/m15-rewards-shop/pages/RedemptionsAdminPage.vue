<script setup lang="ts">
/**
 * R1-ADM-P2-08 `/admin/hadiah/tebusan` "Tebusan Hadiah Pelajar" (30 P2-08, 48 GAME-21; S7-T11), also the
 * "Tebusan Queue" card of `/admin/hadiah` (`embedded`, decision 4 on #562). Status pills `Menunggu`
 * (default), `Dihantar`, `Dibatalkan`, `Semua` (decision 5); the V1 words are not shown. A `Menunggu` row has
 * `Hantar kod` (a code of 1 to 100 characters, trimmed) and `Batal`; a stored `pending_parent_consent`
 * row shows under `Semua` only, with `Batal` only (decision 6). Delivery writes no notification record
 * (decision 16); the pupil's history shows `Dihantar` and the code. Cancel confirms in a `DsDialog` with
 * the focus on `Batal` and stacked 44 px buttons (AC-GM-21.8). 50 a page: an out-of-range page goes back
 * to the last one. A repeated action answers 409 and the row is refreshed.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { useApi, useFlash } from '@/composables'
import {
  DsBadge,
  DsCallout,
  DsCluster,
  DsDataTable,
  DsDialog,
  DsFormField,
  DsHeading,
  DsPage,
  DsPillNav,
  DsStack,
  DsText,
  formatCount,
  type PillItem,
} from '@/ds'
import { formatNumber } from '@/lib/number'

import { cancelRedemption, deliverRedemption, fetchRedemptions } from '../api/admin'
import type { RedemptionListItem, RedemptionStatus } from '../api/types'
import { HADIAH_ADMIN_PROPOSED as PROPOSED, TEBUSAN_ADMIN_COPY as COPY, COMMON_COPY } from '../components/copy'
import { formatDate } from '../components/format'

const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false })
const emit = defineEmits<{ changed: [] }>()

type Filter = 'pending_admin' | 'delivered' | 'cancelled' | 'all'
type Row = RedemptionListItem & Record<string, unknown>

const FILTERS: readonly Filter[] = ['pending_admin', 'delivered', 'cancelled', 'all']
const PAGE_SIZE = 50

const route = useRoute()
const flash = useFlash()

/** The route page may open on a status (`?status=`); the card always starts on `Menunggu`. */
function firstFilter(): Filter {
  const raw = props.embedded ? undefined : route.query.status
  const value = Array.isArray(raw) ? raw[0] : raw
  return FILTERS.find((f) => f === value) ?? 'pending_admin'
}

const filter = ref<Filter>(firstFilter())
const page = ref(1)

const list = useApi(
  (signal) => fetchRedemptions({ status: filter.value, page: page.value, signal }),
  [filter, page],
)

const rows = computed<Row[]>(() => (list.data.value?.data ?? []) as Row[])
const total = computed(() => list.data.value?.meta.totalItems ?? 0)

watch(filter, () => {
  page.value = 1
})
// An out-of-range page goes back to the last one (FR-ADM-P2-07.2 / 08).
watch(list.data, (value) => {
  if (value && value.meta.page > value.meta.totalPages) page.value = value.meta.totalPages
})

const pills = computed<PillItem<Filter>[]>(() =>
  FILTERS.map((key) => ({
    key,
    label: key === 'all' ? COPY.pillAll : COPY.status[key],
    testid: key,
  })),
)

const COLUMNS: TableColumn<Row>[] = [
  { id: 'student', header: COPY.columns.student },
  { id: 'reward', header: COPY.columns.reward },
  { id: 'rm', header: COPY.columns.rm },
  { id: 'token', header: COPY.columns.token },
  { id: 'status', header: COPY.columns.status },
  { id: 'date', header: COPY.columns.date },
  { id: 'actions', header: COPY.columns.actions },
]
const CARD_FIELDS = [
  { key: 'rewardVendor', label: COPY.columns.reward },
  { key: 'tokenCost', label: COPY.columns.token },
  { key: 'createdAt', label: COPY.columns.date },
]

const rm = (row: RedemptionListItem): string =>
  formatNumber(row.denominationRm, { decimals: 2, dropZeroFraction: true })
const statusWord = (status: RedemptionStatus): string => COPY.status[status]
const statusTone = (status: RedemptionStatus): 'warning' | 'success' | 'neutral' =>
  status === 'delivered' ? 'success' : status === 'cancelled' ? 'neutral' : 'warning'
/** `Hantar kod` only on `Menunggu`; `Batal` also on a stored consent row (decision 6). */
const canDeliver = (row: RedemptionListItem): boolean => row.status === 'pending_admin'
const canCancel = (row: RedemptionListItem): boolean =>
  row.status === 'pending_admin' || row.status === 'pending_parent_consent'

/** A failed action: the server's message when it gave one, else the common one. */
function failure(err: unknown): string {
  return isApiError(err) ? err.message : COMMON_COPY.actionFailed
}

// --- Hantar kod -----------------------------------------------------------------------------------------

const deliverRow = ref<Row | null>(null)
const deliverOpen = computed({
  get: () => deliverRow.value !== null,
  set: (open: boolean) => {
    if (!open) deliverRow.value = null
  },
})
const code = ref('')
const codeError = ref<string | undefined>()
const deliverFailure = ref('')
const delivering = ref(false)

function openDeliver(row: Row): void {
  code.value = ''
  codeError.value = undefined
  deliverFailure.value = ''
  deliverRow.value = row
}

/** A deliver or cancel moves the tiles and the stock of the catalogue that embeds this page. */
async function afterAction(): Promise<void> {
  emit('changed')
  await list.reload()
}

async function submitDeliver(): Promise<void> {
  const row = deliverRow.value
  if (!row || delivering.value) return
  if (code.value.trim() === '') {
    codeError.value = COPY.codeRequired
    return
  }
  delivering.value = true
  codeError.value = undefined
  deliverFailure.value = ''
  try {
    await deliverRedemption(row.id, code.value)
    deliverRow.value = null
    flash.show({ type: 'success', message: COPY.delivered })
    await afterAction()
  } catch (err) {
    if (isApiError(err) && err.fields?.code) {
      codeError.value = err.fields.code
    } else if (isApiError(err) && err.status === 409) {
      // Settled by someone else meanwhile: say so and show the row as it is now.
      deliverRow.value = null
      flash.show({ type: 'error', message: err.message })
      await afterAction()
    } else {
      deliverFailure.value = failure(err)
    }
  } finally {
    delivering.value = false
  }
}

// --- Batal ----------------------------------------------------------------------------------------------

const cancelRow = ref<Row | null>(null)
const cancelOpen = computed({
  get: () => cancelRow.value !== null,
  set: (open: boolean) => {
    if (!open) cancelRow.value = null
  },
})
const cancelFailure = ref('')
const cancelling = ref(false)

/** The focus starts on `Batal` (the safe choice), not on the close button (AC-GM-21.8). */
function focusKeep(vnode: { el: unknown }): void {
  if (vnode.el instanceof HTMLElement) vnode.el.focus()
}

function openCancel(row: Row): void {
  cancelFailure.value = ''
  cancelRow.value = row
}

async function confirmCancel(): Promise<void> {
  const row = cancelRow.value
  if (!row || cancelling.value) return
  cancelling.value = true
  cancelFailure.value = ''
  try {
    await cancelRedemption(row.id)
    cancelRow.value = null
    flash.show({ type: 'success', message: PROPOSED.cancelled })
    await afterAction()
  } catch (err) {
    if (isApiError(err) && err.status === 409) {
      cancelRow.value = null
      flash.show({ type: 'error', message: err.message })
      await afterAction()
    } else {
      cancelFailure.value = failure(err)
    }
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <DsPage layout="list" :back-to="embedded ? undefined : '/admin/hadiah'" data-testid="tebusan-page">
    <DsStack gap="md">
      <DsHeading v-if="embedded" :level="2" variant="subheading" data-testid="tebusan-card-title">
        {{ COPY.card }}
      </DsHeading>

      <DsPillNav
        :items="pills"
        :active="filter"
        :label="COPY.pillsLabel"
        testid-prefix="tebusan-pill"
        @select="filter = $event"
      />

      <DsDataTable
        v-model:page="page"
        :data="rows"
        :columns="COLUMNS"
        :caption="COPY.card"
        variant="flush"
        density="compact"
        :page-size="PAGE_SIZE"
        :total="total"
        :loading="list.loading.value && !list.data.value"
        :error="list.error.value ? COMMON_COPY.loadFailed : undefined"
        :empty-title="COPY.empty"
        row-key="id"
        card-title="rewardTitle"
        :card-fields="CARD_FIELDS"
        data-testid="tebusan-table"
        @retry="list.reload()"
      >
        <template #student-cell="{ row }">
          <DsStack gap="xs">
            <DsText variant="body">{{ row.original.user.name }}</DsText>
            <DsText variant="caption" tone="muted">{{ row.original.user.email }}</DsText>
          </DsStack>
        </template>
        <template #reward-cell="{ row }">
          <DsText variant="body" :data-testid="`tebusan-reward-${row.original.id}`">
            {{ row.original.rewardTitle }}
          </DsText>
        </template>
        <template #rm-cell="{ row }">{{ rm(row.original) }}</template>
        <template #token-cell="{ row }">{{ formatCount(row.original.tokenCost) }}</template>
        <template #status-cell="{ row }">
          <DsBadge
            :label="statusWord(row.original.status)"
            :tone="statusTone(row.original.status)"
            :data-testid="`tebusan-status-${row.original.id}`"
          />
        </template>
        <template #date-cell="{ row }">{{ formatDate(row.original.createdAt) }}</template>
        <template #actions-cell="{ row }">
          <DsCluster gap="xs">
            <UButton
              v-if="canDeliver(row.original)"
              :label="COPY.deliver"
              :data-testid="`tebusan-deliver-${row.original.id}`"
              @click="openDeliver(row.original)"
            />
            <UButton
              v-if="canCancel(row.original)"
              color="neutral"
              :label="COPY.cancel"
              :data-testid="`tebusan-cancel-${row.original.id}`"
              @click="openCancel(row.original)"
            />
          </DsCluster>
        </template>

        <template #card="{ row }">
          <DsStack gap="xs" :data-testid="`tebusan-card-${String(row.id)}`">
            <DsText variant="body-strong">{{ row.rewardTitle }}</DsText>
            <DsText variant="caption" tone="muted">
              {{ (row as Row).user.name }} · {{ (row as Row).user.email }}
            </DsText>
            <DsCluster gap="sm">
              <DsBadge
                :label="statusWord((row as Row).status)"
                :tone="statusTone((row as Row).status)"
                :data-testid="`tebusan-status-${String(row.id)}`"
              />
              <DsText variant="caption" tone="muted">
                RM {{ rm(row as Row) }} · {{ formatCount((row as Row).tokenCost) }}
                {{ COPY.columns.token }} · {{ formatDate((row as Row).createdAt) }}
              </DsText>
            </DsCluster>
            <DsCluster gap="sm">
              <UButton
                v-if="canDeliver(row as Row)"
                :label="COPY.deliver"
                :data-testid="`tebusan-deliver-${String(row.id)}`"
                @click="openDeliver(row as Row)"
              />
              <UButton
                v-if="canCancel(row as Row)"
                color="neutral"
                :label="COPY.cancel"
                :data-testid="`tebusan-cancel-${String(row.id)}`"
                @click="openCancel(row as Row)"
              />
            </DsCluster>
          </DsStack>
        </template>
      </DsDataTable>
    </DsStack>

    <DsDialog v-model:open="deliverOpen" :title="COPY.deliver" size="sm" :loading="delivering">
      <DsStack
        id="tebusan-deliver-form"
        as="form"
        gap="md"
        data-testid="tebusan-deliver-form"
        @submit.prevent="submitDeliver"
      >
        <DsText v-if="deliverRow" variant="caption" tone="muted">
          {{ deliverRow.rewardTitle }} · {{ deliverRow.user.name }}
        </DsText>
        <DsFormField native :label="PROPOSED.codeLabel" required :error="codeError">
          <template #default="f">
            <UInput
              :id="f.id"
              v-model="code"
              type="text"
              autocomplete="off"
              :aria-invalid="f.invalid"
              :aria-describedby="f.describedby"
              data-testid="tebusan-code"
            />
          </template>
        </DsFormField>
        <DsCallout
          v-if="deliverFailure"
          tone="error"
          :description="deliverFailure"
          data-testid="tebusan-deliver-failure"
        />
      </DsStack>
      <template #footer>
        <UButton
          color="neutral"
          :label="COPY.cancel"
          data-testid="tebusan-deliver-close"
          @click="deliverOpen = false"
        />
        <UButton
          type="submit"
          form="tebusan-deliver-form"
          :label="COPY.deliver"
          :loading="delivering"
          data-testid="tebusan-deliver-go"
        />
      </template>
    </DsDialog>

    <DsDialog
      v-model:open="cancelOpen"
      :title="COPY.confirmTitle"
      size="sm"
      tone="error"
      :loading="cancelling"
    >
      <DsStack gap="md" data-testid="tebusan-cancel-body">
        <DsText variant="body">{{ COPY.confirmBody }}</DsText>
        <DsCallout
          v-if="cancelFailure"
          tone="error"
          :description="cancelFailure"
          data-testid="tebusan-cancel-failure"
        />
      </DsStack>
      <template #footer>
        <UButton
          color="neutral"
          :label="COPY.confirmKeep"
          data-testid="tebusan-cancel-keep"
          @vue:mounted="focusKeep"
          @click="cancelOpen = false"
        />
        <UButton
          color="error"
          :label="COPY.confirmGo"
          :loading="cancelling"
          data-testid="tebusan-cancel-go"
          @click="confirmCancel"
        />
      </template>
    </DsDialog>
  </DsPage>
</template>
