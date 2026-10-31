<script setup lang="ts">
/**
 * One Simulasi Kuiz item (random and per paper): chips, stimulus, text layers, then the MCQ options
 * with "✓ Semak" and the verdict, or, for an open part, an UNSAVED textarea with a one-line note
 * (D83 D-9). The server marks: the item never carries the key, the verdict arrives as `verdict`.
 * Pure display; the page owns the requests.
 */
import { computed } from 'vue'

import { McqOptions, StimulusFigure } from '../lib/question-display'
import type { BijakKuizCheckResult, BijakKuizItem } from '@pp/contract'

import { kuizCopy, textLayers, toOptions, toStimulus } from '../lib/kuiz'
import RichText from './RichText.vue'

const props = withDefaults(
  defineProps<{
    item: BijakKuizItem
    /** Chip text, e.g. "❓ Soalan 3" (random) or "Soalan 3" (paper). */
    chip: string
    /** The server verdict once checked. */
    verdict?: BijakKuizCheckResult | null
    busy?: boolean
    /** Label of the check button (V2: "✓ Semak Jawapan" random, "✓ Semak" paper). */
    semakLabel?: string
    /** Stimuli pinned once by the page (shared group): not repeated here. */
    hideStimuli?: boolean
    error?: string
  }>(),
  { verdict: null, busy: false, semakLabel: kuizCopy.semak, hideStimuli: false, error: '' },
)
const emit = defineEmits<{ check: [] }>()

const picked = defineModel<string>('picked')
const written = defineModel<string>('written', { default: '' })

const options = computed(() => toOptions(props.item))
const layers = computed(() => textLayers(props.item))
const stimuli = computed(() =>
  props.item.stimuli.map((s, i) => toStimulus(s, `${props.item.id}-s${i}`)),
)
const isMcq = computed(() => props.item.kind === 'mcq' && props.item.options.length > 0)
const writtenId = computed(() => `kuiz-written-${props.item.id.replace(/[^A-Za-z0-9_-]/g, '_')}`)
</script>

<template>
  <UCard :data-testid="`kuiz-item-${item.id}`">
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge color="primary" variant="subtle" data-testid="kuiz-chip">{{ chip }}</UBadge>
        <UBadge v-if="item.subjectName" color="neutral" variant="subtle">{{
          item.subjectName
        }}</UBadge>
        <UBadge v-if="item.marks" color="neutral" variant="outline">{{ item.marks }} markah</UBadge>
      </div>

      <template v-if="!hideStimuli">
        <StimulusFigure v-for="s in stimuli" :key="s.id" :stimulus="s" />
      </template>

      <div class="flex flex-col gap-2 text-body text-default">
        <p
          v-for="(l, i) in layers"
          :key="i"
          :class="l.strong ? 'font-semibold text-highlighted' : ''"
          class="whitespace-pre-line"
        >
          <RichText :text="l.text" />
        </p>
      </div>

      <template v-if="isMcq">
        <McqOptions
          v-model="picked"
          :options="options"
          :reveal="!!verdict"
          :correct-id="verdict?.correctOptionId"
          :disabled="busy"
        />

        <p v-if="!item.markable" class="text-caption text-muted" data-testid="kuiz-noscheme">
          {{ kuizCopy.noScheme }}
        </p>

        <div v-if="verdict" class="flex flex-col gap-1" role="status" data-testid="kuiz-verdict">
          <p
            class="text-subheading font-bold"
            :class="verdict.correct ? 'text-success' : 'text-error'"
            :data-correct="verdict.correct"
          >
            {{ verdict.correct ? kuizCopy.correct : kuizCopy.wrong }}
          </p>
          <p v-if="verdict.explanation" class="text-body text-toned" data-testid="kuiz-explanation">
            <RichText :text="verdict.explanation" />
          </p>
        </div>

        <UAlert v-if="error" color="error" variant="soft" :title="error" role="alert" />

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <UButton
            v-if="!verdict && item.markable"
            color="success"
            class="min-h-11 w-full justify-center sm:w-auto"
            :disabled="!picked"
            :loading="busy"
            data-testid="kuiz-semak"
            @click="emit('check')"
            >{{ semakLabel }}</UButton
          >
          <slot name="actions" />
        </div>
      </template>

      <template v-else>
        <div class="flex flex-col gap-1">
          <label :for="writtenId" class="sr-only">{{ kuizCopy.written }}</label>
          <UTextarea
            :id="writtenId"
            v-model="written"
            :rows="3"
            :placeholder="kuizCopy.written"
            class="w-full"
            data-testid="kuiz-written"
          />
          <p class="text-caption text-muted" data-testid="kuiz-written-note">
            {{ kuizCopy.writtenNote }}
          </p>
        </div>
      </template>
    </div>
  </UCard>
</template>
