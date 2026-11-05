<script setup lang="ts">
/**
 * Question text with `{{gap:N}}` hooks (FR-PA-05, 46 section 2.2). The text goes through `renderMarkup`
 * (sanitised, markers expanded to `span.qd-gap[data-gap=N]`), the result is parsed to a DOM and rebuilt as
 * VNodes, with an `<input>` mounted at each hook (also inside `td`). No `v-html`: typed values are only
 * ever bound as input values, so they are never read as HTML.
 */
import 'katex/dist/katex.min.css'
import { computed, h, type VNode } from 'vue'

import { qdCopy } from './copy'
import { MAX_GAP, renderMarkup } from './lib/rich-text'
import { countWords } from './words'

export interface ExampleGap {
  n: number
  answer: string
}

const props = withDefaults(
  defineProps<{
    text: string
    /** Typed text by gap number. */
    modelValue?: Record<number, string>
    /** Worked-example gap: filled and read-only, never an input. */
    exampleGap?: ExampleGap
    /** Optional per-gap word cap (`modeConfig.maxWords`): shows the hint, keeps the text. */
    maxWords?: number
    readonly?: boolean
  }>(),
  { modelValue: () => ({}), exampleGap: undefined, maxWords: undefined, readonly: false },
)
const emit = defineEmits<{ 'update:modelValue': [Record<number, string>] }>()

const INPUT_CLASS =
  'qd-gap-input mx-1 inline-block min-h-11 w-32 max-w-full rounded-lg bg-default px-3 text-body text-default ring-1 ring-inset ring-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary read-only:bg-elevated read-only:text-toned'

const html = computed(() => renderMarkup(props.text))
const over = computed(() =>
  props.maxWords === undefined
    ? false
    : Object.values(props.modelValue).some((v) => countWords(v) > props.maxWords!),
)

// A gap number used twice in one text gives two inputs bound to the same key, by design: both show and edit the
// one answer of leaf N (45 FR-QA-24 links each token to the leaf labelled N).
function gapInput(n: number): VNode {
  const ex = props.exampleGap?.n === n ? props.exampleGap : undefined
  return h('input', {
    type: 'text',
    class: INPUT_CLASS,
    'aria-label': qdCopy.gapAria(n),
    'data-testid': ex ? `gap-example-${n}` : `gap-input-${n}`,
    autocomplete: 'off',
    readonly: ex !== undefined || props.readonly,
    value: ex ? ex.answer : (props.modelValue[n] ?? ''),
    onInput: ex
      ? undefined
      : (e: Event) =>
          emit('update:modelValue', {
            ...props.modelValue,
            [n]: (e.target as HTMLInputElement).value,
          }),
  })
}

function toVNode(node: Node): VNode | string | null {
  if (node.nodeType === 3) return node.textContent ?? ''
  if (!(node instanceof Element)) return null
  if (node.matches('span.qd-gap[data-gap]')) {
    const n = Number(node.getAttribute('data-gap'))
    if (Number.isInteger(n) && n >= 1 && n <= MAX_GAP) return gapInput(n)
  }
  const attrs: Record<string, string> = {}
  for (const a of Array.from(node.attributes)) {
    if (!/^on/i.test(a.name)) attrs[a.name] = a.value
  }
  const kids = Array.from(node.childNodes).map(toVNode)
  return h(node.tagName.toLowerCase(), attrs, kids as (VNode | string)[])
}

/** Functional component: the sanitised markup rebuilt as VNodes with inputs at the hooks. */
const Body = (): (VNode | string | null)[] => {
  const tpl = document.createElement('template')
  tpl.innerHTML = html.value
  return Array.from(tpl.content.childNodes).map(toVNode)
}
</script>

<template>
  <div class="break-words text-body text-default" data-testid="cloze-gaps">
    <Body />
    <p v-if="over" class="mt-2 text-caption text-warning" role="status" data-testid="gap-max-hint">
      {{ qdCopy.gapMax(maxWords!) }}
    </p>
  </div>
</template>
