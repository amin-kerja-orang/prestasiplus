<script setup lang="ts">
/**
 * "Bab" select of S2 / S4 (R1, D89): the chapter of the question, for Soalan by Chapter. Optional ("-"
 * posts nothing and clears a saved chapter). The list loads when Subjek and Tahap are both set and is
 * reloaded, with the choice cleared, when either changes afterwards (a chapter belongs to one subject
 * and level). S4 keeps the saved chapter while the first list loads; a saved chapter missing from its
 * list (for example inactive) stays selectable under its saved label.
 */
import { ref, watch } from 'vue'

import { DsFormField, DsNativeSelect } from '@/ds'

import { fetchChapters, type ChapterOption } from '../api/lookups'
import { LOAD_ERROR } from '../lib/ui-errors'

const props = defineProps<{
  subjectId: string
  levelId: string
  /** S4: label of the saved chapter, shown when the list does not contain it. */
  savedLabel?: string | null
  error?: string | undefined
}>()

/** The chosen chapter id as text (`''` = none); posted as `curriculumChapterId`. */
const chapterId = defineModel<string>({ required: true })

const chapters = ref<ChapterOption[]>([])
const failed = ref(false)
let seq = 0

async function load(): Promise<void> {
  const token = ++seq
  failed.value = false
  if (props.subjectId === '' || props.levelId === '') {
    chapters.value = []
    return
  }
  try {
    const list = await fetchChapters({ subjectId: props.subjectId, educationLevelId: props.levelId })
    if (token === seq) chapters.value = list
  } catch {
    if (token === seq) {
      chapters.value = []
      failed.value = true
    }
  }
}

// First load keeps the saved choice; later changes of the pair clear it.
void load()
watch(
  () => [props.subjectId, props.levelId] as const,
  () => {
    chapterId.value = ''
    void load()
  },
)

const label = (c: ChapterOption): string =>
  c.chapterNumber === null ? c.name : `Bab ${String(c.chapterNumber)}: ${c.name}`
const savedMissing = (): boolean =>
  chapterId.value !== '' && !chapters.value.some((c) => String(c.id) === chapterId.value)
</script>

<template>
  <DsFormField
    v-slot="{ id, describedby, invalid }"
    native
    for="q-chapter"
    label="Bab"
    :error="error ?? (failed ? LOAD_ERROR : undefined)"
  >
    <DsNativeSelect
      :id="id"
      v-model="chapterId"
      name="curriculum_chapter_id"
      :disabled="subjectId === '' || levelId === ''"
      :invalid="invalid"
      :aria-describedby="describedby"
      data-testid="q-chapter"
    >
      <option value="">—</option>
      <option v-if="savedMissing()" :value="chapterId">{{ savedLabel ?? chapterId }}</option>
      <option v-for="c in chapters" :key="c.id" :value="String(c.id)">{{ label(c) }}</option>
    </DsNativeSelect>
  </DsFormField>
</template>
