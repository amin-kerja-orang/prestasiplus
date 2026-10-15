// pp/ds-icon-names: icons in strict files are `i-ph-*` (Phosphor Duotone, D38). Any other
// `i-<collection>-<name>` string (for example Lucide) is rejected, in templates and in script.
const OTHER_ICON = /^i-(?!ph-)[a-z0-9]+(?:-[a-z0-9]+)+$/
const ICON_ATTRS = /^(?:icon|[a-z]+-icon|icon-[a-z]+)$/

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Only Phosphor (i-ph-*) icon names in strict files' },
    schema: [],
    messages: { icon: 'Icons must use the Phosphor collection `i-ph-*` (D38); got "{{name}}".' },
  },
  create(context) {
    const parser = context.sourceCode.parserServices
    const script = {
      Literal(node) {
        if (typeof node.value === 'string' && OTHER_ICON.test(node.value.trim()))
          context.report({ node, messageId: 'icon', data: { name: node.value } })
      },
    }
    if (!parser?.defineTemplateBodyVisitor) return script
    return parser.defineTemplateBodyVisitor(
      {
        VAttribute(node) {
          if (node.directive) return
          const name = node.key.name
          if (typeof name === 'string' && ICON_ATTRS.test(name) && node.value?.value) {
            if (OTHER_ICON.test(node.value.value.trim()))
              context.report({ node, messageId: 'icon', data: { name: node.value.value } })
          }
        },
        // Literal strings inside template expressions (`:icon="'i-lucide-x'"`, `ok ? 'i-lucide-x' : ...`).
        Literal(node) {
          if (typeof node.value === 'string' && OTHER_ICON.test(node.value.trim()))
            context.report({ node, messageId: 'icon', data: { name: node.value } })
        },
      },
      script,
    )
  },
}
