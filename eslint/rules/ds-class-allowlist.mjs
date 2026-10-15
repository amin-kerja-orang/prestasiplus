// pp/ds-class-allowlist: checks Vue template `class` / `:class` strings against the design-system
// allowlist (G-1, G-2, G-3, G-3b). Dynamic parts that are not string literals cannot be checked
// and are ignored (a class held in a variable is a design-system change request, G-13).
import { classifyToken, splitClasses } from '../class-allowlist.mjs'

/** Collects `{ node, token }` pairs from a `:class` expression AST. */
function collect(expr, out) {
  if (!expr) return
  switch (expr.type) {
    case 'Literal':
      if (typeof expr.value === 'string')
        for (const token of splitClasses(expr.value)) out.push({ node: expr, token })
      break
    case 'TemplateLiteral':
      expr.quasis.forEach((q, i) => {
        const text = q.value.cooked ?? ''
        const tokens = splitClasses(text)
        if (i > 0 && tokens.length && !/^\s/.test(text)) tokens.shift()
        if (i < expr.quasis.length - 1 && tokens.length && !/\s$/.test(text)) tokens.pop()
        for (const token of tokens) out.push({ node: q, token })
      })
      break
    case 'ArrayExpression':
      for (const el of expr.elements) collect(el, out)
      break
    case 'ObjectExpression':
      for (const p of expr.properties) {
        if (p.type !== 'Property' || p.computed) continue
        if (p.key.type === 'Identifier') out.push({ node: p.key, token: p.key.name })
        else collect(p.key, out)
      }
      break
    case 'ConditionalExpression':
      collect(expr.consequent, out)
      collect(expr.alternate, out)
      break
    case 'LogicalExpression':
      collect(expr.left, out)
      collect(expr.right, out)
      break
    default:
  }
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Only layout and token utilities in class attributes of strict files' },
    schema: [],
    messages: { forbidden: '{{detail}}' },
  },
  create(context) {
    const parser = context.sourceCode.parserServices
    if (!parser?.defineTemplateBodyVisitor) return {}
    const report = (node, token) => {
      const bad = classifyToken(token)
      if (bad)
        context.report({
          node,
          messageId: 'forbidden',
          data: { detail: `${bad.message} [${token}]` },
        })
    }
    return parser.defineTemplateBodyVisitor({
      VAttribute(node) {
        if (!node.directive) {
          if (node.key.name === 'class' && node.value?.value) {
            for (const token of splitClasses(node.value.value)) report(node.value, token)
          }
          return
        }
        if (node.key.name?.name === 'bind' && node.key.argument?.name === 'class') {
          const out = []
          collect(node.value?.expression, out)
          for (const { node: n, token } of out) report(n, token)
        }
      },
    })
  },
}
