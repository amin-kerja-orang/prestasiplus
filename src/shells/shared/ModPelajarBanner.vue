<script setup lang="ts">
/**
 * Persistent, non-dismissible bar of Mod Pelajar (v2-portals US-07): tells the admin they see the
 * learner portal as the test student and gives the way back ("Keluar Mod Pelajar").
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useSessionStore } from '@/stores/session'

import { useFlash } from '@/composables/useFlash'

import { exitModPelajar } from './mod-pelajar'

const session = useSessionStore()
const router = useRouter()
const flash = useFlash()
const active = computed(() => session.mode !== null)
const studentName = computed(() => session.user?.name ?? '')

async function leave(): Promise<void> {
  try {
    await router.replace(await exitModPelajar())
  } catch {
    flash.show({ type: 'error', message: 'Mod Pelajar tidak dapat ditutup. Sila cuba lagi.' })
  }
}
</script>

<template>
  <div
    v-if="active"
    class="fixed inset-x-0 top-0 z-40 flex h-10 items-center gap-2.5 border-b border-default bg-elevated px-3 text-caption text-muted sm:px-4"
    role="status"
    data-testid="mod-pelajar-banner"
  >
    <span class="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-primary" aria-hidden="true">
      <UIcon name="i-ph-student" class="size-4" />
    </span>
    <p class="min-w-0 flex-1 truncate">
      <span class="font-semibold text-highlighted">Mod Pelajar:</span> anda melihat portal pelajar sebagai {{ studentName }}
    </p>
    <UButton
      color="neutral"
      variant="outline"
      size="xs"
      icon="i-ph-sign-out"
      class="shrink-0"
      data-testid="mod-pelajar-leave"
      @click="leave"
    >
      Keluar Mod Pelajar
    </UButton>
  </div>
</template>
