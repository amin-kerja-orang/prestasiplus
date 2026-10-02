<script setup lang="ts">
/**
 * One flagged question of S11 (FN-M04-5.2.5..5.2.7): "#id", subject pill, "oleh {name}", the text
 * (structured: line breaks kept, cut by the API), the source file line, the upload form (required
 * image, icon submit, no confirm) and "Dismiss" (no confirm). Both calls clear the flag; the page then
 * reloads with the API `status` as the flash (FR-M04-100, FR-M04-101).
 */
import { FileText, Upload, X } from '@lucide/vue'
import { ref } from 'vue'

import { FORM_ERROR_TEXT_CLASS } from '@/components/form'

import {
  dismissDiagram,
  uploadDiagramImage,
  type DiagramKind,
  type DiagramMcqItem,
  type DiagramStructuredItem,
} from '../api/diagram-audit'
import { fieldErrors } from '../lib/ui-errors'

const props = defineProps<{
  kind: DiagramKind
  item: DiagramMcqItem | DiagramStructuredItem
}>()
const emit = defineEmits<{ done: [status: string]; failed: [error: unknown] }>()

const fileInput = ref<HTMLInputElement | null>(null)
const busy = ref(false)
/** SRS §5: the server's `image` message shows under the field in red. */
const imageError = ref('')

const text = (): string =>
  'questionText' in props.item ? props.item.questionText : props.item.stimulusExcerpt

async function upload(): Promise<void> {
  const file = fileInput.value?.files?.[0]
  if (!file || busy.value) return
  busy.value = true
  imageError.value = ''
  try {
    const result = await uploadDiagramImage(props.kind, props.item.id, file)
    emit('done', result.status)
  } catch (err) {
    const message = fieldErrors(err).image
    if (message) imageError.value = message
    else emit('failed', err)
  } finally {
    busy.value = false
  }
}

async function dismiss(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const result = await dismissDiagram(props.kind, props.item.id)
    emit('done', result.status)
  } catch (err) {
    emit('failed', err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <article
    class="flex flex-col gap-3 rounded-2xl border-b-2 border-amber-200 bg-white p-4 shadow sm:flex-row sm:items-start sm:justify-between"
    data-testid="diagram-card"
    :data-kind="kind"
    :data-question-id="item.id"
  >
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span class="text-slate-400">#{{ item.id }}</span>
        <span v-if="item.subject" class="font-semibold text-blue-600">{{ item.subject.name }}</span>
        <span class="text-slate-400">oleh {{ item.createdBy.name ?? '—' }}</span>
      </div>
      <p
        class="mt-1 text-sm break-words text-slate-800"
        :class="kind === 'structured' ? 'whitespace-pre-line' : ''"
        data-testid="diagram-text"
      >
        {{ text() }}
      </p>
      <p v-if="item.sourceFile" class="mt-1 flex items-center gap-1 text-xs text-slate-400">
        <FileText class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span class="break-all">{{ item.sourceFile }} ms.{{ item.sourcePage }}</span>
      </p>
    </div>

    <div class="flex shrink-0 flex-col gap-2 sm:items-end">
      <form method="post" class="flex items-center gap-2" @submit.prevent="upload">
        <input
          ref="fileInput"
          type="file"
          name="image"
          accept="image/*"
          required
          class="max-w-full min-w-0 text-xs text-slate-500"
          data-testid="diagram-file"
        />
        <button
          type="submit"
          :disabled="busy"
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-wait disabled:opacity-60"
          data-testid="diagram-upload"
        >
          <Upload class="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
      <p v-if="imageError" :class="FORM_ERROR_TEXT_CLASS" data-testid="diagram-file-error">
        {{ imageError }}
      </p>
      <button
        type="button"
        :disabled="busy"
        class="inline-flex min-h-11 items-center gap-1 self-start px-1 text-xs text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-wait disabled:opacity-60 sm:self-end"
        data-testid="diagram-dismiss"
        @click="dismiss"
      >
        <X class="h-3.5 w-3.5" aria-hidden="true" />
        Dismiss
      </button>
    </div>
  </article>
</template>
