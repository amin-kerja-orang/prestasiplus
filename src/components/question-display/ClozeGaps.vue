<script lang="ts">
import 'katex/dist/katex.min.css'
import { computed, defineComponent, h, type PropType, type VNode } from 'vue'

import { qdCopy } from './copy'
import { renderMarkup } from './lib/rich-text'
import { countWords } from './words'

const INPUT_CLASS =
  'qd-gap-input mx-1 inline-block min-h-11 w-32 max-w-full rounded-lg bg-default px-3 text-body text-default ring-1 ring-inset ring-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary read-only:bg-elevated read-only:text-toned'

export interface ExampleGap {
  n: number
  answer: string
}

/**
 * Question text with `{{gap:N}}` hooks (FR-PA-05, 46 section 2.2). The text goes through `renderMarkup`
 * (sanitised, markers expanded to `span.qd-gap[data-gap=N]`), the result is parsed to a DOM and rebuilt as
 * VNodes, with an `<input>` mounted at each hook (also inside `td`). No `v-html`: typed values are only
 * ever bound as input values, so they are never read as HTML.
 */
export default defineComponent({
  name: 'ClozeGaps',
  props: {
    text: { type: String, required: true },
    modelValue: { type: Object as PropType<Record<number, string>>, default: () => ({}) },
    exampleGap: { type: Object as PropType<ExampleGap>, default: undefined },
    /** Optional per-gap word cap (`modeConfig.maxWords`): shows the hint, keeps the text. */
    maxWords: { type: Number, default: undefined },
    readonly: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const html = computed(() => renderMarkup(props.text))
    const over = computed(() =>
      props.maxWords === undefined
        ? false
        : Object.values(props.modelValue).some((v) => countWords(v) > props.maxWords!),
    )

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
        if (Number.isInteger(n) && n >= 1) return gapInput(n)
      }
      const attrs: Record<string, string> = {}
      for (const a of Array.from(node.attributes)) {
        if (!/^on/i.test(a.name)) attrs[a.name] = a.value
      }
      const kids = Array.from(node.childNodes).map(toVNode)
      return h(node.tagName.toLowerCase(), attrs, kids as (VNode | string)[])
    }

    return () => {
      const tpl = document.createElement('template')
      tpl.innerHTML = html.value
      const kids = Array.from(tpl.content.childNodes).map(toVNode)
      return h('div', { class: 'break-words text-body text-default', 'data-testid': 'cloze-gaps' }, [
        ...(kids as (VNode | string)[]),
        over.value
          ? h(
              'p',
              { class: 'mt-2 text-caption text-warning', role: 'status', 'data-testid': 'gap-max-hint' },
              qdCopy.gapMax(props.maxWords!),
            )
          : null,
      ])
    }
  },
})
</script>
