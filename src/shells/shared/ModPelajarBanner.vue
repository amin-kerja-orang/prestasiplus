<script setup lang="ts">
/**
 * Persistent, non-dismissible bar of Mod Pelajar (v2-portals US-07): tells the admin they see the
 * learner portal as the test student and gives the way back ("Keluar Mod Pelajar").
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useSessionStore } from '@/stores/session'

import { leaveModPelajar } from './mod-pelajar'

const session = useSessionStore()
const router = useRouter()
const active = computed(() => session.mode !== null)
const studentName = computed(() => session.user?.name ?? '')

async function leave(): Promise<void> {
  await router.replace(leaveModPelajar())
}
</script>

<template>
  <div
    v-if="active"
    class="fixed inset-x-0 top-0 z-40 flex h-10 items-center gap-3 bg-highlight px-3 text-label text-on-highlight sm:px-4"
    role="status"
    data-testid="mod-pelajar-banner"
  >
    <UIcon name="i-ph-student" class="size-5 shrink-0" />
    <p class="min-w-0 flex-1 truncate">
      Mod Pelajar: anda melihat portal pelajar sebagai {{ studentName }}
    </p>
    <button
      type="button"
      class="inline-flex h-8 shrink-0 items-center rounded-md bg-inverted px-3 text-caption font-semibold text-inverted hover:bg-inverted/90"
      data-testid="mod-pelajar-leave"
      @click="leave"
    >
      Keluar Mod Pelajar
    </button>
  </div>
</template>
