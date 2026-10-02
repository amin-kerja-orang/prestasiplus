<script setup lang="ts">
/**
 * S1 `/jemput-ibu-bapa` "Jemput Ibu Bapa - PRESTASIPLUS" (L45 FR-L45-03..18). The student's invite
 * link, copy / WhatsApp / regenerate actions and the linked parents, all from one call
 * (`GET /api/me/parent-invite`). Student only (route meta; guest -> /login, others -> 403 in place).
 * Loading and load error replicate M01 S9 (INFERRED). "Jana Link Baru" updates the field without a
 * reload and shows the success flash above the hero; a failure keeps the old link and shows the red
 * alert (INFERRED, UNVERIFIED COPY).
 */
import { Users } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

import { AlertBox, FlashOutlet, LoadingSpinner } from '@/components/feedback'

import { fetchParentInvite, generateParentInvite, type LinkedParent } from '../api/parent-invite'
import ConnectedParentsCard from '../components/jemput/ConnectedParentsCard.vue'
import InviteLinkCard from '../components/jemput/InviteLinkCard.vue'
import { JEMPUT_GENERIC_ERROR, sortParents } from '../lib/jemput'

const loading = ref(true)
const loadFailed = ref(false)
const token = ref('')
const parents = ref<LinkedParent[]>([])
const regenerating = ref(false)
const flash = ref<{ type: 'success'; message: string } | null>(null)
const errors = ref<string[]>([])

const sorted = computed(() => sortParents(parents.value))

async function load(): Promise<void> {
  loading.value = true
  loadFailed.value = false
  errors.value = []
  try {
    const view = await fetchParentInvite()
    token.value = view.token
    parents.value = view.parents
  } catch {
    loadFailed.value = true
    errors.value = [JEMPUT_GENERIC_ERROR]
  } finally {
    loading.value = false
  }
}

async function regenerate(): Promise<void> {
  if (regenerating.value) return
  regenerating.value = true
  flash.value = null
  errors.value = []
  try {
    const result = await generateParentInvite()
    token.value = result.token
    flash.value = { type: 'success', message: result.status }
  } catch {
    errors.value = [JEMPUT_GENERIC_ERROR]
  } finally {
    regenerating.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto w-full max-w-2xl space-y-6" data-testid="jemput-page">
    <FlashOutlet :flash="flash" data-testid="jemput-flash" />
    <AlertBox :messages="errors" data-testid="jemput-alert" />

    <div
      v-if="loading"
      class="flex justify-center py-10 text-indigo-600"
      role="status"
      data-testid="jemput-loading"
    >
      <LoadingSpinner />
    </div>

    <div v-else-if="loadFailed" class="text-center">
      <button
        type="button"
        class="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50"
        data-testid="jemput-retry"
        @click="load"
      >
        Cuba lagi
      </button>
    </div>

    <template v-else>
      <header
        class="flex items-center gap-4 rounded-2xl bg-linear-to-br from-rose-600 to-pink-600 p-5 text-white shadow-lg sm:p-6"
        data-testid="jemput-hero"
      >
        <span
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 sm:h-16 sm:w-16"
        >
          <Users class="h-7 w-7 sm:h-8 sm:w-8" />
        </span>
        <div class="min-w-0">
          <h1 class="font-heading text-2xl font-bold break-words text-white">Jemput Ibu Bapa 👨‍👩‍👧</h1>
          <p class="mt-1 text-sm text-white sm:text-base">
            Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda
          </p>
        </div>
      </header>

      <InviteLinkCard :token="token" :regenerating="regenerating" @regenerate="regenerate" />
      <ConnectedParentsCard :parents="sorted" />
    </template>
  </div>
</template>
