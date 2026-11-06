<script setup lang="ts">
/**
 * S2 `/admin/tiket` "Tiket Sokongan" (R1-ADM-P2-20, SRS M22 v1.1 FR-M22-28…38), v2 staff theme. Admin shell,
 * platform admin only: role filter, status chips (links, with the counts), a table of 25 rows per page, and a row
 * opens the detail with the single reply and the status select, which save apart. Dates are shown in Asia/Kuala_Lumpur (DV-M22-09). Counts and the total cover all
 * tickets. The markup keeps the server's no-ARIA rule (CHK-M22-02).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'

import { ApiError } from '@/api'
import { useApi } from '@/composables'
import {
  DsCallout,
  DsDataTable,
  DsDefinitionList,
  DsDialog,
  DsEmptyState,
  DsFormField,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsPillNav,
  DsStack,
  DsStateView,
  type PillItem,
} from '@/ds'
import { formatNumber } from '@/lib/number'
import { formatDateTimeRaw } from '@/lib/time'

import { fetchQueue, fetchTicketDetail, replyToTicket, setTicketStatus } from '../api/tickets'
import {
  ADMIN_TICKET_FLASH,
  ROLE_FILTER_ITEMS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  isTicketStatus,
  type QueueRow,
  type TicketDetail,
  type TicketStatus,
} from '../api/types'

const route = useRoute()
const router = useRouter()

/** BR-M22-08: any non-empty `status` filters by exact equality. */
const status = computed(() => {
  const q = route.query.status
  const first = Array.isArray(q) ? q[0] : q
  return first ?? ''
})

const page = computed(() => {
  const q = route.query.page
  const raw = Array.isArray(q) ? q[0] : q
  return Math.max(1, Number.parseInt(raw ?? '', 10) || 1)
})

const role = computed(() => {
  const q = route.query.role
  const first = Array.isArray(q) ? q[0] : q
  return first ?? ''
})

const { data, error, loading, reload } = useApi(
  (signal) => fetchQueue({ status: status.value, role: role.value, page: page.value, signal }),
  () => [route.query.status, route.query.role, route.query.page],
)

const rows = computed(() => data.value?.data ?? [])
const counts = computed(() => data.value?.meta.counts ?? [])
const total = computed(() => data.value?.meta.total ?? 0)
const matched = computed(() => data.value?.meta.matched ?? 0)

type TicketRow = QueueRow & Record<string, unknown>
/** The card fields below `md` read these display texts (the table cells have their own slots). */
const tableRows = computed<TicketRow[]>(() =>
  rows.value.map((r) => ({
    ...r,
    dateText: formatDateTimeRaw(r.createdAt),
    userText: r.userName ?? '—',
    roleText: r.roleLabel ?? '—',
    schoolText: r.school ?? '—',
    statusText: statusWord(r.status),
    repliedText: r.replied ? 'Ya' : '—',
  })),
)
const CARD_FIELDS = [
  { key: 'dateText', label: 'Tarikh' },
  { key: 'userText', label: 'Pengguna' },
  { key: 'roleText', label: 'Peranan' },
  { key: 'schoolText', label: 'Sekolah' },
  { key: 'statusText', label: 'Status' },
  { key: 'repliedText', label: 'Dibalas' },
]
const COLUMNS: TableColumn<TicketRow>[] = [
  { id: 'date', header: 'Tarikh' },
  { id: 'user', header: 'Pengguna' },
  { accessorKey: 'roleText', header: 'Peranan' },
  { accessorKey: 'schoolText', header: 'Sekolah' },
  { accessorKey: 'subject', header: 'Subjek' },
  { id: 'status', header: 'Status' },
  { id: 'replied', header: 'Dibalas' },
]
/** The label of a status; a typed unknown value in the URL is shown as it is. */
function statusWord(value: string): string {
  return isTicketStatus(value) ? TICKET_STATUS_LABELS[value] : value
}
/** A chip keeps the role filter and goes back to page 1. */
function chipLink(value: string): string {
  const query = new URLSearchParams()
  if (value !== '') query.set('status', value)
  if (role.value !== '') query.set('role', role.value)
  const text = query.toString()
  return text === '' ? '/admin/tiket' : `/admin/tiket?${text}`
}

function chooseRole(value: unknown): void {
  const next = typeof value === 'string' ? value : ''
  const query: LocationQueryRaw = { ...route.query }
  delete query.page
  if (next === '') delete query.role
  else query.role = next
  void router.push({ path: '/admin/tiket', query })
}

/** Status chips (links with the counts); the filter lives in the URL. */
const chipItems = computed<PillItem<string>[]>(() => [
  { key: '', label: `Semua (${formatNumber(total.value)})`, to: chipLink(''), testid: 'all' },
  ...counts.value.map((c) => ({
    key: c.status,
    label: `${statusWord(c.status)} (${formatNumber(c.count)})`,
    to: chipLink(c.status),
  })),
])

function goToPage(next: number): void {
  const query = { ...route.query, page: String(next) }
  void router.push({ path: '/admin/tiket', query })
}

// --- Detail (FR-ADM-P2-20.2): opened from a row; the status saves on its own.
const STATUS_ITEMS = TICKET_STATUSES.map((s) => ({ label: TICKET_STATUS_LABELS[s], value: s }))
const detailOpen = ref(false)
const detail = ref<TicketDetail | null>(null)
const detailError = ref('')
const statusFlash = ref(false)
const statusBusy = ref(false)
const statusError = ref('')
const replyText = ref('')
const replyBusy = ref(false)
const replyError = ref('')
const replyFlash = ref(false)
let openedRow = 0

/** `selesai` and `ditutup` hide the reply box (30 P2-20); a saved reply then shows as text. */
const canReply = computed(() => detail.value?.status !== 'selesai' && detail.value?.status !== 'ditutup')

const detailItems = computed(() => {
  const current = detail.value
  if (!current) return []
  return [
    { key: 'subject', label: 'Subjek', value: current.subject },
    { key: 'role', label: 'Peranan', value: current.roleLabel },
    { key: 'school', label: 'Sekolah', value: current.school },
    { key: 'body', label: 'Butiran' },
    ...(current.adminReply && !canReply.value ? [{ key: 'reply', label: 'Balasan Sokongan' }] : []),
  ]
})

const messageOf = (e: unknown): string => (e instanceof ApiError ? e.message : String(e))

async function loadDetail(id: number): Promise<void> {
  detail.value = null
  detailError.value = ''
  try {
    const found = await fetchTicketDetail(id)
    if (openedRow === id) {
      detail.value = found
      replyText.value = found.adminReply ?? ''
    }
  } catch (e) {
    if (openedRow === id) detailError.value = messageOf(e)
  }
}

function openDetail(row: TicketRow): void {
  openedRow = row.id
  statusFlash.value = false
  statusError.value = ''
  replyFlash.value = false
  replyError.value = ''
  detailOpen.value = true
  void loadDetail(row.id)
}

async function saveReply(): Promise<void> {
  const current = detail.value
  if (!current) return
  replyBusy.value = true
  replyFlash.value = false
  replyError.value = ''
  try {
    detail.value = await replyToTicket(current.id, replyText.value)
    replyText.value = detail.value.adminReply ?? ''
    replyFlash.value = true
    void reload()
  } catch (e) {
    replyError.value = (e instanceof ApiError && e.fields?.text) || messageOf(e)
  } finally {
    replyBusy.value = false
  }
}

async function changeStatus(value: unknown): Promise<void> {
  const current = detail.value
  if (!current || !isTicketStatus(value) || value === current.status) return
  const next: TicketStatus = value
  statusBusy.value = true
  statusFlash.value = false
  statusError.value = ''
  try {
    detail.value = await setTicketStatus(current.id, next)
    statusFlash.value = true
    void reload()
  } catch (e) {
    statusError.value = messageOf(e)
  } finally {
    statusBusy.value = false
  }
}
</script>

<template>
  <DsPage
    title="Tiket Sokongan"
    subtitle="Permohonan bantuan daripada pengguna."
    data-testid="tq-page"
  >
    <template v-if="data">
      <DsFormField label="Peranan" name="role">
        <DsNativeSelect
          :model-value="role"
          :items="[...ROLE_FILTER_ITEMS]"
          data-testid="tq-role"
          @update:model-value="chooseRole"
        />
      </DsFormField>
      <div data-testid="tq-chips">
        <DsPillNav
          :items="chipItems"
          :active="status"
          label="Status tiket"
          testid-prefix="tq-chip"
        />
      </div>

      <DsPanel v-if="matched === 0" padding="none">
        <DsEmptyState
          size="sm"
          icon="lifebuoy"
          :title="
            status === ''
              ? 'Belum ada tiket sokongan.'
              : `Tiada tiket berstatus “${statusWord(status)}”.`
          "
          data-testid="tq-empty"
        />
      </DsPanel>
      <DsDataTable
        v-else
        :data="tableRows"
        :columns="COLUMNS"
        variant="flush"
        caption="Senarai tiket sokongan"
        :total="matched"
        :page="data.meta.page"
        :page-size="data.meta.perPage"
        card-title="subject"
        :card-fields="CARD_FIELDS"
        data-testid="tq-table"
        @update:page="goToPage"
        @row-click="openDetail"
      >
        <template #date-cell="{ row }">
          <span class="text-nowrap text-muted" data-testid="tq-row">{{
            formatDateTimeRaw(row.original.createdAt)
          }}</span>
        </template>
        <template #user-cell="{ row }">
          <span class="text-highlighted">{{ row.original.userName ?? '—' }}</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge color="neutral" variant="subtle" :label="statusWord(row.original.status)" />
        </template>
        <template #replied-cell="{ row }">{{ row.original.replied ? 'Ya' : '—' }}</template>
      </DsDataTable>
    </template>
    <DsLoadError v-else-if="error" :message="error.message" testid="tq-error" @retry="reload" />
    <div v-else-if="loading" class="flex flex-col gap-3" data-testid="tq-loading">
      <USkeleton v-for="n in 5" :key="n" class="h-14 w-full" />
    </div>

    <DsDialog v-model:open="detailOpen" title="Tiket Sokongan" :loading="statusBusy || replyBusy">
      <DsStateView
        :status="detail ? 'ready' : detailError ? 'error' : 'loading'"
        :error="detailError"
        skeleton="text"
        data-testid="tq-detail-state"
        @retry="loadDetail(openedRow)"
      >
        <DsStack v-if="detail" data-testid="tq-detail">
          <DsDefinitionList :items="detailItems">
            <template #value-body>
              <UTextarea :model-value="detail.body" readonly autoresize variant="none" />
            </template>
            <template v-if="detail.adminReply" #value-reply>
              <UTextarea :model-value="detail.adminReply" readonly autoresize variant="none" />
            </template>
          </DsDefinitionList>
          <DsStack v-if="canReply" as="form" data-testid="tq-reply-form" @submit.prevent="saveReply">
            <DsFormField label="Balas" name="text" :error="replyError">
              <UTextarea v-model="replyText" :rows="4" autoresize data-testid="tq-reply-text" />
            </DsFormField>
            <DsStack align="start">
              <UButton type="submit" label="Balas" :loading="replyBusy" data-testid="tq-reply-save" />
            </DsStack>
            <DsCallout
              v-if="replyFlash"
              tone="success"
              :title="ADMIN_TICKET_FLASH.replySaved"
              data-testid="tq-reply-flash"
            />
          </DsStack>
          <DsFormField label="Status" name="status" :error="statusError">
            <DsNativeSelect
              :model-value="detail.status"
              :items="STATUS_ITEMS"
              :loading="statusBusy"
              data-testid="tq-detail-status"
              @update:model-value="changeStatus"
            />
          </DsFormField>
          <DsCallout
            v-if="statusFlash"
            tone="success"
            :title="ADMIN_TICKET_FLASH.statusSaved"
            data-testid="tq-detail-flash"
          />
        </DsStack>
      </DsStateView>
    </DsDialog>
  </DsPage>
</template>
