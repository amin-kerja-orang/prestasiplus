<script setup lang="ts">
/**
 * L45 S2 `/ibu-bapa/terima/:token` (FR-L45-19..30; owner M01, data from M02 through its public entry,
 * ADR-0009). Public standalone page. `GET /api/parent-invites/:token` decides the page:
 * - 404 (any unknown, replaced or inactive-student token): "Pautan Tidak Sah" (OBSERVED copy, FR-L45-19);
 * - `viewer: guest`: log-in CTA plus the register note (FR-L45-24/25, PROPOSED);
 * - `viewer: other`: switch-account state with "Log Keluar & Log Masuk Sebagai Ibu Bapa" (FR-L45-26);
 * - `viewer: parent`: `POST .../accept` once, then the linked state (FR-L45-27); a failure keeps the
 *   valid card and shows the red alert (FR-L45-29, INFERRED, UNVERIFIED COPY).
 * A GET never links (DV-L45-05). The token is never carried through login or registration (FR-L45-30).
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { usePageMeta } from '@/composables'
import { DsLoadError } from '@/ds'
import {
  acceptParentInvite,
  fetchInvitePreview,
  type AcceptResult,
  type InvitePreview,
} from '@/modules/m02-users-schools'

import AuthAlert from '../components/auth/AuthAlert.vue'
import InviteInvalidCard from '../components/invite/InviteInvalidCard.vue'
import InviteValidCard from '../components/invite/InviteValidCard.vue'
import { GENERIC_ERROR } from '../lib/error-lines'

const props = defineProps<{ token: string }>()

const INVALID_TITLE = 'Pautan Tidak Sah — PRESTASIPLUS'
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

</script>

<template>
  <main
    v-if="phase === 'loading'"
    class="flex min-h-dvh items-center justify-center bg-muted px-4"
    role="status"
    data-testid="invite-loading"
  >
    <UProgress animation="carousel" class="w-40" aria-label="Memuatkan" />
  </main>

  <InviteInvalidCard v-else-if="phase === 'invalid'" />

  <main
    v-else-if="phase === 'error'"
    class="flex min-h-dvh flex-col items-center justify-center gap-4 bg-muted px-3 py-6"
    data-testid="invite-error"
  >
    <div class="w-full max-w-lg">
      <DsLoadError :message="GENERIC_ERROR" retry-testid="invite-retry" @retry="load" />
    </div>
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
        class="flex justify-center py-6"
        role="status"
        data-testid="invite-accepting"
      >
        <UProgress animation="carousel" class="w-28" aria-label="Menghubungkan" />
      </div>
      <template v-else-if="linked">
        <UAlert
          color="success"
          variant="subtle"
          icon="i-ph-check-circle-duotone"
          :description="`Akaun anda (${linked.parent.name}) telah dihubungkan dengan pelajar ini. Anda kini boleh memantau kemajuan mereka.`"
          data-testid="invite-linked-box"
        />
        <UButton
          :to="`/pelajar/${linked.student.id}`"
          block
          size="xl"
          variant="solid"
          icon="i-ph-chart-line-up-duotone"
          data-testid="invite-profile-link"
          >Lihat Profil Kemajuan</UButton
        >
      </template>
      <AuthAlert v-else :messages="acceptErrors" data-testid="invite-accept-alert" />
    </template>

    <!-- Logged-in non-parent -->
    <template v-else-if="preview.viewer === 'other'">
      <p class="text-body text-toned" data-testid="invite-other-text">
        Anda kini log masuk sebagai akaun yang
        <strong class="text-highlighted">bukan Ibu Bapa</strong>. Untuk berhubung dengan pelajar
        ini, sila log keluar dan log masuk semula menggunakan akaun Ibu Bapa anda.
      </p>
      <UButton
        type="button"
        block
        size="xl"
        variant="solid"
        icon="i-ph-sign-out-duotone"
        data-testid="invite-switch"
        @click="switchAccount"
      >
        Log Keluar &amp; Log Masuk Sebagai Ibu Bapa
      </UButton>
    </template>

    <!-- Guest -->
    <template v-else>
      <p class="text-body text-toned" data-testid="invite-guest-text">
        Untuk memantau kemajuan pembelajaran anak anda di PRESTASIPLUS, sila log masuk menggunakan
        akaun Ibu Bapa anda. Selepas log masuk, buka semula pautan jemputan ini untuk mengesahkan
        hubungan.
      </p>
      <UButton
        to="/login"
        block
        size="xl"
        variant="solid"
        icon="i-ph-sign-in-duotone"
        data-testid="invite-login"
      >
        Log Masuk Sebagai Ibu Bapa
      </UButton>
      <UAlert
        color="warning"
        variant="subtle"
        icon="i-ph-info-duotone"
        data-testid="invite-register-note"
      >
        <template #description>
          Belum mempunyai akaun Ibu Bapa?
          <ULink to="/register" class="text-highlighted" data-testid="invite-register-link"
            >Daftar akaun Ibu Bapa</ULink
          >
          terlebih dahulu, kemudian buka semula pautan jemputan ini.
        </template>
      </UAlert>
    </template>
  </InviteValidCard>
</template>
