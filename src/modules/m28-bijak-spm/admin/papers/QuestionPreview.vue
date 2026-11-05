<script setup lang="ts">
/**
 * Read-only render of reviewed questions: the shared stimulus once at the top, then each question
 * with its stem, options or parts and the mark scheme. Used by the review workspace and the bank
 * preview drawer. Each question is a one-question shared PaperView (S8-T05); the MCQ options and
 * the scheme lines stay this surface's own markup, in the PaperView slots.
 */
import { computed } from 'vue'

import { DsPanel } from '@/ds'

import { PaperView, RichText, StimulusView } from '../../../../components/question-display'
import { marksLabel, questionLabel } from '../../../../components/question-display/copy'
import type { PaperPart, PaperSection } from '../../../../components/question-display/types'
import type { ReviewQuestion } from '../../domain/admin-types'
import type { McqOption, PartDef, StimulusDef } from '../../domain/types'

const props = withDefaults(
  defineProps<{
    questions: ReviewQuestion[]
    stimulus?: StimulusDef
    /** Every stimulus of the group, up to 3, shown once above its questions (D90). */
    stimuli?: StimulusDef[]
    optionBank?: McqOption[]
    /** Student view: no scheme. */
    hideScheme?: boolean
    /** Number of the first question. */
    start?: number
  }>(),
  { stimulus: undefined, stimuli: undefined, optionBank: undefined, hideScheme: false, start: 1 },
)

const LETTERS = 'ABCDEFGH'

/** `stimuli` when given (0 to 3), else the lone `stimulus`. */
const shown = computed(() => (props.stimuli ?? (props.stimulus ? [props.stimulus] : [])).slice(0, 3))

function paperPart(p: PartDef): PaperPart {
  return { id: p.id, label: p.label, prompt: p.prompt, marks: p.marks, children: p.children?.map(paperPart) }
}
/** One-question PaperView section (an MCQ shows options, not parts). */
function paperSection(q: ReviewQuestion, qi: number): PaperSection {
  const parts = !q.mcq && q.parts ? q.parts.map(paperPart) : undefined
  return {
    id: q.id,
    label: '',
    questions: [{ id: q.id, number: props.start + qi, marks: q.marks, stem: q.stem, parts }],
  }
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="question-preview">
    <DsPanel v-if="shown.length" data-testid="preview-stimulus">
      <p class="mb-2 text-caption font-semibold text-muted">
        {{
          questions.length > 1
            ? `Rangsangan dikongsi oleh ${questions.length} soalan (dipaparkan sekali)`
            : 'Rangsangan soalan ini'
        }}
      </p>
      <StimulusView v-for="st in shown" :key="st.id" :stimulus="st" class="mb-3 last:mb-0" />
    </DsPanel>
    <DsPanel v-if="optionBank?.length" data-testid="preview-option-bank">
      <ul class="flex flex-col gap-1 text-body">
        <li v-for="(o, i) in optionBank" :key="o.id">
          <span class="font-semibold">{{ LETTERS[i] }}.</span> <RichText :text="o.text" />
        </li>
      </ul>
    </DsPanel>

    <DsPanel v-for="(q, qi) in questions" :key="q.id" :data-testid="`preview-q-${q.id}`">
      <PaperView :sections="[paperSection(q, qi)]" :section-head="false" indent-step="md" :reveal="!hideScheme">
        <template #question-head="{ question }">
          <div class="flex items-baseline justify-between gap-3">
            <h3 class="text-subheading text-highlighted">{{ questionLabel(question.number) }}</h3>
            <span class="tabular text-caption text-muted">{{ marksLabel(question.marks) }}</span>
          </div>
        </template>
        <template #part="{ part }">
          <p class="text-body">
            <span class="font-semibold">{{ part.label }}</span
            >{{ ' ' }}
            <RichText :text="part.prompt" />
            <span v-if="part.marks" class="tabular text-caption text-muted"> [{{ part.marks }}]</span>
          </p>
        </template>
        <template #part-extra="{ part, reveal }">
          <div
            v-if="reveal && part.marks"
            class="rounded-lg bg-muted p-3"
            :data-testid="`scheme-${part.id}`"
          >
            <p v-if="!q.scheme[part.id]" class="text-caption font-semibold text-error">
              Skema markah belum ada
            </p>
            <ul v-else class="flex flex-col gap-1 text-caption text-default">
              <li v-for="(l, i) in q.scheme[part.id]!.lines" :key="i">
                <span v-if="l.tag" class="me-1 font-semibold text-primary">{{ l.tag }}</span>
                <RichText :text="l.text" />
                <span v-if="l.marks" class="text-muted"> ({{ l.marks }})</span>
              </li>
            </ul>
          </div>
        </template>
        <template #question-foot>
          <ol v-if="q.mcq" class="flex flex-col gap-2">
            <li
              v-for="(o, i) in q.mcq.options"
              :key="o.id"
              class="flex gap-2 rounded-lg bg-muted p-3 text-body"
              :class="!hideScheme && q.mcq.correct === o.id ? 'ring-2 ring-success' : ''"
              :data-correct="!hideScheme && q.mcq.correct === o.id ? 'true' : undefined"
            >
              <span class="font-semibold">{{ LETTERS[i] }}.</span>
              <span><RichText :text="o.text" /></span>
            </li>
          </ol>
          <div
            v-if="!hideScheme && q.mcq"
            class="rounded-lg bg-muted p-3"
            :data-testid="`scheme-${q.id}`"
          >
            <p v-if="!q.scheme[q.id]" class="text-caption font-semibold text-error">
              Skema jawapan belum ada
            </p>
            <ul v-else class="flex flex-col gap-1 text-caption text-default">
              <li v-for="(l, i) in q.scheme[q.id]!.lines" :key="i"><RichText :text="l.text" /></li>
            </ul>
          </div>
        </template>
      </PaperView>
    </DsPanel>
  </div>
</template>
