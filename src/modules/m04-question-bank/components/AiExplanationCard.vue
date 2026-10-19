<script setup lang="ts">
/**
 * S3 card "Penjelasan AI" (FR-M04-44..47; `#penjelasan-ai-card`).
 *
 * Empty state + "Jana Penjelasan AI"; loading line while the call runs; on `{ok: true}` the page is
 * asked to reload (`generated`) and the stored Markdown renders with the `.prose-ai` styles. On
 * failure the empty state shows again beside the red error box, whose text follows the live script:
 * JSON `message`, else "HTTP {status}", else the JSON-parse exception text, else "Failed to fetch".
 */
import { ref } from 'vue'

import { isApiError } from '@/api'
import { useConfirm } from '@/ds'

import { generateAiExplanation, type AiExplanation } from '../api/questions'
import { errorTextOf, REGENERATE_CONFIRM } from '../lib/question-list'
import MarkdownView from './MarkdownView.vue'

const props = defineProps<{ questionId: number; explanation: AiExplanation | null }>()
const emit = defineEmits<{ generated: [] }>()

const confirm = useConfirm()
const loading = ref(false)
const errorText = ref<string | null>(null)

async function run(force: boolean): Promise<void> {
  if (loading.value) return
  loading.value = true
  errorText.value = null
  try {
    const reply = await generateAiExplanation(props.questionId, { force })
    const body = reply.body as { ok?: unknown } | null
    if (
      reply.status >= 200 &&
      reply.status < 300 &&
      typeof body === 'object' &&
      body?.ok === true
    ) {
      emit('generated')
    } else {
      errorText.value = errorTextOf(reply)
    }
  } catch (err) {
    if (isApiError(err) && (err.code === 'NETWORK_ERROR' || err.status === 0)) {
      errorText.value = 'Failed to fetch'
    } else {
      errorText.value = (err instanceof Error && err.message) || 'Gagal jana penjelasan'
    }
  } finally {
    loading.value = false
  }
}

async function regenerate(): Promise<void> {
  if (!(await confirm({ message: REGENERATE_CONFIRM }))) return
  void run(true)
}

</script>

<template>
  <UCard id="penjelasan-ai-card" data-testid="ai-card">
    <div class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <h2 class="flex items-center gap-2 text-subheading text-highlighted">
        <UIcon name="i-ph-robot" class="size-5 text-primary-t" />
        Penjelasan AI
      </h2>
      <span class="text-caption text-muted"
        >Dijana AI · Boleh ada kesilapan, sahkan dengan cikgu</span
      >
    </div>

    <MarkdownView v-if="explanation" :source="explanation.markdown" data-testid="ai-content" />
    <p v-else-if="!loading" class="text-body text-muted" data-testid="ai-empty">
      Belum ada Penjelasan AI untuk soalan ini. Klik butang untuk jana.
    </p>

    <p v-if="loading" class="flex items-center gap-2 text-body text-muted" data-testid="ai-loading">
      <UIcon name="i-ph-spinner" class="size-4" />
      Sedang menjana penjelasan... (anggaran 5-15 saat)
    </p>

    <UAlert
      v-if="errorText !== null"
      color="error"
      variant="subtle"
      icon="i-ph-warning"
      class="mt-3"
      role="alert"
      data-testid="ai-error"
    >
      <template #description>
        <span id="penjelasan-ai-error-msg" class="min-w-0 break-words">{{ errorText }}</span>
      </template>
    </UAlert>

    <div v-if="!loading" class="mt-3">
      <UButton
        v-if="!explanation"
        id="btn-jana-penjelasan-ai"
        type="button"
        icon="i-ph-magic-wand"
        class="min-h-11"
        data-testid="ai-generate"
        @click="run(false)"
      >
        Jana Penjelasan AI
      </UButton>
      <UButton
        v-else
        id="btn-regen-penjelasan-ai"
        type="button"
        color="neutral"
        variant="soft"
        icon="i-ph-arrows-clockwise"
        class="min-h-11"
        data-testid="ai-regenerate"
        @click="regenerate"
      >
        Jana Semula
      </UButton>
    </div>
  </UCard>
</template>
