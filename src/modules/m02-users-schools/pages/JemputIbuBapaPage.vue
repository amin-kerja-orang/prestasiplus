<script setup lang="ts">
/**
 * S1 `/jemput-ibu-bapa` "Jemput Ibu Bapa - PRESTASIPLUS" (L45 FR-L45-03..18). The student's invite
 * link, copy / WhatsApp / regenerate actions and the linked parents, all from one call
 * (`GET /api/me/parent-invite`). Student only (route meta; guest -> /login, others -> 403 in place).
 * Loading and load error replicate M01 S9 (INFERRED). "Jana Pautan Baharu" updates the field without a
 * reload and shows the success flash above the hero; a failure keeps the old link and shows the red
 * alert (INFERRED, UNVERIFIED COPY).
 */
import { computed, onMounted, ref } from 'vue'

import { DsIconChip, DsPage } from '@/ds'

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
  <DsPage class="max-w-2xl" data-testid="jemput-page">
    <h1 v-if="loading || loadFailed" class="sr-only">Jemput Ibu Bapa</h1>
    <UAlert
      v-if="flash"
      color="success"
      variant="soft"
      icon="i-ph-check-circle-duotone"
      :title="flash.message"
      data-testid="jemput-flash"
    />
    <UAlert
      v-if="errors.length > 0"
      color="error"
      variant="soft"
      icon="i-ph-warning-circle-duotone"
      :title="errors.join(' ')"
      data-testid="jemput-alert"
    />

    <div
      v-if="loading"
      class="flex justify-center py-10 text-muted"
      role="status"
      data-testid="jemput-loading"
    >
      <UIcon name="i-ph-spinner-gap" class="size-7 animate-spin motion-reduce:animate-none" />
    </div>

    <div v-else-if="loadFailed" class="text-center">
      <UButton
        color="neutral"
        variant="soft"
        size="xl"
        class="min-h-11 justify-center"
        data-testid="jemput-retry"
        @click="load"
        >Cuba lagi</UButton
      >
    </div>

    <template v-else>
      <header
        class="flex items-center gap-4 rounded-3xl bg-gradient-primary p-5 text-primary-on shadow-hero sm:p-6"
        data-testid="jemput-hero"
      >
        <DsIconChip icon="i-ph-users-three-duotone" accent="win" size="lg" />
        <div class="min-w-0">
          <h1 class="font-display text-title font-extrabold break-words">Jemput Ibu Bapa 👨‍👩‍👧</h1>
          <p class="mt-1 text-body">
            Kongsi pautan ini dengan ibu bapa untuk pantau perkembangan anda
          </p>
        </div>
      </header>

      <InviteLinkCard :token="token" :regenerating="regenerating" @regenerate="regenerate" />
      <ConnectedParentsCard :parents="sorted" />
    </template>
  </DsPage>
</template>
