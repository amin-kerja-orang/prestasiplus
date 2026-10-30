// R1 pp/ds-no-class-attr: no `class` / `:class` on any element or component of a portal page or
// domain component (docs/design/v2-admin-page-templates.md section 4). Layout, spacing, type and
// colour are Ds props. The report keeps the `classifyFamily` code of the first token.
import { classifyFamily } from '../../scripts/lib/ds-debt-scan.mjs'
import { attrInfo, tagOf, visit } from '../lib/vue-helpers.mjs'

export default {
  meta: {
    type: 'problem',
    docs: { description: 'No class attribute in portal pages and components' },
    schema: [],
    messages: {
      cls: 'class on <{{tag}}> is not allowed ({{detail}}). Use a Ds primitive prop instead.',
    },
  },
  create(context) {
    return visit(context, {
      VAttribute(node) {
        const info = attrInfo(node)
        if (info.name !== 'class' || (info.kind !== 'static' && info.kind !== 'bind')) return
        let detail = 'dynamic'
        if (info.kind === 'static') {
          const tokens = (info.value ?? '').split(/\s+/).filter(Boolean)
          const code = tokens.map((t) => classifyFamily(t)?.family).find(Boolean) ?? 'hook'
          detail = `${code}: ${tokens.slice(0, 3).join(' ')}${tokens.length > 3 ? ' ...' : ''}`
        }
        context.report({
          node,
          messageId: 'cls',
          data: { tag: tagOf(node.parent.parent), detail },
        })
      },
    })
  },
}
