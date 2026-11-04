<script setup lang="ts">
/**
 * One paper, rendered the same for the cover, result and admin previews (S8-T05, FR-X6-10, FR-QA-48/49).
 * Sections > questions (stimulus once per group) > parts tree. Scheme content (the `#part-extra` default)
 * is rendered only when `reveal` is true. Rotation keeps place: the top-most visible question
 * (`data-paper-q`) is remembered and scrolled back to the same offset after a debounced resize.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { deductionLine, maksLabel } from './copy'
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

/** Depth indent is `ps-3` per level (PartNode style), as literal classes in the template. */
function flat(parts: PaperPart[], depth = 0): { part: PaperPart; depth: number }[] {
  return parts.flatMap((p) => [{ part: p, depth }, ...flat(p.children ?? [], depth + 1)])
}
const isLeaf = (p: PaperPart) => !p.children?.length

/* Rotation keeps place (FR-X6-10): in-memory only, no storage. */
const root = ref<HTMLElement | null>(null)
let anchor: { el: Element; offset: number } | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let scrollTimer: ReturnType<typeof setTimeout> | undefined
let bound: EventTarget | null = null
const top = () => (props.scrollContainer ? props.scrollContainer.getBoundingClientRect().top : 0)

function record() {
  const els = root.value?.querySelectorAll('[data-paper-q]') ?? []
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
function onResize() {
  clearTimeout(timer)
  timer = setTimeout(restore, 150)
}
function onScroll() {
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(record, 100)
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
  bound?.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('orientationchange', onResize)
})
defineExpose({ record, restore })
</script>

<template>
  <div ref="root" class="flex min-w-0 flex-col gap-8" data-testid="paper-view">
    <section
      v-for="{ s, blocks } in sectionBlocks"
      :key="s.id"
      class="flex min-w-0 flex-col gap-4"
      :data-testid="`paper-section-${s.id}`"
    >
      <slot name="section-head" :section="s">
        <header class="flex min-w-0 flex-col gap-1">
          <h2 class="text-heading text-highlighted">
            {{ s.label }}
            <span v-if="s.marks !== undefined" class="tabular text-caption text-muted">[{{ s.marks }} markah]</span>
            <span v-if="s.compulsory" class="text-caption text-muted">(wajib)</span>
          </h2>
          <p v-if="s.instruction" class="min-w-0 overflow-x-auto text-body text-default">{{ s.instruction }}</p>
        </header>
      </slot>

      <component
        :is="grouped(b) ? StimulusGroup : 'div'"
        v-for="b in blocks"
        :key="b.key"
        v-bind="grouped(b) ? { stimuli: b.stimuli, groupId: b.groupId } : {}"
        :class="grouped(b) ? '' : 'flex min-w-0 flex-col gap-6'"
      >
        <article
          v-for="q in b.questions"
          :key="q.id"
          class="flex min-w-0 flex-col gap-3"
          :data-paper-q="q.id"
          :data-testid="`paper-q-${q.id}`"
        >
          <slot name="question-head" :question="q" :section="s">
            <div class="flex items-baseline justify-between gap-3">
              <h3 class="text-subheading text-highlighted">Soalan {{ q.number }}</h3>
              <span class="tabular text-caption text-muted">[{{ q.marks }} markah]</span>
            </div>
          </slot>
          <div class="min-w-0 overflow-x-auto text-body text-default" data-testid="paper-stem">
            <RichText :text="q.stem" />
          </div>
          <ol v-if="q.options?.length" class="flex min-w-0 flex-col gap-2">
            <li v-for="o in q.options" :key="o.id" class="flex min-w-0 gap-2 rounded-lg bg-muted p-3 text-body">
              <span class="font-semibold">{{ o.letter }}.</span>
              <span class="min-w-0 overflow-x-auto"><RichText :text="o.text" /></span>
            </li>
          </ol>
          <ul v-if="q.parts?.length" class="flex min-w-0 flex-col gap-3">
            <li
              v-for="{ part, depth } in flat(q.parts)"
              :key="part.id"
              class="flex min-w-0 flex-col gap-1"
              :class="{ 'ps-3': depth === 1, 'ps-6': depth === 2, 'ps-9': depth === 3, 'ps-12': depth >= 4 }"
              :data-depth="depth"
              :data-testid="`paper-part-${part.id}`"
            >
              <slot name="part" :part="part" :depth="depth" :reveal="reveal">
                <p class="flex min-w-0 flex-wrap items-baseline gap-x-2 overflow-x-auto text-body text-highlighted">
                  <span v-if="part.label" class="font-bold">{{ part.label }}</span>
                  <RichText :text="part.prompt" />
                  <span v-if="isLeaf(part)" class="tabular text-caption text-muted">[{{ part.marks }} markah]</span>
                </p>
              </slot>
              <slot name="part-extra" :part="part" :depth="depth" :reveal="reveal">
                <template v-if="reveal">
                  <p
                    v-if="typeof part.maxCap === 'number'"
                    class="tabular text-caption text-muted"
                    data-testid="paper-cap"
                  >
                    {{ maksLabel(part.maxCap) }}
                  </p>
                  <p
                    v-for="(d, i) in part.deductions ?? []"
                    :key="i"
                    class="tabular text-caption text-muted"
                    data-testid="paper-deduction"
                  >
                    {{ deductionLine(d.label, d.n, d.amount, d.cap) }}
                  </p>
                </template>
              </slot>
            </li>
          </ul>
          <slot name="question-foot" :question="q" :section="s" />
        </article>
      </component>
    </section>
  </div>
</template>
