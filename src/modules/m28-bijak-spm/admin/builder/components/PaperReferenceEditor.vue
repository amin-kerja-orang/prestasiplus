<script setup lang="ts">
/**
 * "Bahan rujukan (kulit kertas)" of Semak Kertas (R4; V2 cloud-student-mechanism 3.4, scope R1-21.7):
 * panels with a title, text / formula lines and an optional image, reordered with up / down, saved as
 * one list (`PUT /admin/papers/:id {reference}`). Images go through the existing question image upload
 * (`POST /api/files?purpose=question_image`); the page supplies `upload`. A panel needs a title.
 */
import { computed, ref, watch } from 'vue'

import { builderCopy as t } from '../domain/copy'
import type { ReferencePanel } from '../server/api'

const props = defineProps<{
  panels: readonly ReferencePanel[]
  readonly?: boolean
  busy?: boolean
  upload: (file: File) => Promise<string>
}>()
const emit = defineEmits<{ save: [panels: ReferencePanel[]] }>()

const draft = ref<ReferencePanel[]>([])
const uploadError = ref('')
watch(
  () => props.panels,
  (p) => (draft.value = p.map((x) => ({ ...x, items: [...x.items] }))),
  { immediate: true },
)

const valid = computed(() => draft.value.every((p) => p.title.trim().length > 0))

const addPanel = (): void => void draft.value.push({ title: '', items: [] })
const removePanel = (i: number): void => void draft.value.splice(i, 1)
function move(i: number, d: -1 | 1): void {
  const j = i + d
  if (j < 0 || j >= draft.value.length) return
  const [x] = draft.value.splice(i, 1)
  draft.value.splice(j, 0, x!)
}
const addLine = (i: number): void => void draft.value[i]!.items.push('')
const removeLine = (i: number, k: number): void => void draft.value[i]!.items.splice(k, 1)

async function onFile(i: number, e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploadError.value = ''
  try {
    draft.value[i]!.imageFileId = await props.upload(file)
  } catch (err) {
    uploadError.value = err instanceof Error && err.message ? err.message : t.refUploadFailed
  }
}
function removeImage(i: number): void {
  delete draft.value[i]!.imageFileId
}

function submit(): void {
  if (!valid.value || props.readonly) return
  emit(
    'save',
    draft.value.map((p) => ({
      title: p.title.trim(),
      items: p.items.map((x) => x.trim()).filter(Boolean),
      ...(p.imageFileId ? { imageFileId: p.imageFileId } : {}),
    })),
  )
}
</script>

<template>
  <form class="flex flex-col gap-3" data-testid="reference-editor" @submit.prevent="submit">
    <h3 class="text-heading text-highlighted">{{ t.refTitle }}</h3>
    <div
      v-for="(p, i) in draft"
      :key="i"
      class="flex flex-col gap-2 rounded-lg bg-muted p-3"
      :data-testid="`ref-panel-${i}`"
    >
      <div class="flex flex-wrap items-end gap-2">
        <UFormField :label="t.refPanelTitle" required class="min-w-0 grow">
          <UInput v-model="p.title" class="w-full" :disabled="readonly" :data-testid="`ref-title-${i}`" />
        </UFormField>
        <div v-if="!readonly" class="flex gap-1">
          <UButton color="neutral" variant="ghost" icon="i-ph-arrow-up" :aria-label="t.upAria(i + 1)" class="min-h-11 min-w-11" :disabled="i === 0" :data-testid="`ref-up-${i}`" @click="move(i, -1)" />
          <UButton color="neutral" variant="ghost" icon="i-ph-arrow-down" :aria-label="t.downAria(i + 1)" class="min-h-11 min-w-11" :disabled="i === draft.length - 1" :data-testid="`ref-down-${i}`" @click="move(i, 1)" />
          <UButton color="error" variant="ghost" icon="i-ph-x" :aria-label="t.refRemovePanel" class="min-h-11 min-w-11" :data-testid="`ref-remove-${i}`" @click="removePanel(i)" />
        </div>
      </div>
      <div v-for="(_, k) in p.items" :key="k" class="flex items-center gap-2">
        <UInput v-model="p.items[k]" class="min-w-0 grow" :aria-label="t.refLine" :disabled="readonly" :data-testid="`ref-line-${i}-${k}`" />
        <UButton v-if="!readonly" color="error" variant="ghost" icon="i-ph-trash" :aria-label="t.remove" class="min-h-11 min-w-11" @click="removeLine(i, k)" />
      </div>
      <p v-if="p.imageFileId" class="flex items-center gap-2 text-caption text-muted" :data-testid="`ref-image-${i}`">
        <UIcon name="i-ph-image" class="size-4" aria-hidden="true" />{{ t.refImageAttached }}
        <UButton v-if="!readonly" color="neutral" variant="link" size="sm" :label="t.refRemoveImage" class="min-h-11" @click="removeImage(i)" />
      </p>
      <div v-if="!readonly" class="flex flex-wrap gap-2">
        <UButton color="neutral" variant="soft" icon="i-ph-text-aa" :label="t.refAddText" class="min-h-11" :data-testid="`ref-add-line-${i}`" @click="addLine(i)" />
        <label class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-elevated px-3 text-label text-default">
          <UIcon name="i-ph-image" class="size-5" aria-hidden="true" />{{ t.refAddImage }}
          <input type="file" accept="image/*" class="sr-only" :data-testid="`ref-file-${i}`" @change="onFile(i, $event)" />
        </label>
      </div>
    </div>
    <p v-if="uploadError" class="text-body text-error" role="alert" data-testid="ref-upload-error">{{ uploadError }}</p>
    <div v-if="!readonly" class="flex flex-wrap gap-2">
      <UButton color="neutral" variant="soft" icon="i-ph-plus" :label="t.refAddPanel" class="min-h-11" data-testid="ref-add-panel" @click="addPanel" />
      <UButton type="submit" icon="i-ph-floppy-disk" :label="t.refSave" class="min-h-11" :loading="busy" :disabled="!valid" data-testid="ref-save" />
    </div>
  </form>
</template>
