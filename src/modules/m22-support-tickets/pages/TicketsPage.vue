<script setup lang="ts">
/**
 * S1 `/pusat-tuisyen/tiket` "Tiket Bantuan" (SRS M22 v1.1 FR-M22-01…27; roles-matrix row L04). User shell,
 * every signed-in role, own tickets only. Markup and copy follow the server view `content/tiket.blade.php`;
 * the 10/11 px badge and time are raised to 12 px (DV-M22-06). One list call (`GET /api/tiket`), one create
 * (`POST /api/tiket`); after a create the page stays on `/pusat-tuisyen/tiket` (DV-M22-03).
 *
 * States: loading spinner; load failure shows the server message with a retry button (FR-M22-46).
 */
import { CircleCheck, Clock, Plus, Reply, Send, Ticket } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
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

const BADGE: Record<TicketStatus, string> = {
  dibuka: 'bg-red-100 text-red-700',
  dalam_proses: 'bg-amber-100 text-amber-700',
  menunggu_balas: 'bg-blue-100 text-blue-700',
  selesai: 'bg-green-100 text-green-700',
  ditutup: 'bg-slate-200 text-slate-600',
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
  window.scrollTo({ top: 0, behavior: 'smooth' })
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
  <div class="mx-auto min-w-0" data-testid="tk-page">
    <div
      v-if="banner"
      class="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800"
      data-testid="tk-flash"
    >
      <CircleCheck class="mr-1 inline h-4 w-4" />
      {{ TICKET_CREATED_FLASH }}
    </div>

    <div class="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <p class="text-sm text-slate-500" data-testid="tk-total">
        Jumlah tiket: <span class="font-bold text-slate-700">{{ total }}</span>
      </p>
      <button
        type="button"
        class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-red-600 hover:to-rose-700"
        data-testid="tk-new"
        @click="formOpen = !formOpen"
      >
        <Plus class="h-4 w-4" /> Tiket Baru
      </button>
    </div>

    <div
      v-show="formOpen"
      id="tiket-baru"
      class="mb-6 rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
      data-testid="tk-form-card"
    >
      <h3 class="mb-3 text-sm font-bold text-slate-700">
        <Ticket class="mr-1 inline h-4 w-4 text-red-500" /> Tiket Baru
      </h3>
      <div
        v-if="formError"
        class="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
        data-testid="tk-form-error"
      >
        {{ formError }}
      </div>
      <form class="space-y-3" data-testid="tk-form" @submit.prevent="submit">
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-500" for="tk-subject"
            >Subjek</label
          >
          <input
            id="tk-subject"
            v-model="subject"
            type="text"
            name="subject"
            required
            :maxlength="SUBJECT_MAX"
            class="w-full rounded-lg border border-slate-300 text-sm"
            placeholder="Ringkasan masalah atau permintaan anda"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-500" for="tk-body">Butiran</label>
          <textarea
            id="tk-body"
            v-model="body"
            name="body"
            rows="5"
            required
            :maxlength="BODY_MAX"
            class="w-full rounded-lg border border-slate-300 text-sm"
            placeholder="Terangkan masalah anda dengan terperinci..."
          ></textarea>
        </div>
        <button
          type="submit"
          class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-red-600 hover:to-rose-700"
          data-testid="tk-submit"
        >
          <Send class="h-4 w-4" /> Hantar Tiket
        </button>
      </form>
    </div>

    <div class="mb-4 flex flex-wrap gap-2" data-testid="tk-tabs">
      <RouterLink
        v-for="t in tabs"
        :key="t.label"
        :to="t.to"
        class="inline-flex min-h-11 items-center rounded-lg px-3 py-1.5 text-xs font-bold transition"
        :class="
          status === t.key
            ? 'bg-slate-800 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        "
        :data-active="status === t.key"
      >
        {{ t.label }}
      </RouterLink>
    </div>

    <template v-if="data">
      <div
        v-if="tickets.length === 0"
        class="rounded-xl border border-slate-100 bg-white p-8 text-center"
        data-testid="tk-empty"
      >
        <Ticket class="mx-auto mb-3 h-10 w-10 text-slate-200" />
        <p class="text-sm text-slate-500">Tiada tiket lagi.</p>
        <button
          type="button"
          class="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-red-600 hover:underline"
          data-testid="tk-first"
          @click="openForm"
        >
          <Plus class="h-3 w-3" /> Buat Tiket Pertama
        </button>
      </div>
      <div v-else class="space-y-3" data-testid="tk-list">
        <div
          v-for="t in tickets"
          :key="t.id"
          class="rounded-xl border border-slate-100 bg-white p-4 transition hover:shadow-md sm:p-5"
          data-testid="tk-card"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="text-sm font-bold break-words text-slate-800 sm:text-base">
                #{{ t.id }} — {{ t.subject }}
              </h3>
              <p
                class="mt-1 line-clamp-2 text-xs break-words text-slate-500 sm:text-sm"
                data-testid="tk-body"
              >
                {{ t.body }}
              </p>
              <p class="mt-2 text-xs text-slate-400" data-testid="tk-time">
                <Clock class="mr-1 inline h-3 w-3" />{{ diffForHumans(t.createdAt) }}
              </p>
            </div>
            <span
              class="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold"
              :class="BADGE[t.status]"
              data-testid="tk-badge"
              >{{ t.statusLabel }}</span
            >
          </div>
          <div
            v-if="t.adminReply"
            class="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3"
            data-testid="tk-reply"
          >
            <p class="mb-1 text-xs font-bold text-indigo-700">
              <Reply class="mr-1 inline h-3 w-3" />Balasan Sokongan
            </p>
            <p class="text-xs break-words whitespace-pre-line text-slate-600 sm:text-sm">
              {{ t.adminReply }}
            </p>
          </div>
        </div>
      </div>
    </template>
    <div v-else-if="error" class="space-y-3" data-testid="tk-error">
      <AlertBox :messages="error.message" />
      <div class="text-center">
        <button
          type="button"
          class="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          data-testid="tk-retry"
          @click="reload"
        >
          Cuba lagi
        </button>
      </div>
    </div>
    <p
      v-else-if="loading"
      class="flex justify-center py-10 text-slate-500"
      data-testid="tk-loading"
    >
      <LoadingSpinner class="h-6 w-6" />
    </p>
  </div>
</template>
