<script setup lang="ts">
/**
 * Persistent, non-dismissible bar of Mod Pelajar (v2-portals US-07): tells the admin they see the
 * learner portal as the test student and gives the way back ("Keluar Mod Pelajar").
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useSessionStore } from '@/stores/session'

import { useFlash } from '@/composables/useFlash'

import { exitModPelajar } from './mod-pelajar'

const session = useSessionStore()
const router = useRouter()
const flash = useFlash()
const active = computed(() => session.mode !== null)
const studentName = computed(() => session.user?.name ?? '')

// The text wraps on a phone, so the bar grows; the shell below it reads its height from `--mod-bar-h`.
const bar = ref<HTMLElement | null>(null)
let observer: ResizeObserver | null = null
function publish(): void {
  if (bar.value) document.documentElement.style.setProperty('--mod-bar-h', `${bar.value.offsetHeight}px`)
}
watch(bar, (el) => {
  observer?.disconnect()
  if (!el) {
    document.documentElement.style.removeProperty('--mod-bar-h')
    return
  }
  publish()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(publish)
    observer.observe(el)
  }
})
onBeforeUnmount(() => {
  observer?.disconnect()
  document.documentElement.style.removeProperty('--mod-bar-h')
})

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
    ref="bar"
    class="fixed inset-x-0 top-0 z-40 flex min-h-10 items-center gap-3 bg-highlight px-3 py-1 text-label text-on-highlight sm:px-4"
    role="status"
    data-testid="mod-pelajar-banner"
  >
    <UIcon name="i-ph-student" class="size-5 shrink-0" />
    <p class="min-w-0 flex-1 leading-tight">
      Mod Pelajar: anda melihat portal pelajar sebagai {{ studentName }}
    </p>
    <button
      type="button"
      class="inline-flex min-h-11 shrink-0 items-center rounded-md bg-inverted px-3 text-caption font-semibold text-inverted hover:bg-inverted/90"
      data-testid="mod-pelajar-leave"
      @click="leave"
    >
      Keluar Mod Pelajar
    </button>
  </div>
</template>
