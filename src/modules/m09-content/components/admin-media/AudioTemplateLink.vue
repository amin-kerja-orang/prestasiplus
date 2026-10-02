<script setup lang="ts">
/**
 * "Template XLSX" / "Template Word" (S12 header buttons, S13 guide box; FN-M09-5.1.3, 5.2.2). The
 * `href` is the live download path; a plain click fetches the placeholder file through the API and
 * saves it without leaving the page (OQ-M09-03). Modified clicks fall through to the route of the
 * same path, which downloads and returns to S12.
 * On S13 the live links render near-white on a pale box and cannot be read; they use the S12 button
 * colours here (DV-M09-20).
 */
import { FileSpreadsheet, FileText } from '@lucide/vue'

import { alertNative } from '@/composables'

import { downloadAudioTemplate } from '../../lib/admin-media/template-download'
import { AUDIO_TEMPLATE_PATH, AUDIO_TEMPLATE_WORD_PATH, COPY } from '../../lib/admin-media/common'

const props = defineProps<{ kind: 'xlsx' | 'word' }>()

const href = props.kind === 'xlsx' ? AUDIO_TEMPLATE_PATH : AUDIO_TEMPLATE_WORD_PATH

async function onClick(event: MouseEvent): Promise<void> {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  try {
    await downloadAudioTemplate(props.kind === 'xlsx' ? 'xlsx' : 'docx')
  } catch {
    alertNative(COPY.genericError)
  }
}
</script>

<template>
  <a
    :href="href"
    :class="[
      'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold whitespace-nowrap shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
      kind === 'xlsx'
        ? 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
        : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
    ]"
    :data-testid="kind === 'xlsx' ? 'template-xlsx' : 'template-word'"
    @click="onClick"
  >
    <FileSpreadsheet v-if="kind === 'xlsx'" class="h-4 w-4" aria-hidden="true" />
    <FileText v-else class="h-4 w-4" aria-hidden="true" />
    {{ kind === 'xlsx' ? 'Template XLSX' : 'Template Word' }}
  </a>
</template>
