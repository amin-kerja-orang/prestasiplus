<script setup lang="ts">
/**
 * One paper, rendered the same for the cover, result and admin previews (S8-T05, FR-X6-10, FR-QA-48/49).
 * Sections > questions (stimulus once per group) > parts tree. Scheme content (the `#part-extra` default)
 * is rendered only when `reveal` is true. Rotation keeps place: the top-most visible question
 * (`data-paper-q`) is remembered and scrolled back to the same offset after a debounced resize.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { DsCluster, DsHeading, DsStack, DsText } from '@/ds'

import { deductionLine, marksLabel, maksLabel, questionLabel, sectionMeta } from './copy'
import RichText from './RichText.vue'
import StimulusGroup from './StimulusGroup.vue'
import type { PaperPart, PaperQuestion, PaperSection } from './types'

const props = withDefaults(
  defineProps<{
    sections: PaperSection[]
    reveal?: boolean
    /** Scroll container used for rotation anchoring; the window when absent. */
    scrollContainer?: HTMLElement | null
  }>(),
  { reveal: false, scrollContainer: null },
)

interface Block {
  key: string
  groupId?: string
  stimuli?: PaperQuestion['stimuli']
  questions: PaperQuestion[]
}
/** Consecutive questions with the same groupId share one block (one stimulus panel). */
function toBlocks(s: PaperSection): Block[] {
  const out: Block[] = []
  for (const q of s.questions) {
    const last = out[out.length - 1]
    if (q.groupId && last && last.groupId === q.groupId) last.questions.push(q)
    else out.push({ key: q.id, groupId: q.groupId, stimuli: q.stimuli, questions: [q] })
  }
  return out
}
const sectionBlocks = computed(() => props.sections.map((s) => ({ s, blocks: toBlocks(s) })))
const grouped = (b: Block) => Boolean(b.groupId && b.stimuli?.length)

/** Depth indent is one 12px spacer (a layout hook) per level, the same step as PartNode's indent. */
function flat(parts: PaperPart[], depth = 0): { part: PaperPart; depth: number }[] {
  return parts.flatMap((p) => [{ part: p, depth }, ...flat(p.children ?? [], depth + 1)])
}
const Q_ATTR = 'data-paper-q'
const isLeaf = (p: PaperPart) => !p.children?.length

/* Rotation keeps place (FR-X6-10): in-memory only, no storage. */
const root = ref<HTMLElement | null>(null)
let anchor: { el: Element; offset: number } | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let scrollTimer: ReturnType<typeof setTimeout> | undefined
let bound: EventTarget | null = null
const top = () => (props.scrollContainer ? props.scrollContainer.getBoundingClientRect().top : 0)

function record() {
  const els = root.value?.querySelectorAll('[' + Q_ATTR + ']') ?? []
  const base = top()
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.bottom > base) {
      anchor = { el, offset: r.top - base }
      return
    }
  }
}
function restore() {
  if (!anchor || !anchor.el.isConnected) return
  const delta = anchor.el.getBoundingClientRect().top - top() - anchor.offset
  if (!delta) return
  if (props.scrollContainer) props.scrollContainer.scrollTo({ top: props.scrollContainer.scrollTop + delta })
  else window.scrollTo({ top: window.scrollY + delta })
}
/** True from the first resize event until the restore has run and its own scroll event has passed. */
let restoring = false
let settleTimer: ReturnType<typeof setTimeout> | undefined
function runRestore() {
  restore()
  clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    restoring = false
  }, 100)
}
function onResize() {
  if (!restoring) {
    // First event of the burst: a pending debounced scroll means the anchor is stale (and would be
    // recorded post-layout later), so cancel it and record now. A fresh anchor is kept as is.
    if (scrollTimer !== undefined || !anchor) {
      clearTimeout(scrollTimer)
      scrollTimer = undefined
      record()
    }
    restoring = true
  }
  clearTimeout(timer)
  timer = setTimeout(runRestore, 150)
}
function onScroll() {
  if (restoring) return
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    scrollTimer = undefined
    record()
  }, 100)
}
onMounted(() => {
  record()
  bound = props.scrollContainer ?? window
  bound.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onResize)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  clearTimeout(scrollTimer)
  clearTimeout(settleTimer)
  bound?.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('orientationchange', onResize)
})
defineExpose({ record, restore })
</script>

<template>
  <div ref="root" class="min-w-0" data-testid="paper-view">
    <DsStack gap="xl">
      <DsStack
        v-for="{ s, blocks } in sectionBlocks"
        :key="s.id"
        as="section"
        gap="md"
        :data-testid="`paper-section-${s.id}`"
      >
        <slot name="section-head" :section="s">
          <DsStack as="header" gap="2xs">
            <DsText variant="body" class="min-w-0 overflow-x-auto" data-testid="paper-section-line"
              ><strong>{{ s.label }}</strong
              >{{ sectionMeta(s.marks, s.questions.length, s.instruction, s.compulsory) }}</DsText
            >
          </DsStack>
        </slot>

        <component
          :is="grouped(b) ? StimulusGroup : DsStack"
          v-for="b in blocks"
          :key="b.key"
          v-bind="grouped(b) ? { stimuli: b.stimuli, groupId: b.groupId } : { gap: 'lg' }"
        >
          <DsStack
            v-for="q in b.questions"
            :key="q.id"
            as="article"
            gap="sm"
            :data-paper-q="q.id"
            :data-testid="`paper-q-${q.id}`"
          >
            <slot name="question-head" :question="q" :section="s">
              <DsCluster justify="between" align="baseline" :wrap="false">
                <DsHeading :level="3" variant="subheading">{{ questionLabel(q.number) }}</DsHeading>
                <DsText as="span" variant="caption" tone="muted" tabular>{{ marksLabel(q.marks) }}</DsText>
              </DsCluster>
            </slot>
            <DsText as="div" variant="body" class="min-w-0 overflow-x-auto" data-testid="paper-stem">
              <RichText :text="q.stem" />
            </DsText>
            <DsStack v-if="q.options?.length" as="ol" gap="xs">
              <DsText v-for="o in q.options" :key="o.id" as="li" variant="body" class="min-w-0 overflow-x-auto">
                <strong>{{ o.letter }}.</strong> <RichText :text="o.text" />
              </DsText>
            </DsStack>
            <DsStack v-if="q.parts?.length" as="ul" gap="sm">
              <li
                v-for="{ part, depth } in flat(q.parts)"
                :key="part.id"
                class="min-w-0"
                :data-depth="depth"
                :data-testid="`paper-part-${part.id}`"
              >
                <DsCluster :wrap="false" align="stretch" gap="none">
                  <span
                    v-for="n in depth"
                    :key="n"
                    class="w-3 shrink-0"
                    aria-hidden="true"
                    data-testid="paper-indent"
                  />
                  <DsStack gap="2xs" class="grow">
                    <slot name="part" :part="part" :depth="depth" :reveal="reveal">
                      <DsCluster align="baseline" gap="xs">
                        <DsText v-if="part.label" as="span" variant="body-strong">{{ part.label }}</DsText>
                        <DsText as="span" variant="body" class="min-w-0 overflow-x-auto"
                          ><RichText :text="part.prompt"
                        /></DsText>
                        <DsText v-if="isLeaf(part)" as="span" variant="caption" tone="muted" tabular
                          >{{ marksLabel(part.marks) }}</DsText
                        >
                      </DsCluster>
                    </slot>
                    <slot name="part-extra" :part="part" :depth="depth" :reveal="reveal">
                      <template v-if="reveal">
                        <DsText
                          v-if="typeof part.maxCap === 'number'"
                          variant="caption"
                          tone="muted"
                          tabular
                          data-testid="paper-cap"
                          >{{ maksLabel(part.maxCap) }}</DsText
                        >
                        <DsText
                          v-for="(d, i) in part.deductions ?? []"
                          :key="i"
                          variant="caption"
                          tone="muted"
                          tabular
                          data-testid="paper-deduction"
                          >{{ deductionLine(d.label, d.n, d.amount, d.cap) }}</DsText
                        >
                      </template>
                    </slot>
                  </DsStack>
                </DsCluster>
              </li>
            </DsStack>
            <slot name="question-foot" :question="q" :section="s" />
          </DsStack>
        </component>
      </DsStack>
    </DsStack>
  </div>
</template>
