<script setup lang="ts">
/**
 * One flagged question of S11 (FN-M04-5.2.5..5.2.7): "#id", subject pill, "oleh {name}", the text
 * (structured: line breaks kept, cut by the API), the source file line, the upload form (required
 * image, icon submit, no confirm) and "Dismiss" (no confirm). Both calls clear the flag; the page then
 * reloads with the API `status` as the flash (FR-M04-100, FR-M04-101).
 */
import { ref } from 'vue'

import { DsFileField } from '@/ds'

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
const file = ref<File | null>(null)
const busy = ref(false)
/** SRS §5: the server's `image` message shows under the field in red. */
const imageError = ref('')

const text = (): string =>
  'questionText' in props.item ? props.item.questionText : props.item.stimulusExcerpt

async function upload(): Promise<void> {
  const picked = file.value
  if (!picked || busy.value) return
  busy.value = true
  imageError.value = ''
  try {
    const result = await uploadDiagramImage(props.kind, props.item.id, picked)
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
  <UCard data-testid="diagram-card" :data-kind="kind" :data-question-id="item.id">
    <article class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
          <span class="tabular text-muted">#{{ item.id }}</span>
          <span v-if="item.subject" class="text-label text-primary">{{ item.subject.name }}</span>
          <span class="text-muted">oleh {{ item.createdBy.name ?? '—' }}</span>
        </div>
        <p
          class="mt-1 text-body break-words text-highlighted"
          :class="kind === 'structured' ? 'whitespace-pre-line' : ''"
          data-testid="diagram-text"
        >
          {{ text() }}
        </p>
        <p v-if="item.sourceFile" class="mt-1 flex items-center gap-1 text-caption text-muted">
          <UIcon name="i-ph-file-text" class="size-4 shrink-0" />
          <span class="break-all">{{ item.sourceFile }} ms.{{ item.sourcePage }}</span>
        </p>
      </div>

      <div class="flex flex-col gap-2 sm:w-72 sm:shrink-0">
        <form method="post" class="flex items-center gap-2" @submit.prevent="upload">
          <DsFileField
            v-model="file"
            name="image"
            accept="image/*"
            required
            preview="none"
            class="min-w-0 flex-1"
            data-testid="diagram-file"
          >
            <template #default="{ open }">
              <UButton
                type="button"
                color="neutral"
                variant="soft"
                icon="i-ph-image"
                class="min-h-11 w-full min-w-0 justify-start"
                @click="open()"
              >
                <span class="truncate">{{ file ? file.name : 'Pilih gambar' }}</span>
              </UButton>
            </template>
          </DsFileField>
          <UButton
            type="submit"
            icon="i-ph-upload-simple"
            aria-label="Muat naik gambar"
            :loading="busy"
            :disabled="busy"
            class="size-11 shrink-0 justify-center"
            data-testid="diagram-upload"
          />
        </form>
        <p v-if="imageError" class="text-caption text-error" data-testid="diagram-file-error">
          {{ imageError }}
        </p>
        <div>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            icon="i-ph-x"
            :disabled="busy"
            class="min-h-11"
            data-testid="diagram-dismiss"
            @click="dismiss"
          >
            Dismiss
          </UButton>
        </div>
      </div>
    </article>
  </UCard>
</template>
