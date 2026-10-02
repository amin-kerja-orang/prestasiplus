<script setup lang="ts">
/**
 * L45 S2 `/ibu-bapa/terima/:token` (FR-L45-19..30; owner M01, data from M02 through its public entry,
 * ADR-0009). Public standalone page. `GET /api/parent-invites/:token` decides the page:
 * - 404 (any unknown, replaced or inactive-student token): "Link Tidak Sah" (OBSERVED copy, FR-L45-19);
 * - `viewer: guest`: log-in CTA plus the register note (FR-L45-24/25, PROPOSED);
 * - `viewer: other`: switch-account state with "Log Keluar & Log Masuk Sebagai Ibu Bapa" (FR-L45-26);
 * - `viewer: parent`: `POST .../accept` once, then the linked state (FR-L45-27); a failure keeps the
 *   valid card and shows the red alert (FR-L45-29, INFERRED, UNVERIFIED COPY).
 * A GET never links (DV-L45-05). The token is never carried through login or registration (FR-L45-30).
 */
import { ChartLine, CircleCheck, Info, LogIn, LogOut } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { usePageMeta } from '@/composables'
import {
  acceptParentInvite,
  fetchInvitePreview,
  type AcceptResult,
  type InvitePreview,
} from '@/modules/m02-users-schools'

import InviteInvalidCard from '../components/invite/InviteInvalidCard.vue'
import InviteValidCard from '../components/invite/InviteValidCard.vue'
import { GENERIC_ERROR } from '../lib/error-lines'

const props = defineProps<{ token: string }>()

const INVALID_TITLE = 'Link Tidak Sah — PRESTASIPLUS'
const VALID_TITLE = 'Jemputan Ibu Bapa — PRESTASIPLUS'

const router = useRouter()
const { setTitle } = usePageMeta()

type Phase = 'loading' | 'invalid' | 'error' | 'ready'
const phase = ref<Phase>('loading')
const preview = ref<InvitePreview | null>(null)
const accepting = ref(false)
const linked = ref<AcceptResult | null>(null)
const acceptErrors = ref<string[]>([])

const studentName = computed(() => preview.value?.student.name ?? '')

const isLinked = computed(() => linked.value !== null)
const eyebrow = computed(() => (isLinked.value ? 'Berjaya Berhubung' : 'Jemputan Ibu Bapa'))
const heading = computed(() =>
  isLinked.value
    ? `Anda kini berhubung dengan ${linked.value?.student.name ?? studentName.value}`
    : `Anda dijemput untuk memantau kemajuan ${studentName.value}`,
)

function showInvalid(): void {
  phase.value = 'invalid'
  setTitle(INVALID_TITLE)
}

async function accept(): Promise<void> {
  accepting.value = true
  acceptErrors.value = []
  try {
    linked.value = await acceptParentInvite(props.token)
  } catch (err) {
    if (isApiError(err) && err.status === 404) showInvalid()
    else acceptErrors.value = [GENERIC_ERROR]
  } finally {
    accepting.value = false
  }
}

async function load(): Promise<void> {
  phase.value = 'loading'
  preview.value = null
  linked.value = null
  acceptErrors.value = []
  try {
    preview.value = await fetchInvitePreview(props.token)
  } catch (err) {
    if (isApiError(err) && err.status === 404) showInvalid()
    else phase.value = 'error'
    return
  }
  phase.value = 'ready'
  setTitle(VALID_TITLE)
  if (preview.value.viewer === 'parent') await accept()
}

async function switchAccount(): Promise<void> {
  // FR-L45-26: the M01 logout (FR-M01-37), no confirmation; `/logout` ends on `/login`.
  await router.push('/logout')
}

onMounted(load)
// The router reuses this component when only `:token` changes: load the new link from scratch.
watch(() => props.token, load)

const PRIMARY_BUTTON =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-center font-bold text-white shadow-md transition hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:outline-none'
</script>

<template>
  <div
    v-if="phase === 'loading'"
    class="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 text-indigo-600"
    role="status"
    data-testid="invite-loading"
  >
    <LoadingSpinner :size="32" />
  </div>

  <InviteInvalidCard v-else-if="phase === 'invalid'" />

  <main
    v-else-if="phase === 'error'"
    class="flex min-h-screen flex-col items-center justify-center gap-4 bg-linear-to-br from-blue-50 to-indigo-100 px-3 py-6 font-sans"
    data-testid="invite-error"
  >
    <div class="w-full max-w-lg"><AlertBox :messages="[GENERIC_ERROR]" /></div>
    <button
      type="button"
      class="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50"
      data-testid="invite-retry"
      @click="load"
    >
      Cuba lagi
    </button>
  </main>

  <InviteValidCard
    v-else-if="preview"
    :initials="preview.student.initials"
    :eyebrow="eyebrow"
    :heading="heading"
    :student-name="preview.student.name"
    :school-name="preview.student.schoolName"
  >
    <!-- Linked (viewer: parent) -->
    <template v-if="preview.viewer === 'parent'">
      <div
        v-if="accepting"
        class="flex justify-center py-6 text-indigo-600"
        role="status"
        data-testid="invite-accepting"
      >
        <LoadingSpinner :size="28" />
      </div>
      <template v-else-if="linked">
        <div
          class="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"
          data-testid="invite-linked-box"
        >
          <CircleCheck class="mt-0.5 h-4 w-4 shrink-0" />
          <p class="min-w-0 break-words">
            Akaun anda ({{ linked.parent.name }}) telah dihubungkan dengan pelajar ini. Anda kini
            boleh memantau kemajuan mereka.
          </p>
        </div>
        <RouterLink
          :to="`/pelajar/${linked.student.id}`"
          :class="PRIMARY_BUTTON"
          data-testid="invite-profile-link"
        >
          <ChartLine class="h-4 w-4" />
          Lihat Profil Kemajuan
        </RouterLink>
      </template>
      <AlertBox v-else :messages="acceptErrors" data-testid="invite-accept-alert" />
    </template>

    <!-- Logged-in non-parent -->
    <template v-else-if="preview.viewer === 'other'">
      <p class="text-sm text-slate-600" data-testid="invite-other-text">
        Anda kini log masuk sebagai akaun yang
        <strong class="font-semibold">bukan Ibu Bapa</strong>. Untuk berhubung dengan pelajar ini,
        sila log keluar dan log masuk semula menggunakan akaun Ibu Bapa anda.
      </p>
      <button
        type="button"
        :class="PRIMARY_BUTTON"
        data-testid="invite-switch"
        @click="switchAccount"
      >
        <LogOut class="h-4 w-4 shrink-0" />
        Log Keluar &amp; Log Masuk Sebagai Ibu Bapa
      </button>
    </template>

    <!-- Guest -->
    <template v-else>
      <p class="text-sm text-slate-600" data-testid="invite-guest-text">
        Untuk memantau kemajuan pembelajaran anak anda di PRESTASIPLUS, sila log masuk menggunakan
        akaun Ibu Bapa anda. Selepas log masuk, buka semula pautan jemputan ini untuk mengesahkan
        hubungan.
      </p>
      <RouterLink to="/login" :class="PRIMARY_BUTTON" data-testid="invite-login">
        <LogIn class="h-4 w-4 shrink-0" />
        Log Masuk Sebagai Ibu Bapa
      </RouterLink>
      <div
        class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        data-testid="invite-register-note"
      >
        <Info class="mt-0.5 h-4 w-4 shrink-0" />
        <p class="min-w-0">
          Belum mempunyai akaun Ibu Bapa?
          <RouterLink
            to="/register"
            class="-my-3 inline-block py-3 font-semibold underline"
            data-testid="invite-register-link"
            >Daftar akaun Ibu Bapa</RouterLink
          >
          terlebih dahulu, kemudian buka semula pautan jemputan ini.
        </p>
      </div>
    </template>
  </InviteValidCard>
</template>
