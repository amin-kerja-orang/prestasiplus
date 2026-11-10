<script setup lang="ts">
/**
 * One node of a structured question: label + prompt, then either the answer controls (leaf) or its children.
 * A prompt that cites a stimulus of its group ("Bahan 2", "semua bahan") shows the citation as a button that opens
 * it in the group (FR-PA-37, AC-PA-39). A leaf with `stimulusId` shows that stimulus between prompt and answer:
 * collapsed behind "Lihat {label}" below 768, inline from 768.
 */
import { computed, ref } from 'vue'

import { DsSurface } from '@/ds'

import { isStemRow } from '@pp/exam-core/paper-model'
import type { McqOption, PartAnswer, PartView } from '@/modules/m28-bijak-spm/domain/types'
import { chipLabel } from './copy'
import { citeSegments } from './lib/rich-text'
import { useStimulusGroup } from './lib/useStimulusOpen'
import PartInput from './PartInput.vue'
import RichText from './RichText.vue'
import StimulusFigure from './StimulusFigure.vue'
import { useQuestionLang } from './lib/question-lang'
import type { GridSpec, PadTemplate } from './lib/drawing'
import type { LeafModeExtras, PartTwins, StimulusData } from './types'

defineOptions({ name: 'PartNode' })

const props = defineProps<{
  part: PartView
  answers: Record<string, PartAnswer>
  attemptId: string
  disabled?: boolean
  /** Latihan: leaf parts locked one by one after the "Semak" cap; the others stay open. */
  lockedPartIds?: readonly string[]
  depth?: number
  optionBank?: McqOption[]
  /** Lookup (by id) for a leaf's `stimulusId`: the group's and the question's own stimuli. */
  stimuli?: readonly StimulusData[]
}>()
const stem = computed(() => isStemRow(props.part))
const group = useStimulusGroup()
/** Plain text when nothing matches the group's own labels. */
const segments = computed(() => citeSegments(props.part.prompt, group?.stimuli() ?? []))
const leafStimulus = computed(() =>
  !props.part.children?.length && props.part.stimulusId
    ? props.stimuli?.find((s) => s.id === props.part.stimulusId)
    : undefined,
)
/** Optional modeConfig fields (contract PR #679) that PartView does not type yet. */
type RawTemplate = PadTemplate | { imageId: string } | { grid: GridSpec }
const extras = computed(
  () =>
    props.part.answer as
      (Omit<LeafModeExtras, 'answerTemplate'> & { answerTemplate?: RawTemplate }) | undefined,
)
/** The contract's `{imageId}` becomes the file URL (same builder as `imageSrc` in lib/rich-text); a grid passes as is. */
const padTemplate = computed<PadTemplate | undefined>(() => {
  const t = extras.value?.answerTemplate
  if (!t) return undefined
  return 'imageId' in t ? { imageUrl: `/api/files/${t.imageId}` } : t
})
const promptEn = computed(() => (props.part as PartTwins & typeof props.part).promptEn)
const { lang } = useQuestionLang()
const showMs = computed(() => !promptEn.value || lang.value !== 'en')
const showEn = computed(() => !!promptEn.value && lang.value !== 'ms')
const shown = ref(false)
/** Already in the group's pinned panel: the leaf only links to it, it never draws it twice. */
const inPanel = computed(
  () => !!leafStimulus.value && !!group?.stimuli().some((s) => s.id === leafStimulus.value!.id),
)
const emit = defineEmits<{ answer: [partId: string, answer: PartAnswer] }>()
</script>

<template>
  <div
    class="flex flex-col gap-3"
    :class="(depth ?? 0) > 0 ? 'ps-3' : ''"
    :data-testid="`part-${part.id}`"
  >
    <p class="flex flex-wrap items-baseline gap-x-2 text-body text-highlighted">
      <span v-if="part.label" class="font-bold">{{ part.label }}</span>
      <template v-for="(seg, i) in showMs ? segments : []" :key="i">
        <UButton
          v-if="seg.kind === 'cite'"
          type="button"
          variant="link"
          color="primary"
          size="md"
          data-testid="cite-link"
          :data-cite="seg.target"
          @click="group?.open(seg.target)"
          >{{ seg.text }}</UButton
        >
        <RichText v-else :text="seg.text" />
      </template>
      <DsSurface
        v-if="showMs && showEn"
        level="accented"
        padding="none"
        radius="none"
        class="h-px w-full"
        aria-hidden="true"
        data-testid="lang-divider"
      />
      <RichText v-if="showEn" :text="promptEn as string" data-testid="lang-en-block" />
      <span v-if="!part.children?.length && !stem" class="tabular text-caption text-muted"
        >[{{ part.marks }} markah]</span
      >
    </p>
    <template v-if="part.children?.length">
      <PartNode
        v-for="c in part.children"
        :key="c.id"
        :part="c"
        :answers="answers"
        :attempt-id="attemptId"
        :disabled="disabled"
        :locked-part-ids="lockedPartIds"
        :depth="(depth ?? 0) + 1"
        :option-bank="optionBank"
        :stimuli="stimuli"
        @answer="(id, a) => emit('answer', id, a)"
      />
    </template>
    <UButton
      v-if="leafStimulus && inPanel"
      type="button"
      color="neutral"
      variant="soft"
      block
      size="md"
      data-testid="leaf-stimulus-link"
      @click="group?.open(leafStimulus.id)"
      >{{ chipLabel(leafStimulus.label ?? leafStimulus.id) }}</UButton
    >
    <template v-else-if="leafStimulus">
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        block
        size="md"
        data-leaf-toggle
        :aria-expanded="shown"
        :aria-controls="`leaf-stim-${part.id}`"
        data-testid="leaf-stimulus-toggle"
        @click="shown = !shown"
        >{{ chipLabel(leafStimulus.label ?? leafStimulus.id) }}</UButton
      >
      <div :id="`leaf-stim-${part.id}`" :data-leaf-stim="shown ? 'open' : 'closed'">
        <StimulusFigure :stimulus="leafStimulus" data-testid="leaf-stimulus" />
      </div>
    </template>
    <PartInput
      v-if="!part.children?.length && !stem"
      :leaf="{
        id: part.id,
        label: part.label,
        prompt: part.prompt,
        marks: part.marks,
        kind: part.answer?.kind ?? 'short_text',
        unit: part.answer?.unit,
        wordRange: part.answer?.wordRange,
        maxWords: extras?.maxWords,
        hardLimit: extras?.hardLimit,
        preFill: extras?.preFill,
        answerTemplate: padTemplate,
        depth: depth ?? 0,
      }"
      :model-value="answers[part.id]"
      :attempt-id="attemptId"
      :disabled="disabled || lockedPartIds?.includes(part.id)"
      :option-bank="optionBank"
      @update:model-value="emit('answer', part.id, $event)"
    />
  </div>
</template>
