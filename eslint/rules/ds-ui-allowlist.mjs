// R7 pp/ds-ui-allowlist: (a) any Nuxt UI tag that is not on config/ds-ui-allowlist.json (tags that have
// a Ds twin are R6 and not reported twice); (b) any prop on a `Ds*` tag that the component does not
// declare (read from src/ds/<Tag>.vue). Pass-through attributes (`data-*`, `aria-*`, `id`, `key`,
// `ref`, `role`, events, `class`/`style`/`ui` which have their own rules) are not props.
import { readUiAllowlist, UI_TWINS } from '../ds-admin-data.mjs'
import { dsProps } from '../lib/ds-props.mjs'
import { attrInfo, camel, componentName, visit } from '../lib/vue-helpers.mjs'

const PASS_THROUGH = /^(?:data-.*|aria-.*|id|key|ref|is|slot|role|tabindex|class|style|ui)$/

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Only sanctioned Nuxt UI tags; Ds tags only with documented props' },
    schema: [
      {
        type: 'object',
        properties: {
          allowed: { type: 'array', items: { type: 'string' } },
          dsProps: { type: 'object' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tag: '<{{tag}}> is not on the Nuxt UI allowlist (config/ds-ui-allowlist.json). Use a Ds component.',
      prop: '<{{tag}}> has no prop "{{prop}}" (not in its documented API).',
    },
  },
  create(context) {
    const opt = context.options[0] ?? {}
    const allowed = new Set(opt.allowed ?? readUiAllowlist())
    const propsOf = (tag) =>
      opt.dsProps && Object.hasOwn(opt.dsProps, tag) ? new Set(opt.dsProps[tag]) : dsProps(tag)
    return visit(context, {
      VElement(node) {
        const name = componentName(node)
        if (!name) return
        if (/^U[A-Z]/.test(name)) {
          if (!allowed.has(name) && !Object.hasOwn(UI_TWINS, name))
            context.report({ node, messageId: 'tag', data: { tag: name } })
          return
        }
        if (!/^Ds[A-Z]/.test(name)) return
        const declared = propsOf(name)
        if (!declared) return
        for (const attr of node.startTag.attributes) {
          const info = attrInfo(attr)
          if (!info.name || info.kind === 'on') continue
          if (info.kind !== 'static' && info.kind !== 'bind' && info.kind !== 'model') continue
          if (PASS_THROUGH.test(info.name)) continue
          if (!declared.has(camel(info.name)))
            context.report({ node: attr, messageId: 'prop', data: { tag: name, prop: info.name } })
        }
      },
    })
  },
}
