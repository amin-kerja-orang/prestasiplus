import type { VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

interface Item {
  type?: string
  value?: string | number
  label?: string
}

interface Instance {
  props: Record<string, unknown>
  parent: Instance | null
  emit: (event: string, ...args: unknown[]) => void
}

/**
 * Nuxt UI `USelect` renders its options only when open, so tests read the `items` prop and emit
 * `update:modelValue` instead of using a native `<select>`. `testid` is the `data-testid` the page
 * puts on the select (it lands on the trigger button inside the component).
 */
export function usel(wrapper: VueWrapper, testid: string) {
  const el = wrapper.get(`[data-testid="${testid}"]`).element as unknown as {
    __vueParentComponent?: Instance
  }
  let inst: Instance | null = el.__vueParentComponent ?? null
  while (inst && !('items' in inst.props)) inst = inst.parent
  if (!inst) throw new Error(`no USelect around ${testid}`)
  const found = inst
  return {
    items: () => (found.props.items as Item[]).filter((i) => i.type !== 'label'),
    labels: () => (found.props.items as Item[]).filter((i) => i.type === 'label').map((i) => i.label),
    texts: () => (found.props.items as Item[]).filter((i) => i.type !== 'label').map((i) => i.label),
    value: () => found.props.modelValue,
    async set(v: string | number) {
      found.emit('update:modelValue', v)
      await nextTick()
    },
  }
}
