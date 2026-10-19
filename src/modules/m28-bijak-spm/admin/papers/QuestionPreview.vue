<script setup lang="ts">
/**
 * Read-only render of reviewed questions: the shared stimulus once at the top, then each question
 * with its stem, options or parts and the mark scheme. Used by the review workspace and the bank
 * preview drawer.
 */
import { DsPanel } from '@/ds'

import RichText from '../../components/RichText.vue'
import StimulusView from '../../components/StimulusView.vue'
import type { ReviewQuestion } from '../../domain/admin-types'
import type { McqOption, PartDef, StimulusDef } from '../../domain/types'

withDefaults(
  defineProps<{
    questions: ReviewQuestion[]
    stimulus?: StimulusDef
    optionBank?: McqOption[]
    /** Student view: no scheme. */
    hideScheme?: boolean
    /** Number of the first question. */
    start?: number
  }>(),
  { stimulus: undefined, optionBank: undefined, hideScheme: false, start: 1 },
)

const LETTERS = 'ABCDEFGH'

function flat(parts: PartDef[], depth = 0): { part: PartDef; depth: number }[] {
  return parts.flatMap((p) => [{ part: p, depth }, ...flat(p.children ?? [], depth + 1)])
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="question-preview">
    <DsPanel v-if="stimulus" data-testid="preview-stimulus">
      <p class="mb-2 text-caption font-semibold text-muted">
        {{
          questions.length > 1
            ? `Rangsangan dikongsi oleh ${questions.length} soalan (dipaparkan sekali)`
            : 'Rangsangan soalan ini'
        }}
      </p>
      <StimulusView :stimulus="stimulus" />
    </DsPanel>
    <DsPanel v-if="optionBank?.length" data-testid="preview-option-bank">
      <ul class="flex flex-col gap-1 text-body">
        <li v-for="(o, i) in optionBank" :key="o.id">
          <span class="font-semibold">{{ LETTERS[i] }}.</span> <RichText :text="o.text" />
        </li>
      </ul>
    </DsPanel>

    <DsPanel v-for="(q, qi) in questions" :key="q.id" :data-testid="`preview-q-${q.id}`">
      <div class="flex flex-col gap-3">
        <div class="flex items-baseline justify-between gap-3">
          <h3 class="text-subheading text-highlighted">Soalan {{ start + qi }}</h3>
          <span class="tabular text-caption text-muted">[{{ q.marks }} markah]</span>
        </div>
        <p class="text-body text-default"><RichText :text="q.stem" /></p>

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

        <ul v-else-if="q.parts" class="flex flex-col gap-2">
          <li v-for="{ part, depth } in flat(q.parts)" :key="part.id" class="flex flex-col gap-1">
            <p class="text-body" :class="depth ? 'ps-6' : ''">
              <span class="font-semibold">{{ part.label }}</span
              >{{ ' ' }}
              <RichText :text="part.prompt" />
              <span v-if="part.marks" class="tabular text-caption text-muted">
                [{{ part.marks }}]</span
              >
            </p>
            <div
              v-if="!hideScheme && part.marks"
              class="rounded-lg bg-muted p-3"
              :class="depth ? 'ms-6' : ''"
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
          </li>
        </ul>

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
      </div>
    </DsPanel>
  </div>
</template>
