// pp/ds-no-remote-assets: 3D art, images and fonts ship with the app, never from a remote host
// (G-12, CSP). Checks static `src`/`href`/`srcset`/`poster` attributes and import specifiers.
const REMOTE = /^\s*(?:https?:)?\/\//i
const ATTRS = new Set(['src', 'href', 'srcset', 'poster'])

export default {
  meta: {
    type: 'problem',
    docs: { description: 'No remote asset URLs in strict files' },
    schema: [],
    messages: { remote: 'Remote assets are forbidden (G-12); ship the file in the repo.' },
  },
  create(context) {
    const parser = context.sourceCode.parserServices
    const script = {
      ImportDeclaration(node) {
        if (typeof node.source.value === 'string' && REMOTE.test(node.source.value))
          context.report({ node, messageId: 'remote' })
      },
    }
    if (!parser?.defineTemplateBodyVisitor) return script
    return parser.defineTemplateBodyVisitor(
      {
        VAttribute(node) {
          if (node.directive) {
            const expr = node.value?.expression
            if (
              node.key.name?.name === 'bind' &&
              ATTRS.has(node.key.argument?.name) &&
              expr?.type === 'Literal' &&
              typeof expr.value === 'string' &&
              REMOTE.test(expr.value)
            )
              context.report({ node, messageId: 'remote' })
            return
          }
          if (ATTRS.has(node.key.name) && node.value?.value && REMOTE.test(node.value.value))
            context.report({ node, messageId: 'remote' })
        },
      },
      script,
    )
  },
}
