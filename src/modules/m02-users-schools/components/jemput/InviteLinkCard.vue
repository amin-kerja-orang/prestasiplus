<script setup lang="ts">
/**
 * S1 card "Link Jemputan" (L45 FR-L45-06..10, DV-L45-03/04). Read-only URL field plus "Salin",
 * "Hantar via WhatsApp" and "Jana Link Baru". The page owns the token and the regenerate request;
 * this card owns the copy feedback. "Salin" shows "Disalin!" for 2 s only after a successful clipboard
 * write (DV-L45-04). The WhatsApp anchor keeps its `href` but the click does not navigate (D14,
 * DV-L45-03). No ARIA beyond native elements (D10, NFR-L45-02).
 */
import { Check, Copy, Link, RefreshCw } from '@lucide/vue'
import { computed, onBeforeUnmount, ref } from 'vue'

import { inviteUrl, whatsAppHref } from '../../lib/jemput'
import WhatsAppIcon from './WhatsAppIcon.vue'

const props = defineProps<{ token: string; regenerating: boolean }>()
const emit = defineEmits<{ regenerate: [] }>()

const COPIED_MS = 2000
const field = ref<HTMLInputElement | null>(null)
const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const url = computed(() => inviteUrl(props.token, window.location.origin))
const waHref = computed(() => whatsAppHref(url.value))

async function copy(): Promise<void> {
  field.value?.select()
  try {
    await navigator.clipboard.writeText(url.value)
  } catch {
    return // FR-L45-08: clipboard unavailable or refused, no change and no message
  }
  copied.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
    timer = null
  }, COPIED_MS)
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

const BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
</script>

<template>
  <section
    class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    data-testid="jemput-link-card"
  >
    <h2 class="flex items-center gap-2 font-heading text-lg font-bold text-slate-900">
      <Link class="h-5 w-5 text-indigo-500" />
      Link Jemputan
    </h2>
    <p class="mt-2 text-sm text-slate-600">
      Salin link ini dan hantar kepada ibu bapa anda melalui WhatsApp atau mesej.
    </p>

    <div class="mt-4 flex items-center gap-2">
      <input
        ref="field"
        type="text"
        readonly
        :value="url"
        class="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300"
        data-testid="jemput-url"
      />
      <button
        type="button"
        :class="[
          BUTTON,
          'shrink-0 text-white focus-visible:ring-indigo-400',
          copied ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700',
        ]"
        :data-copied="copied ? 'true' : 'false'"
        data-testid="jemput-copy"
        @click="copy"
      >
        <component :is="copied ? Check : Copy" class="h-4 w-4" />
        {{ copied ? 'Disalin!' : 'Salin' }}
      </button>
    </div>

    <div class="mt-3 flex flex-col gap-3 sm:flex-row">
      <a
        :href="waHref"
        target="_blank"
        rel="noopener noreferrer"
        :class="[
          BUTTON,
          'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-400 sm:flex-1',
        ]"
        data-testid="jemput-whatsapp"
        @click.prevent
      >
        <WhatsAppIcon class="h-5 w-5" />
        Hantar via WhatsApp
      </a>
      <button
        type="button"
        :disabled="regenerating"
        :class="[
          BUTTON,
          'bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60',
        ]"
        data-testid="jemput-regenerate"
        @click="emit('regenerate')"
      >
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': regenerating }" />
        Jana Link Baru
      </button>
    </div>
  </section>
</template>
