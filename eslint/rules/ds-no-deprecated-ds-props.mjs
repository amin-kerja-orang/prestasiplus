// R13 pp/ds-no-deprecated-ds-props: props the Ds components still accept but have deprecated
// (DsPanel flush / tone, DsStatRow roomy / compact, valueClass, compactCells, DsLoadError inline,
// DsFormSection tone="danger", DsFilterBar tone). Table: eslint/ds-admin-data.mjs `DEPRECATED_PROPS`.
// Full `i-ph-*` icon strings are reported by R9 (pp/ds-icon-names, option baseNamesOnly).
import { DEPRECATED_PROPS, DEPRECATED_VALUES } from '../ds-admin-data.mjs'
import { attrInfo, camel, componentName, stringValue, visit } from '../lib/vue-helpers.mjs'

export default {
  meta: {
    type: 'problem',
    docs: { description: 'No deprecated Ds props' },
    schema: [],
    messages: { dep: '<{{tag}}> prop "{{prop}}" is deprecated: {{why}}.' },
  },
  create(context) {
    return visit(context, {
      VElement(node) {
        const tag = componentName(node)
        if (!tag || !/^Ds[A-Z]/.test(tag)) return
        const table = { ...(DEPRECATED_PROPS['*'] ?? {}), ...(DEPRECATED_PROPS[tag] ?? {}) }
        for (const attr of node.startTag.attributes) {
          const info = attrInfo(attr)
          if (!info.name || (info.kind !== 'static' && info.kind !== 'bind')) continue
          const prop = camel(info.name)
          if (!Object.hasOwn(table, prop)) continue
          const only = DEPRECATED_VALUES.find((v) => v.tag === tag && v.prop === prop)
          if (only && stringValue(info) !== only.value) continue
          context.report({ node: attr, messageId: 'dep', data: { tag, prop, why: table[prop] } })
        }
      },
    })
  },
}
