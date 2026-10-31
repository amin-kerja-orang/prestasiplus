// R3 pp/ds-no-ui-prop: no `ui=` / `:ui=` on any tag of a portal page or domain component. Nuxt UI slot
// overrides belong in the theme (`ui.config`, eslint/ui-prop-map.json) or in a Ds component.
import { attrInfo, tagOf, visit } from '../lib/vue-helpers.mjs'

export default {
  meta: {
    type: 'problem',
    docs: { description: 'No :ui overrides in portal pages and components' },
    schema: [],
    messages: { ui: ':ui on <{{tag}}> is not allowed. Move the override into the theme or a Ds component.' },
  },
  create(context) {
    return visit(context, {
      VAttribute(node) {
        const info = attrInfo(node)
        if (info.name !== 'ui' || (info.kind !== 'static' && info.kind !== 'bind')) return
        context.report({ node, messageId: 'ui', data: { tag: tagOf(node.parent.parent) } })
      },
    })
  },
}
