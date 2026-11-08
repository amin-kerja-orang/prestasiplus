<script setup lang="ts">
/**
 * Global offline / online banner (40 §X10.3.3, ERR-NET-01 / ERR-NET-03, AC-ERR-4).
 *
 * Fixed to the top of the viewport so it overlays the page and never pushes the layout (no shift at
 * 375 px). The live region (`role="status"`) is always in the DOM so screen readers announce the
 * text changes; the bar itself shows only while offline and for 3 s after reconnecting.
 * Mount it once, in the app layout. It starts and stops its own `online` / `offline` listeners.
 */
import { onBeforeUnmount, onMounted } from 'vue'

import { OFFLINE_MESSAGE_BM, RESTORED_MESSAGE_BM, useOffline } from '@/api/offline'

const { status, startOfflineWatch } = useOffline()

let stop: (() => void) | undefined
onMounted(() => {
  stop = startOfflineWatch()
})
onBeforeUnmount(() => {
  stop?.()
})
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
    role="status"
    aria-live="polite"
    data-ds="offline-banner"
    data-testid="offline-banner"
  >
    <p
      v-if="status !== 'online'"
      class="pointer-events-auto flex w-full items-center gap-2 bg-primary px-4 py-3 text-body text-primary-on"
      :data-state="status"
    >
      <UIcon
        :name="status === 'offline' ? 'i-ph-wifi-slash' : 'i-ph-wifi-high'"
        class="size-5 shrink-0"
        aria-hidden="true"
      />
      <span class="min-w-0 grow">{{
        status === 'offline' ? OFFLINE_MESSAGE_BM : RESTORED_MESSAGE_BM
      }}</span>
    </p>
  </div>
</template>
