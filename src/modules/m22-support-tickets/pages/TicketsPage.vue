<script setup lang="ts">
/**
 * S1 `/pusat-tuisyen/tiket` "Tiket Bantuan" (SRS M22 v1.1 FR-M22-01…27; roles-matrix row L04), v2
 * restyle (B09 / A4). User shell, every signed-in role, own tickets only. Copy follows the server
 * view `content/tiket.blade.php`. One list call (`GET /api/tiket`), one create (`POST /api/tiket`);
 * after a create the page stays on `/pusat-tuisyen/tiket` (DV-M22-03). The create form opens in a
 * `DsDialog` (bottom sheet below `sm`); its fields are the contract's: Subjek and Butiran.
 *
 * States: loading skeleton; load failure shows the server message with a retry button (FR-M22-46). No aria-* attribute (CHK-M22-02, D10): the controls carry their own semantics.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { useApi } from '@/composables'
import { DsDialog, DsEmptyState, DsStack, DsCluster, DsText, DsHeading } from '@/ds'
import { diffForHumans } from '@/lib/time'

import { createTicket, fetchTickets } from '../api/tickets'
import {
  BODY_MAX,
  SUBJECT_MAX,
  TICKET_CREATED_FLASH,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  isTicketStatus,
  type TicketStatus,
} from '../api/types'

const PATH = '/pusat-tuisyen/tiket'

const route = useRoute()
const router = useRouter()

/** FR-M22-17: only a vocabulary key filters; anything else is "Semua". */
const status = computed<TicketStatus | null>(() => {
  const q = route.query.status
  const first = Array.isArray(q) ? q[0] : q
  return isTicketStatus(first) ? first : null
})

const { data, error, loading, reload } = useApi(
  (signal) => fetchTickets({ status: status.value, signal }),
  () => route.query.status,
)

const tickets = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.total ?? 0)

type BadgeColor = 'error' | 'warning' | 'info' | 'success' | 'neutral'
/** Status = tone + icon + word (the word is the live label). */
const BADGE: Record<TicketStatus, { color: BadgeColor; icon: string }> = {
  dibuka: { color: 'info', icon: 'i-ph-envelope-open' },
  dalam_proses: { color: 'warning', icon: 'i-ph-hourglass-medium' },
  menunggu_balas: { color: 'info', icon: 'i-ph-chat-circle-dots' },
  selesai: { color: 'success', icon: 'i-ph-check-circle' },
  ditutup: { color: 'neutral', icon: 'i-ph-lock-simple' },
}

const tabs = [
  { key: null, label: 'Semua', to: PATH },
  ...TICKET_STATUSES.map((s) => ({
    key: s,
    label: TICKET_STATUS_LABELS[s],
    to: `${PATH}?status=${s}`,
  })),
]

// --- create form -----------------------------------------------------------------------------
const formOpen = ref(false)
const subject = ref('')
const body = ref('')
const formError = ref('')
const submitting = ref(false)
/** FR-M22-06: shown once, never persisted (a reload or another navigation clears it). */
const banner = ref(false)

function openForm(): void {
  formOpen.value = true
}

async function submit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  formError.value = ''
  try {
    await createTicket({ subject: subject.value, body: body.value })
  } catch (err) {
    // FR-M22-12: the form stays open with the typed values; the first message only (Subjek, then Butiran).
    formOpen.value = true
    if (isApiError(err)) formError.value = err.fields?.subject ?? err.fields?.body ?? err.message
    else formError.value = err instanceof Error ? err.message : String(err)
    submitting.value = false
    return
  }
  subject.value = ''
  body.value = ''
  formOpen.value = false
  // FR-M22-14: back to the unfiltered list on S1.
  if (route.query.status !== undefined) await router.replace(PATH)
  else await reload()
  banner.value = true
  submitting.value = false
}

// A navigation (tab, link) clears the banner.
watch(
  () => route.fullPath,
  () => {
    banner.value = false
  },
)
</script>

<template>
  <div class="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-4 md:gap-6" data-testid="tk-page">
    <h1 class="sr-only">Tiket Bantuan</h1>

    <UAlert
      v-if="banner"
      color="success"
      variant="subtle"
      icon="i-ph-check-circle"
      :title="TICKET_CREATED_FLASH"
      data-testid="tk-flash"
    />

    <div class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <DsText variant="body" tone="muted" data-testid="tk-total">
        Jumlah tiket: <DsText variant="label" tone="highlighted">{{ total }}</DsText>
      </DsText>
      <UButton
        type="button"
        color="primary"
        size="lg"
        icon="i-ph-plus"
        data-testid="tk-new"
        @click="formOpen = !formOpen"
        >Tiket Baru</UButton
      >
    </div>

    <DsDialog v-model:open="formOpen" title="Tiket Baru" data-testid="tk-form-card">
      <UAlert
        v-if="formError"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        :title="formError"
        class="mb-4"
        data-testid="tk-form-error"
      />
      <DsStack id="tiket-baru" as="form" data-testid="tk-form" @submit.prevent="submit">
        <UFormField label="Subjek">
          <UInput
            v-model="subject"
            type="text"
            name="subject"
            required
            :maxlength="SUBJECT_MAX"
            placeholder="Ringkasan masalah atau permintaan anda"
            size="lg"
            class="w-full"
            data-testid="tk-subject"
          />
        </UFormField>
        <UFormField label="Butiran">
          <UTextarea
            v-model="body"
            name="body"
            :rows="5"
            required
            :maxlength="BODY_MAX"
            placeholder="Terangkan masalah anda dengan terperinci..."
            size="lg"
            class="w-full"
            data-testid="tk-body-input"
          />
        </UFormField>
      </DsStack>
      <template #footer>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="lg"
          data-testid="tk-cancel"
          @click="formOpen = false"
          >Batal</UButton
        >
        <UButton
          type="submit"
          form="tiket-baru"
          color="primary"
          size="lg"
          icon="i-ph-paper-plane-tilt"
          :loading="submitting"
          data-testid="tk-submit"
          >Hantar Tiket</UButton
        >
      </template>
    </DsDialog>

    <DsCluster
      as="nav"
      gap="xs"
      align="stretch"
      :wrap="false"
      class="max-w-full overflow-x-auto"
      data-testid="tk-tabs"
    >
      <UButton
        v-for="t in tabs"
        :key="t.label"
        :to="t.to"
        size="lg"
        :color="status === t.key ? 'primary' : 'neutral'"
        :variant="status === t.key ? 'solid' : 'soft'"
        class="shrink-0"
        :data-active="status === t.key"
        >{{ t.label }}</UButton
      >
    </DsCluster>

    <template v-if="data">
      <div v-if="tickets.length === 0" data-testid="tk-empty">
        <DsEmptyState title="Tiada tiket lagi." icon="lifebuoy">
          <template #actions>
            <UButton
              type="button"
              color="primary"
              variant="soft"
              size="lg"
              icon="i-ph-plus"
              data-testid="tk-first"
              @click="openForm"
              >Buat Tiket Pertama</UButton
            >
          </template>
        </DsEmptyState>
      </div>
      <DsStack v-else as="ul" gap="sm" data-testid="tk-list">
        <li v-for="t in tickets" :key="t.id">
          <UCard data-testid="tk-card">
            <DsCluster align="start" justify="between" :wrap="false">
              <DsStack gap="2xs">
                <DsHeading :level="3" wrap="anywhere"> #{{ t.id }} — {{ t.subject }} </DsHeading>
                <DsText
                  variant="body"
                  tone="muted"
                  :clamp="2"
                  wrap="anywhere"
                  data-testid="tk-body"
                >
                  {{ t.body }}
                </DsText>
                <p class="flex items-center gap-1 text-caption text-muted" data-testid="tk-time">
                  <UIcon name="i-ph-clock" class="size-4" />{{ diffForHumans(t.createdAt) }}
                </p>
              </DsStack>
              <UBadge
                :color="BADGE[t.status].color"
                variant="subtle"
                :icon="BADGE[t.status].icon"
                class="shrink-0"
                data-testid="tk-badge"
                >{{ t.statusLabel }}</UBadge
              >
            </DsCluster>
            <div v-if="t.adminReply" class="mt-3 bg-elevated p-3" data-testid="tk-reply">
              <p class="mb-1 flex items-center gap-1 text-label text-highlighted">
                <UIcon name="i-ph-chat-circle-text" class="size-4" />Balasan Sokongan
              </p>
              <DsText variant="body" wrap="anywhere" class="whitespace-pre-line">
                {{ t.adminReply }}
              </DsText>
            </div>
          </UCard>
        </li>
      </DsStack>
    </template>
    <DsStack v-else-if="error" gap="sm" data-testid="tk-error">
      <UAlert color="error" variant="subtle" icon="i-ph-warning-circle" :title="error.message" />
      <div class="text-center">
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          size="lg"
          data-testid="tk-retry"
          @click="reload"
          >Cuba lagi</UButton
        >
      </div>
    </DsStack>
    <DsStack v-else-if="loading" gap="sm" data-testid="tk-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-24 w-full" />
    </DsStack>
  </div>
</template>
