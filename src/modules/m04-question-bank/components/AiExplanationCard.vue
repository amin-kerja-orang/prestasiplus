<script setup lang="ts">
/**
 * S3 card "Penjelasan AI" (FR-M04-44..47; `#penjelasan-ai-card`).
 *
 * Empty state + "Jana Penjelasan AI"; loading line while the call runs; on `{ok: true}` the page is
 * asked to reload (`generated`) and the stored Markdown renders with the `.prose-ai` styles. On
 * failure the empty state shows again beside the red error box, whose text follows the live script:
 * JSON `message`, else "HTTP {status}", else the JSON-parse exception text, else "Failed to fetch".
 */
import { Bot, LoaderCircle, RefreshCw, TriangleAlert, WandSparkles } from '@lucide/vue'
import { ref } from 'vue'

import { isApiError } from '@/api'
import { confirmNative } from '@/composables'

import { generateAiExplanation, type AiExplanation } from '../api/questions'
import { errorTextOf, REGENERATE_CONFIRM } from '../lib/question-list'
import MarkdownView from './MarkdownView.vue'

const props = defineProps<{ questionId: number; explanation: AiExplanation | null }>()
const emit = defineEmits<{ generated: [] }>()

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

function regenerate(): void {
  if (!confirmNative(REGENERATE_CONFIRM)) return
  void run(true)
}

const BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300'
</script>

<template>
  <section
    id="penjelasan-ai-card"
    class="rounded-2xl border-l-4 border-purple-500 bg-white p-4 shadow sm:p-6"
    data-testid="ai-card"
  >
    <div class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <h2 class="flex items-center gap-2 text-base font-bold text-slate-800">
        <Bot class="h-5 w-5 text-purple-600" aria-hidden="true" />
        Penjelasan AI
      </h2>
      <span class="text-xs font-medium text-slate-500"
        >Dijana AI · Boleh ada kesilapan, sahkan dengan cikgu</span
      >
    </div>

    <MarkdownView v-if="explanation" :source="explanation.markdown" data-testid="ai-content" />
    <p v-else-if="!loading" class="text-sm text-slate-600" data-testid="ai-empty">
      Belum ada Penjelasan AI untuk soalan ini. Klik butang untuk jana.
    </p>

    <p
      v-if="loading"
      class="flex items-center gap-2 text-sm text-slate-600"
      data-testid="ai-loading"
    >
      <LoaderCircle class="h-4 w-4 animate-spin" aria-hidden="true" />
      Sedang menjana penjelasan... (anggaran 5-15 saat)
    </p>

    <div
      v-if="errorText !== null"
      class="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      data-testid="ai-error"
    >
      <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span id="penjelasan-ai-error-msg" class="min-w-0 break-words">{{ errorText }}</span>
    </div>

    <div v-if="!loading" class="mt-3">
      <button
        v-if="!explanation"
        id="btn-jana-penjelasan-ai"
        type="button"
        :class="[BUTTON, 'bg-purple-600 hover:bg-purple-700']"
        data-testid="ai-generate"
        @click="run(false)"
      >
        <WandSparkles class="h-4 w-4" aria-hidden="true" />
        Jana Penjelasan AI
      </button>
      <button
        v-else
        id="btn-regen-penjelasan-ai"
        type="button"
        :class="[BUTTON, 'bg-purple-600 hover:bg-purple-700']"
        data-testid="ai-regenerate"
        @click="regenerate"
      >
        <RefreshCw class="h-4 w-4" aria-hidden="true" />
        Jana Semula
      </button>
    </div>
  </section>
</template>
