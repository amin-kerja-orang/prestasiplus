<script setup lang="ts">
/**
 * Textarea with the authoring toolbar (PRD45 3.1.5, FR-QA-18): the text stays a plain string, the buttons insert markup
 * at the caret or around the selection (pure transforms in `lib/studio/rich-text.ts`). `testid` is on the textarea; the
 * buttons are `${testid}-tb-<id>`. `√x` / `√x blok` open the dialog `Matematik dalam baris (LaTeX)`; `Imej` uploads a
 * picture through the files module and inserts `{{img:<token>}}`.
 */
import { nextTick, ref } from 'vue'

import { isApiError } from '@/api'
import { DsCluster, DsDialog, DsFileField, DsFormField, DsStack, DsText } from '@/ds'

import { uploadStudioImage } from '../../api/studio'
import {
  applyAction,
  emptyHistory,
  imageProblem,
  insertImage,
  insertMath,
  MATH_MAX_LENGTH,
  pushHistory,
  redo,
  TOOLBAR,
  undo,
  type History,
  type TextState,
} from '../../lib/studio/rich-text'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ testid: string; id?: string; rows?: number; placeholder?: string; disabled?: boolean }>(), {
  id: undefined,
  rows: 4,
  placeholder: undefined,
  disabled: false,
})
const model = defineModel<string>({ required: true })

const area = ref<{ textareaRef?: HTMLTextAreaElement | null } | null>(null)
const picked = ref<File | null>(null)
const history = ref<History>(emptyHistory())
const mathOpen = ref(false)
const mathBlock = ref(false)
const latex = ref('')
const mathError = ref('')
const imageBusy = ref(false)
const imageError = ref('')
/** The selection when a dialog or the file picker opened (the textarea loses focus meanwhile). */
let saved: TextState = { value: '', start: 0, end: 0 }

function el(): HTMLTextAreaElement | null {
  return area.value?.textareaRef ?? document.getElementById(props.id ?? props.testid) as HTMLTextAreaElement | null
}
function current(): TextState {
  const t = el()
  const value = model.value
  return t ? { value, start: t.selectionStart, end: t.selectionEnd } : { value, start: value.length, end: value.length }
}
async function commit(next: TextState): Promise<void> {
  history.value = pushHistory(history.value, current())
  model.value = next.value
  await nextTick()
  const t = el()
  if (t) {
    t.focus()
    t.setSelectionRange(next.start, next.end)
  }
}
function run(kind: string, action?: Parameters<typeof applyAction>[0]): void {
  if (props.disabled) return
  if (kind === 'action' && action) {
    void commit(applyAction(action, current()))
  } else if (kind === 'math' || kind === 'mathBlock') {
    saved = current()
    mathBlock.value = kind === 'mathBlock'
    latex.value = saved.value.slice(saved.start, saved.end)
    mathError.value = ''
    mathOpen.value = true
  } else if (kind === 'undo' || kind === 'redo') {
    const r = (kind === 'undo' ? undo : redo)(history.value, current())
    if (r) {
      history.value = r.history
      model.value = r.state.value
      void nextTick(() => {
        el()?.focus()
        el()?.setSelectionRange(r.state.start, r.state.end)
      })
    }
  }
}

function insertFormula(): void {
  const r = insertMath(saved, latex.value, mathBlock.value)
  if (r.error !== null) {
    mathError.value = r.error
    return
  }
  mathOpen.value = false
  void commit(r.state)
}

async function onPick(next: File | File[] | null): Promise<void> {
  const file = Array.isArray(next) ? (next[0] ?? null) : next
  picked.value = null
  imageError.value = ''
  if (file === null) return
  const problem = imageProblem(file)
  if (problem !== null) {
    imageError.value = problem
    return
  }
  imageBusy.value = true
  imageError.value = ''
  try {
    const token = await uploadStudioImage(file, `${props.testid}-image`)
    await commit(insertImage({ ...saved, value: model.value }, token))
  } catch (err) {
    imageError.value = isApiError(err) ? (err.fields?.[`${props.testid}-image`] ?? err.message) : 'Gambar gagal dimuat naik.'
  } finally {
    imageBusy.value = false
  }
}
/** Typing: the value before the change is an undo step. */
function onModel(v: string | undefined): void {
  const before = model.value
  history.value = pushHistory(history.value, { value: before, start: before.length, end: before.length })
  model.value = v ?? ''
}
</script>

<template>
  <DsStack gap="sm" :data-testid="`${testid}-field`">
    <DsCluster gap="sm" role="toolbar" aria-label="Alat penulisan" :data-testid="`${testid}-toolbar`">
      <template v-for="b in TOOLBAR" :key="b.id">
        <!-- Imej: the same picker as StudioImageField; the trigger is a named button so the toolbar stays uniform. -->
        <DsFileField
          v-if="b.kind === 'image'"
          :model-value="picked"
          accept="image/jpeg,image/png,image/webp"
          preview="none"
          variant="button"
          :label="b.title"
          :disabled="disabled || imageBusy"
          :data-testid="`${testid}-image-input`"
          @update:model-value="onPick"
        >
          <template #default="{ open }">
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              :label="b.label"
              :title="b.title"
              :aria-label="b.title"
              :disabled="disabled || imageBusy"
              :data-testid="`${testid}-tb-${b.id}`"
              @mousedown.prevent
              @click="saved = current(); open()"
            />
          </template>
        </DsFileField>
        <UButton
          v-else
          type="button"
          color="neutral"
          variant="soft"
          :title="b.title"
          :aria-label="b.title"
          :disabled="disabled"
          :data-testid="`${testid}-tb-${b.id}`"
          @mousedown.prevent
          @click="run(b.kind, b.action)"
        >
          {{ b.label }}
        </UButton>
      </template>
    </DsCluster>
    <UTextarea
      :id="id"
      ref="area"
      :model-value="model"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :data-testid="testid"
      @update:model-value="onModel"
    />
    <DsText v-if="imageBusy" variant="caption" tone="muted" :data-testid="`${testid}-image-busy`">Memuat naik…</DsText>
    <DsText v-if="imageError" variant="caption" tone="error" role="alert" :data-testid="`${testid}-image-error`">{{ imageError }}</DsText>

    <DsDialog v-model:open="mathOpen" title="Matematik dalam baris (LaTeX)" size="sm" :data-testid="`${testid}-math`">
      <DsFormField v-slot="{ id: fid }" native label="Formula (LaTeX)" :for="`${testid}-math-input`" :error="mathError">
        <UInput :id="fid" v-model="latex" :maxlength="MATH_MAX_LENGTH" placeholder="x^2 + 1" :data-testid="`${testid}-math-input`" @keydown.enter.prevent="insertFormula" />
      </DsFormField>
      <template #footer>
        <DsCluster gap="sm">
          <UButton type="button" color="primary" :data-testid="`${testid}-math-insert`" @click="insertFormula">Sisip</UButton>
          <UButton type="button" color="neutral" variant="soft" :data-testid="`${testid}-math-cancel`" @click="mathOpen = false">Batal</UButton>
        </DsCluster>
      </template>
    </DsDialog>
  </DsStack>
</template>
