// pp/ds-no-inline-style: no `style=` / `:style=` in strict files (G-4). Dynamic values go through
// component props (UProgress :model-value, ...).
export default {
  meta: {
    type: 'problem',
    docs: { description: 'No inline style attributes in strict files' },
    schema: [],
    messages: {
      inline:
        'Inline style is forbidden in design-system files (G-4). Use component props or token utilities.',
    },
  },
  create(context) {
    const parser = context.sourceCode.parserServices
    if (!parser?.defineTemplateBodyVisitor) return {}
    return parser.defineTemplateBodyVisitor({
      VAttribute(node) {
        const isStyle = node.directive
          ? node.key.name?.name === 'bind' && node.key.argument?.name === 'style'
          : node.key.name === 'style'
        if (isStyle) context.report({ node, messageId: 'inline' })
      },
    })
  },
}
