// pp/ds-no-dynamic-class (warning, page level): G-13 says a page has no exceptions. A `class` or
// `ui` bound to something the linter cannot read (a variable, a member, an unknown call) hides
// classes from pp/ds-class-allowlist, so it is flagged. Literals, arrays/objects/ternaries of
// literals and cn()/clsx() calls are readable and pass.
import { CLASS_FNS } from './ds-class-allowlist.mjs'

function opaque(expr, mode = 'class') {
  if (!expr) return false
  switch (expr.type) {
    case 'Literal':
    case 'TemplateLiteral':
      return false
    case 'ArrayExpression':
      return expr.elements.some((e) => opaque(e, mode))
    case 'SpreadElement':
      return true
    case 'ObjectExpression':
      // class objects: keys are classes, values are conditions. ui objects: values are classes.
      return expr.properties.some(
        (p) => p.type !== 'Property' || (mode === 'ui' ? opaque(p.value, mode) : p.computed),
      )
    case 'ConditionalExpression':
      return opaque(expr.consequent, mode) || opaque(expr.alternate, mode)
    case 'LogicalExpression':
      return opaque(expr.right, mode)
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
      return opaque(expr.expression, mode)
    case 'CallExpression': {
      const c = expr.callee
      const name = c.type === 'Identifier' ? c.name : undefined
      return !(name && CLASS_FNS.has(name)) || expr.arguments.some((a) => opaque(a, mode))
    }
    case 'UnaryExpression':
    case 'BinaryExpression':
      // `!ok && 'flex'` leaves a boolean on the left, which is not a class source.
      return false
    default:
      return true
  }
}

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'class/ui bound to a non-literal in page-level strict files (G-13)' },
    schema: [],
    messages: {
      dynamic:
        'Dynamic `{{attr}}` binding cannot be checked against the allowlist (G-13). Use literal classes or component props.',
    },
  },
  create(context) {
    const parser = context.sourceCode.parserServices
    if (!parser?.defineTemplateBodyVisitor) return {}
    return parser.defineTemplateBodyVisitor({
      VAttribute(node) {
        if (!node.directive || node.key.name?.name !== 'bind') return
        const arg = node.key.argument?.name
        if (arg !== 'class' && arg !== 'ui') return
        const expr = node.value?.expression
        // Logical `a && b`: only the right side is a class source.
        const target = expr?.type === 'LogicalExpression' ? expr.right : expr
        if (opaque(target, arg)) context.report({ node, messageId: 'dynamic', data: { attr: arg } })
      },
    })
  },
}
