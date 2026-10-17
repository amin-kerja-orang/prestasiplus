import { defineComponent, h } from 'vue'

/**
 * Minimal unit-test stand-ins for the Nuxt UI form components (the real plugin cannot load under
 * Vitest, see nuxt-ui-plugin-stub.ts). They render the native element so tests can set values,
 * read `disabled` and click. Register with `global: { components: formStubs }`.
 */
const field = (tag: 'input' | 'textarea') =>
  defineComponent({
    inheritAttrs: false,
    props: { modelValue: { type: String, default: '' } },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () =>
        h(tag, {
          ...attrs,
          value: props.modelValue,
          onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value),
        })
    },
  })

export const formStubs = {
  UInput: field('input'),
  UTextarea: field('textarea'),
  UNativeSelect: defineComponent({
    inheritAttrs: false,
    props: {
      modelValue: { type: String, default: '' },
      items: { type: Array, default: () => [] },
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () =>
        h(
          'select',
          {
            ...attrs,
            value: props.modelValue,
            onChange: (e: Event) => emit('update:modelValue', (e.target as HTMLSelectElement).value),
          },
          (props.items as { label: string; value: string }[]).map((o) =>
            h('option', { value: o.value, selected: o.value === props.modelValue }, o.label),
          ),
        )
    },
  }),
  UAlert: defineComponent({
    inheritAttrs: false,
    props: { title: { type: String, default: '' } },
    setup(props, { attrs, slots }) {
      return () => h('div', attrs, [props.title, slots.title?.()])
    },
  }),
  UButton: defineComponent({
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      return () => h(attrs.to ? 'a' : 'button', { ...attrs, href: attrs.to }, slots.default?.())
    },
  }),
  UCheckbox: defineComponent({
    inheritAttrs: false,
    props: { modelValue: { type: Boolean, default: false } },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () =>
        h('button', {
          ...attrs,
          type: 'button',
          role: 'checkbox',
          'aria-checked': String(props.modelValue),
          onClick: () => emit('update:modelValue', !props.modelValue),
        })
    },
  }),
  UProgress: defineComponent({
    inheritAttrs: false,
    props: { modelValue: { type: Number, default: 0 } },
    setup(props, { attrs }) {
      return () => h('div', attrs, [h('div', { role: 'progressbar', 'aria-valuenow': String(props.modelValue) })])
    },
  }),
}
