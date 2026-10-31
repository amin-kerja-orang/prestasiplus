// R6 pp/ds-no-ui-duplicate: a Nuxt UI component that has a Ds twin (UCard -> DsPanel, UBadge ->
// DsBadge, UTable -> DsDataTable, ...). The twin map is eslint/ds-admin-data.mjs `UI_TWINS`.
import { UI_TWINS } from '../ds-admin-data.mjs'
import { componentName, visit } from '../lib/vue-helpers.mjs'

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Use the Ds twin instead of the Nuxt UI component' },
    schema: [],
    messages: { twin: '<{{tag}}> has a design-system twin. Use {{twin}}.' },
  },
  create(context) {
    return visit(context, {
      VElement(node) {
        const name = componentName(node)
        if (name && Object.hasOwn(UI_TWINS, name))
          context.report({ node, messageId: 'twin', data: { tag: name, twin: UI_TWINS[name] } })
      },
    })
  },
}
