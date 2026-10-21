<script setup lang="ts">
/**
 * S7b `/admin-sekolah/guru/menunggu` "Guru Menunggu Pengesahan" (docs/design/m27-pending-teacher-verify.md; BE-21
 * AC 13). The school admin verifies teachers who registered themselves: one list (unpaged, oldest first) and one
 * action, "Sahkan", behind a confirm. No reject, search, filter or pager (the contract has none). After a verify the
 * list is reloaded from the server; focus moves to the next row's button, else the previous row's, else the heading.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, nextTick, ref, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, useFlash, useSession } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import {
  DsBackLink,
  DsCluster,
  DsDataTable,
  DsEmptyState,
  DsGrid,
  DsIdentity,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStack,
  DsStatTile,
  DsText,
  useConfirm,
} from '@/ds'

import { fetchPendingTeachers, verifyPendingTeacher } from '../api/pending-teachers'
import {
  GONE_MESSAGE,
  PENDING_TITLE,
  PENDING_UNIT,
  confirmMessage,
  emailText,
  focusTargetAfter,
  foundText,
  isGone,
  verifyLabel,
} from '../components/users/pending-format'
import {
  TEACHER_LIST_PATH,
  errorLines,
  formatCount,
  formatDateTime,
  phoneText,
} from '../components/users/users-format'

interface Item extends Record<string, unknown> {
  id: string
  index: number
  name: string
  initials: string
  email: string
  phone: string
  requestedAt: string
}

const flash = useFlash()
const confirm = useConfirm()
const pageMeta = usePageMeta()
const { user: me } = useSession()

watch(
  () => me.value?.school?.name,
  (school) => {
    pageMeta.setHeader({ title: PENDING_TITLE, ...(school ? { subtitle: school } : {}) })
  },
  { immediate: true },
)

const { data, error, reload } = useApi((signal: AbortSignal) => fetchPendingTeachers(signal), [])

const refused = computed(() => isApiError(error.value) && error.value.status === 403)
watch(
  refused,
  (is403) => {
    if (is403) setRouteOutcome(403)
  },
  { immediate: true },
)

const firstLoad = computed(() => data.value === null && error.value === null)
const count = computed(() => data.value?.data.length ?? 0)

const items = computed<Item[]>(() =>
  (data.value?.data ?? []).map((row, i) => ({
    id: row.id,
    index: i + 1,
    name: row.name,
    initials: row.initials,
    email: emailText(row.email),
    phone: phoneText(row.phone),
    requestedAt: formatDateTime(row.requestedAt),
  })),
)

const columns: TableColumn<Item>[] = [
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'name', header: 'Nama' },
  { accessorKey: 'email', header: 'Emel' },
  { accessorKey: 'phone', header: 'Telefon' },
  { accessorKey: 'requestedAt', header: 'Tarikh Daftar' },
  { id: 'actions', header: 'Tindakan' },
]

const root = ref<HTMLElement | null>(null)
const verifyingId = ref<string | null>(null)

function focusVerify(id: string): boolean {
  const buttons = root.value?.querySelectorAll<HTMLElement>('[data-testid="pt-verify"]') ?? []
  for (const button of buttons) {
    if (button.dataset.userId === id) {
      button.focus()
      return true
    }
  }
  return false
}

/** The shell prints the page's one h1; it gets a temporary tab stop so focus can land on it. */
function focusHeading(): void {
  const heading = document.querySelector<HTMLElement>('h1')
  if (!heading) return
  heading.setAttribute('tabindex', '-1')
  heading.focus()
}

async function refresh(): Promise<void> {
  try {
    await reload()
  } catch {
    // The load error state shows the failure; the outcome of the write is still reported.
  }
}

const idsNow = (): string[] => (data.value?.data ?? []).map((r) => r.id)

async function moveFocus(before: string[], removed: string): Promise<void> {
  await nextTick()
  const target = focusTargetAfter(before, removed, idsNow())
  if (target === null || !focusVerify(target)) focusHeading()
}

async function verify(row: Item): Promise<void> {
  if (verifyingId.value !== null) return
  const ok = await confirm({
    title: 'Sahkan Guru',
    message: confirmMessage(row.name),
    confirmLabel: 'Sahkan',
    tone: 'primary',
  })
  if (!ok) {
    await nextTick()
    focusVerify(row.id)
    return
  }
  verifyingId.value = row.id
  const before = idsNow()
  try {
    const result = await verifyPendingTeacher(row.id)
    await refresh()
    flash.show({ type: 'success', message: result.status })
    await moveFocus(before, row.id)
  } catch (err) {
    if (isGone(err)) {
      await refresh()
      flash.show({ type: 'error', message: GONE_MESSAGE })
      await moveFocus(before, row.id)
    } else {
      flash.show({ type: 'error', message: errorLines(err) })
      await nextTick()
      focusVerify(row.id)
    }
  } finally {
    verifyingId.value = null
  }
}
</script>

<template>
  <DsPage data-testid="pt-page">
    <div ref="root">
      <DsStack gap="lg">
        <DsBackLink :to="TEACHER_LIST_PATH" label="Senarai Guru" data-testid="pt-back" />

        <section data-testid="pt-count-card">
          <DsGrid :cols="{ base: 1, sm: 2, lg: 4 }">
            <USkeleton v-if="firstLoad" data-testid="pt-loading" />
            <DsStatTile
              v-else-if="data"
              :value="formatCount(count)"
              :unit="PENDING_UNIT"
              icon="chalkboard-teacher"
              accent="friend"
            />
          </DsGrid>
        </section>

        <DsLoadError
          v-if="error && !refused"
          :message="errorLines(error).join(' ')"
          testid="pt-error"
          @retry="reload"
        />

        <template v-else-if="!refused">
          <DsText variant="body" tone="muted" data-testid="pt-found">
            <template v-if="data">{{ foundText(formatCount(count)) }}</template>
          </DsText>

          <DsPanel v-if="!firstLoad && count === 0" data-testid="pt-empty">
            <DsEmptyState
              title="Tiada guru menunggu pengesahan"
              description="Guru yang mendaftar sendiri dan memilih sekolah ini akan muncul di sini."
              icon="users"
            />
          </DsPanel>
          <DsDataTable
            v-else
            :data="items"
            :columns="columns"
            :loading="firstLoad"
            :total="count"
            :page-size="Math.max(count, 1)"
            caption="Guru Menunggu Pengesahan"
            density="compact"
            data-testid="pt-table"
          >
            <template #name-cell="{ row }">
              <DsIdentity
                :name="row.original.name"
                :initials="row.original.initials"
                data-testid="pt-row"
                :data-user-id="row.original.id"
              >
                <template #name>
                  <span data-testid="pt-name">{{ row.original.name }}</span>
                </template>
              </DsIdentity>
            </template>
            <template #email-cell="{ row }">
              <DsText variant="body" as="span" wrap="anywhere" data-testid="pt-email">{{
                row.original.email
              }}</DsText>
            </template>
            <template #phone-cell="{ row }">
              <DsText variant="body" as="span" wrap="anywhere" data-testid="pt-phone">{{
                row.original.phone
              }}</DsText>
            </template>
            <template #requestedAt-cell="{ row }">
              <DsText variant="body" as="span" data-testid="pt-date">{{
                row.original.requestedAt
              }}</DsText>
            </template>
            <template #actions-cell="{ row }">
              <UButton
                type="button"
                size="lg"
                variant="soft"
                :aria-label="verifyLabel(row.original.name)"
                :loading="verifyingId === row.original.id"
                :disabled="verifyingId === row.original.id"
                class="min-h-11"
                data-testid="pt-verify"
                :data-user-id="row.original.id"
                @click="verify(row.original)"
                >Sahkan</UButton
              >
            </template>
            <template #card="{ row }">
              <DsStack gap="xs">
                <DsIdentity
                  :name="row.name"
                  :initials="row.initials"
                  data-testid="pt-row"
                  :data-user-id="row.id"
                />
                <DsCluster gap="xs" align="baseline">
                  <DsText variant="caption" tone="muted" as="span">Emel</DsText>
                  <DsText variant="body" as="span" wrap="anywhere" data-testid="pt-email">{{
                    row.email
                  }}</DsText>
                </DsCluster>
                <DsCluster gap="xs" align="baseline">
                  <DsText variant="caption" tone="muted" as="span">Telefon</DsText>
                  <DsText variant="body" as="span" wrap="anywhere" data-testid="pt-phone">{{
                    row.phone
                  }}</DsText>
                </DsCluster>
                <DsCluster gap="xs" align="baseline">
                  <DsText variant="caption" tone="muted" as="span">Tarikh Daftar</DsText>
                  <DsText variant="body" as="span" data-testid="pt-date">{{
                    row.requestedAt
                  }}</DsText>
                </DsCluster>
              </DsStack>
            </template>
            <template #card-actions="{ row }">
              <UButton
                type="button"
                size="lg"
                variant="soft"
                :aria-label="verifyLabel(row.name)"
                :loading="verifyingId === row.id"
                :disabled="verifyingId === row.id"
                class="min-h-11"
                data-testid="pt-verify"
                :data-user-id="row.id"
                @click="verify(row)"
                >Sahkan</UButton
              >
            </template>
          </DsDataTable>
        </template>
      </DsStack>
    </div>
  </DsPage>
</template>
