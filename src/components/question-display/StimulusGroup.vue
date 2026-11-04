<script setup lang="ts">
/**
 * A stimulus shared by two or more questions, rendered once per group (AC-11.7, AC-11.8, D41).
 *  - from 1024px (`lg`): two columns, the stimulus is a pinned, self-scrolling left pane;
 *  - below 1024px: one column, a sticky chip "Lihat {label}" opens a bottom sheet with the full
 *    stimulus; closing the sheet never touches answers (D-3).
 * `stimuli` (1 to 3, in order) or the older single `stimulus`; the label is the labels joined ("Rajah 1 dan Petikan A").
 * With `groupId` the sheet is open the first time the group appears and keeps the pupil's choice (FR-X6-6).
 * A stimulus that cannot be drawn excludes the whole group (reason line). The questions go in the default slot. Only one tree is rendered at a time (no duplicate ids).
 */
import { computed } from 'vue'

import { DsIconChip, DsStack, DsText } from '@/ds'
import { useMedia } from '@/ds/useMedia'

import { chipLabel, qdCopy } from './copy'
import { canRender, stimuliLabel, unrenderableReason } from './lib/stimulus-data'
import { useStimulusOpen } from './lib/useStimulusOpen'
import NotServedNotice from './NotServedNotice.vue'
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
    /** A group with a stimulus that cannot be drawn shows the reason line instead when this is set (sitting, result, drills); authoring previews leave it off (default). */
    excludeUnrenderable?: boolean
  }>(),
  { stimuli: undefined, stimulus: undefined, groupId: undefined, hint: true, excludeUnrenderable: false },
)
const emit = defineEmits<{
  loaded: [id: string]
  error: [id: string]
  retry: [id: string]
  report: [id: string]
}>()

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
/** One stimulus that cannot be drawn excludes the whole group, never a partial group. */
const blocked = computed(() => (props.excludeUnrenderable ? list.value.find((s) => !canRender(s)) : undefined))
const thumb = computed(() => list.value[0])
const thumbIcon = computed(() => (thumb.value?.kind === 'table' ? 'table' : 'file-text'))
const thumbSrc = computed(() => thumb.value?.src)
const iconOnly = computed(() => thumb.value?.kind === 'passage' || thumb.value?.kind === 'table')
</script>

<template>
  <DsStack v-if="blocked" gap="xs" data-testid="stimulus-group" data-layout="excluded">
    <NotServedNotice :reason="unrenderableReason(blocked)" />
  </DsStack>

  <div
    v-else-if="wide"
    class="grid grid-cols-2 items-start gap-6"
    data-testid="stimulus-group"
    data-layout="split"
  >
    <aside
      class="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col gap-2 self-start overflow-y-auto"
      :aria-label="label"
      data-testid="stimulus-pane"
    >
      <DsText v-if="hint" variant="caption" tone="muted" data-testid="stimulus-hint">{{ qdCopy.pinnedHint }}</DsText>
      <StimulusFigure
        v-for="st in list"
        :key="st.id"
        :stimulus="st"
        :max-height="false"
        @loaded="emit('loaded', st.id)"
        @error="emit('error', st.id)"
        @retry="emit('retry', st.id)"
        @report="emit('report', st.id)"
      />
    </aside>
    <div class="flex min-w-0 flex-col gap-6" data-testid="stimulus-questions"><slot /></div>
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
    v-if="!wide && !blocked"
    v-model:open="open"
    :title="label"
    :description="qdCopy.sheetDescription"
  >
    <template #body>
      <DsStack gap="md" data-testid="group-stimuli" :data-count="list.length">
        <StimulusFigure
          v-for="st in list"
          :key="st.id"
          :stimulus="st"
          @loaded="emit('loaded', st.id)"
          @error="emit('error', st.id)"
          @retry="emit('retry', st.id)"
          @report="emit('report', st.id)"
        />
      </DsStack>
    </template>
  </UDrawer>
</template>
