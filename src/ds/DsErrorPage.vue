<script setup lang="ts">
/**
 * 403 / 404 / error page (`v2-shells.md` 7): centred, max 28rem, no gradient and no lines. The
 * learner personality shows the friend (encouraging) instead of the glyph. Actions go in the
 * `actions` slot (row from `sm`, stacked full-width below). Copy defaults to the BM text of the
 * spec and can be overridden.
 */
import { computed } from 'vue'

import type { FriendId } from './assets'
import DsFriendFace from './DsFriendFace.vue'
import DsIconChip from './DsIconChip.vue'
import { usePersonality } from './personality'

type ErrorKind = 403 | 404 | 500

const props = withDefaults(
  defineProps<{
    code?: ErrorKind
    title?: string
    description?: string
    friend?: FriendId
  }>(),
  { code: 404, title: undefined, description: undefined, friend: 'aiman' },
)

const COPY: Record<ErrorKind, { title: string; description: string; icon: string }> = {
  403: {
    title: 'Akses Ditolak',
    description: 'Halaman ini tidak tersedia untuk peranan anda.',
    icon: 'i-ph-lock-simple',
  },
  404: {
    title: 'Halaman Tidak Dijumpai',
    description:
      'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?',
    icon: 'i-ph-magnifying-glass',
  },
  500: {
    title: 'Sesuatu tidak kena',
    description: 'Kami tidak dapat memuatkan halaman ini. Cuba lagi sebentar.',
    icon: 'i-ph-warning-circle',
  },
}

const personality = usePersonality()
const copy = computed(() => COPY[props.code])
</script>

<template>
  <section
    class="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-12 text-center md:py-16"
    :data-code="code"
    data-ds="error-page"
  >
    <DsFriendFace v-if="personality === 'learner'" :friend="friend" mood="encouraging" size="xl" />
    <DsIconChip v-else :icon="copy.icon" accent="action" />
    <p class="tabular text-overline text-muted">{{ code }}</p>
    <h1 class="font-display text-title font-extrabold text-highlighted">
      {{ title ?? copy.title }}
    </h1>
    <p class="text-body text-muted">{{ description ?? copy.description }}</p>
    <div
      v-if="$slots.actions"
      class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
      data-ds="error-actions"
    >
      <slot name="actions" />
    </div>
  </section>
</template>
