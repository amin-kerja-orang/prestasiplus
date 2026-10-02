<script setup lang="ts">
/**
 * S16 share card (FR-M09-35; URS FN-M09-2.3.6). WhatsApp / Facebook / Twitter open in a new tab;
 * the link button writes `location.href` to the clipboard and shows "Link Disalin!" for 2000 ms.
 * Brand glyphs: the shared WhatsApp icon and the simple-icons Facebook / Twitter glyphs
 * (design-system §6.9). No ARIA beyond live (D10).
 */
import { Link } from '@lucide/vue'
import { computed, onBeforeUnmount, ref } from 'vue'

import { ARTIKEL_COPY, shareLinks } from '../../lib/artikel/artikel'
import WhatsAppIcon from '../icons/WhatsAppIcon.vue'
import ShareBrandIcon from './ShareBrandIcon.vue'

const props = defineProps<{ title: string }>()

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const links = computed(() => shareLinks(props.title, window.location.href))

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.location.href)
  } catch {
    // Clipboard unavailable (insecure context): the confirmation is still shown, as live does.
  }
  copied.value = true
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
    timer = null
  }, 2000)
}

onBeforeUnmount(() => {
  if (timer !== null) clearTimeout(timer)
})

const BUTTON =
  'inline-flex h-11 w-11 items-center justify-center rounded-xl text-white shadow transition hover:scale-105'
</script>

<template>
  <section
    class="rounded-2xl bg-linear-to-br from-purple-500 to-pink-500 p-5 text-center text-white shadow-lg"
    data-testid="artikel-share"
  >
    <h2 class="text-lg font-bold">{{ ARTIKEL_COPY.shareTitle }}</h2>
    <p class="mt-1 text-sm">{{ ARTIKEL_COPY.shareBody }}</p>
    <div class="mt-4 flex flex-wrap items-center justify-center gap-3">
      <a
        :href="links.whatsapp"
        target="_blank"
        rel="noopener noreferrer"
        :class="[BUTTON, 'bg-green-500']"
        data-testid="share-whatsapp"
        ><WhatsAppIcon class="h-5 w-5"
      /></a>
      <a
        :href="links.facebook"
        target="_blank"
        rel="noopener noreferrer"
        :class="[BUTTON, 'bg-blue-600']"
        data-testid="share-facebook"
        ><ShareBrandIcon name="facebook" class="h-5 w-5"
      /></a>
      <a
        :href="links.twitter"
        target="_blank"
        rel="noopener noreferrer"
        :class="[BUTTON, 'bg-sky-500']"
        data-testid="share-twitter"
        ><ShareBrandIcon name="twitter" class="h-5 w-5"
      /></a>
      <button
        type="button"
        :class="[BUTTON, 'bg-amber-400']"
        data-testid="share-copy"
        @click="copyLink"
      >
        <Link class="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
    <p v-if="copied" class="mt-3 text-sm font-semibold" data-testid="share-copied">
      {{ ARTIKEL_COPY.copied }}
    </p>
  </section>
</template>
