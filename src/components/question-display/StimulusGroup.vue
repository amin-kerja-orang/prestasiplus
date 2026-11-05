<script setup lang="ts">
/**
 * A stimulus shared by two or more questions, rendered once per group (AC-11.7, AC-11.8, D41).
 *  - from 1024px (`lg`): two columns, the stimulus is a pinned, self-scrolling left pane;
 *  - below 1024px: one column, a sticky chip "Lihat {label}" opens a bottom sheet with the full
 *    stimulus; closing the sheet never touches answers (D-3).
 * `stimuli` (1 to 3, in order) or the older single `stimulus`; the label is the labels joined ("Rajah 1 dan Petikan A").
 * With `groupId` the sheet is open the first time the group appears and keeps the pupil's choice (FR-X6-6).
 * (A stimulus that cannot be drawn is kept out at serving, FR-X1-4.) The questions go in the default slot. Only one tree is rendered at a time (no duplicate ids).
 */
import { computed, nextTick, onBeforeUnmount, provide, ref, useSlots } from 'vue'

import { DsIconChip, DsStack, DsText } from '@/ds'
import { useMedia } from '@/ds/useMedia'

import { chipLabel, qdCopy } from './copy'
import { stimuliLabel } from './lib/stimulus-data'
import { STIMULUS_GROUP_KEY, useStimulusOpen } from './lib/useStimulusOpen'
import StimulusFigure from './StimulusFigure.vue'
import type { StimulusData } from './types'

const props = withDefaults(
  defineProps<{
    /** 1 to 3 stimuli in order (46 section 2.4). */
    stimuli?: readonly StimulusData[]
    /** Single stimulus (PaperQuizPage, StudioPreview): treated as `[stimulus]`. */
    stimulus?: StimulusData
    /** With an id the open state is kept per group for the session (FR-X6-6); without it the `open` model rules. */
    groupId?: string
    hint?: boolean
    /** Wide split: `half` (default, 1:1) or `sitting` (the V3 attempt ratio: stimulus 4 : questions 5). */
    split?: 'half' | 'sitting'
  }>(),
  { stimuli: undefined, stimulus: undefined, groupId: undefined, hint: true, split: 'half' },
)
const emit = defineEmits<{
  loaded: [id: string]
  error: [id: string]
  retry: [id: string]
  report: [id: string]
}>()

/** No questions in the default slot (a question's own stimuli): the figures show inline, full width, at every width. */
const inline = !useSlots().default

const model = defineModel<boolean>('open', { default: false })
const keyed = computed(() => (props.groupId ? useStimulusOpen(props.groupId) : null))
const open = computed({
  get: () => (keyed.value ? keyed.value.value : model.value),
  set: (v: boolean) => {
    if (keyed.value) keyed.value.value = v
    else model.value = v
  },
})

const wide = useMedia('(min-width: 1024px)')
const list = computed<readonly StimulusData[]>(() =>
  props.stimuli && props.stimuli.length > 0 ? props.stimuli : props.stimulus ? [props.stimulus] : [],
)
const label = computed(() => stimuliLabel(list.value))

/** Open one stimulus (or 'all') from a link in a question: the pinned pane scrolls and highlights, the drawer opens and scrolls (FR-PA-37). */
/** The one rendered stimulus container of THIS group (inline stack, pinned pane or drawer body): scroll never looks outside it. */
const scope = ref<unknown>(null)
const lit = ref<string[]>([])
let timer: ReturnType<typeof setTimeout> | undefined
function openStimulus(id: string): void {
  const ids = id === 'all' ? list.value.map((s) => s.id) : list.value.some((s) => s.id === id) ? [id] : []
  if (ids.length === 0) return
  if (!wide.value && !inline) open.value = true
  lit.value = ids
  clearTimeout(timer)
  timer = setTimeout(() => (lit.value = []), 2500)
  const scroll = (): void => {
    const root = scope.value as { $el?: HTMLElement } | HTMLElement | null
    const el = root && '$el' in root ? root.$el : (root as HTMLElement | null)
    el
      ?.querySelector<HTMLElement>(`[data-stimulus-id="${ids[0]}"]`)
      ?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }
  void nextTick(() => (wide.value || inline ? scroll() : void setTimeout(scroll, 50)))
}
onBeforeUnmount(() => clearTimeout(timer))
provide(STIMULUS_GROUP_KEY, { stimuli: () => list.value, open: openStimulus })
defineExpose({ openStimulus })
const isLit = (id: string): 'true' | undefined => (lit.value.includes(id) ? 'true' : undefined)
/** The pinned hint is about a passage; a figure-only group shows none. */
const hasPassage = computed(() => list.value.some((s) => s.kind === 'passage'))
const thumb = computed(() => list.value[0])
const thumbIcon = computed(() => (thumb.value?.kind === 'table' ? 'table' : 'file-text'))
const thumbSrc = computed(() => thumb.value?.src)
const iconOnly = computed(() => thumb.value?.kind === 'passage' || thumb.value?.kind === 'table')
</script>

<template>
  <DsStack v-if="inline" ref="scope" gap="md" data-testid="stimulus-group" data-layout="inline">
    <StimulusFigure
      v-for="st in list"
      :key="st.id"
      :stimulus="st"
      :data-stimulus-id="st.id"
      :data-stimulus-lit="isLit(st.id)"
      @loaded="emit('loaded', st.id)"
      @error="emit('error', st.id)"
      @retry="emit('retry', st.id)"
      @report="emit('report', st.id)"
    />
  </DsStack>

  <div
    v-else-if="wide"
    class="grid items-start gap-6"
    :class="split === 'sitting' ? 'grid-cols-9' : 'grid-cols-2'"
    data-testid="stimulus-group"
    data-layout="split"
  >
    <aside
      class="self-start overflow-y-auto"
      :class="
        split === 'sitting'
          ? 'sticky top-0 col-span-4 max-h-[calc(100dvh-11rem)] pt-2'
          : 'sticky top-20 max-h-[calc(100vh-6rem)]'
      "
      :aria-label="split === 'sitting' ? qdCopy.pinnedAria : label"
      ref="scope"
      data-testid="stimulus-pane"
    >
      <DsStack gap="xs">
        <DsText v-if="hint && hasPassage" variant="caption" tone="muted" data-testid="stimulus-hint">{{ qdCopy.pinnedHint }}</DsText>
        <StimulusFigure
          v-for="st in list"
          :key="st.id"
          :stimulus="st"
          :data-stimulus-id="st.id"
          :data-stimulus-lit="isLit(st.id)"
          :max-height="false"
          @loaded="emit('loaded', st.id)"
          @error="emit('error', st.id)"
          @retry="emit('retry', st.id)"
          @report="emit('report', st.id)"
        />
      </DsStack>
    </aside>
    <div class="min-w-0" :class="split === 'sitting' ? 'col-span-5' : undefined" data-testid="stimulus-questions">
      <DsStack gap="lg"><slot /></DsStack>
    </div>
  </div>

  <div v-else class="flex w-full min-w-0 flex-col gap-4" data-testid="stimulus-group" data-layout="stacked">
    <div class="sticky top-0 z-10 bg-default py-1">
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        class="min-h-11 w-full justify-start gap-3"
        aria-haspopup="dialog"
        data-testid="stimulus-chip"
        @click="open = true"
      >
        <span class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg">
          <img
            v-if="thumbSrc && !iconOnly"
            :src="thumbSrc"
            alt=""
            width="48"
            height="48"
            loading="lazy"
            class="size-12 object-cover"
            data-testid="stimulus-thumb-img"
          />
          <DsIconChip v-else :icon="thumbIcon" tone="neutral" size="lg" data-testid="stimulus-thumb-icon" />
        </span>
        <span class="text-label">{{ chipLabel(label) }}</span>
      </UButton>
    </div>
    <div class="flex min-w-0 flex-col gap-6" data-testid="stimulus-questions"><slot /></div>
  </div>

  <UDrawer
    v-if="!wide && !inline"
    v-model:open="open"
    :title="label"
    :description="qdCopy.sheetDescription"
  >
    <template #body>
      <DsStack ref="scope" gap="md" data-testid="group-stimuli" :data-count="list.length">
        <StimulusFigure
          v-for="st in list"
          :key="st.id"
          :stimulus="st"
          :data-stimulus-id="st.id"
          :data-stimulus-lit="isLit(st.id)"
          @loaded="emit('loaded', st.id)"
          @error="emit('error', st.id)"
          @retry="emit('retry', st.id)"
          @report="emit('report', st.id)"
        />
      </DsStack>
    </template>
  </UDrawer>
</template>
