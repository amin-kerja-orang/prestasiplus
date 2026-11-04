<script setup lang="ts">
/**
 * 403 / 404 / error page (`v2-shells.md` 7): centred, max 28rem, no gradient and no lines. The
 * learner personality shows the friend (encouraging) instead of the glyph. Actions go in the
 * `actions` slot (row from `sm`, stacked full-width below). Copy defaults to the BM text of the
 * spec and can be overridden.
 */
import { computed } from 'vue'

import type { FriendId } from './assets'
import { dsCopy, fillCopy } from './copy'
import DsFriendFace from './DsFriendFace.vue'
import DsIconChip from './DsIconChip.vue'
import { usePersonality } from './personality'

type ErrorKind = 403 | 404 | 500 | 503

const props = withDefaults(
  defineProps<{
    code?: ErrorKind
    title?: string
    description?: string
    friend?: FriendId
    /** Server request id; shown with `Salin` on 5xx codes only (X10.3.8, AC-ERR-7). */
    requestId?: string
  }>(),
  { code: 404, title: undefined, description: undefined, friend: 'aiman', requestId: undefined },
)

const COPY: Record<ErrorKind, { title: string; description: string; icon: string }> = {
  403: {
    title: dsCopy.error403Title,
    description: dsCopy.error403Description,
    icon: 'i-ph-lock-simple',
  },
  404: {
    title: dsCopy.error404Title,
    description: dsCopy.error404Description,
    icon: 'i-ph-magnifying-glass',
  },
  500: {
    title: dsCopy.error500Title,
    description: dsCopy.error500Description,
    icon: 'i-ph-warning-circle',
  },
  503: {
    title: dsCopy.error503Title,
    description: dsCopy.error503Description,
    icon: 'i-ph-wrench',
  },
}

const personality = usePersonality()
const copy = computed(() => COPY[props.code])
const showReference = computed(() => props.code >= 500 && !!props.requestId)

async function copyReference(): Promise<void> {
  if (!props.requestId || typeof navigator === 'undefined' || !navigator.clipboard) return
  try {
    await navigator.clipboard.writeText(props.requestId)
  } catch {
    /* clipboard denied: the id stays visible to copy by hand */
  }
}
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
    <div v-if="showReference" class="flex flex-col items-center gap-1" data-ds="error-reference">
      <p class="flex flex-wrap items-center justify-center gap-2 text-body text-muted">
        <span class="break-all">{{
          fillCopy(dsCopy.errorReference, { requestId: requestId ?? '' })
        }}</span>
        <UButton
          size="lg"
          class="min-h-11"
          color="neutral"
          variant="soft"
          :label="dsCopy.errorReferenceCopy"
          data-ds="error-reference-copy"
          @click="copyReference"
        />
      </p>
      <p class="text-body text-muted">{{ dsCopy.errorReferenceHint }}</p>
    </div>
    <div
      v-if="$slots.actions"
      class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
      data-ds="error-actions"
    >
      <slot name="actions" />
    </div>
  </section>
</template>
