// pp/ds-icon-names: icons in strict files are Phosphor (`i-ph-*` or `ph:*`, D38). Any other icon
// name (for example Lucide) is rejected: `i-lucide-x`, `i-lucide:x`, `lucide:x`.
// Template: icon-like attributes (icon, leading-icon, ...) and string literals in expressions.
// Script: only icon-like positions (icon/leadingIcon/trailingIcon/... properties and variables)
// and strings that look like an icon of a known non-Phosphor collection, so `'i-am-here'` passes.
const COLLECTIONS =
  'lucide|heroicons|mdi|tabler|fa|fa6-[a-z]+|fa-[a-z]+|bi|ri|carbon|material-symbols|fluent|ion|bx|feather|radix-icons|iconoir|majesticons|solar|uil|simple-icons|logos|vscode-icons|akar-icons|clarity|codicon|gg|jam|mingcute|octicon|pepicons|teenyicons|zondicons'
/** A string that is plainly an icon of another collection. */
const OTHER_ICON = new RegExp(
  `^(?:i-(?:${COLLECTIONS})[-:][a-z0-9-]+|(?:${COLLECTIONS}):[a-z0-9-]+)$`,
)
/** A string in an icon-like position: any `i-xxx-yyy` / `xxx:yyy` that is not Phosphor. */
const ANY_ICON_NAME = /^(?:i-(?!ph[-:])[a-z0-9]+[-:][a-z0-9-]+|(?!ph:)[a-z0-9-]+:[a-z0-9-]+)$/

const ICON_ATTRS = /^(?:icon|[a-z]+-icon|icon-[a-z]+)$/
const ICON_PROPS = /^(?:icon|[a-z]+Icon|icon[A-Z][a-zA-Z]*)$/
const ICON_VAR = /(?:icon|Icon)s?$/

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Only Phosphor icon names in strict files' },
    schema: [
      { type: 'object', properties: { baseNamesOnly: { type: 'boolean' } }, additionalProperties: false },
    ],
    messages: {
      icon: 'Icons must use the Phosphor collection `i-ph-*` (D38); got "{{name}}".',
      full: 'Icon props take base names ("plus"), not full class names; got "{{name}}".',
    },
  },
  create(context) {
    const baseNamesOnly = context.options[0]?.baseNamesOnly === true
    const FULL_PH = /^(?:i-ph-|ph:)/
    const seen = new WeakSet()
    const flag = (node, name, messageId = 'icon') => {
      if (seen.has(node)) return
      seen.add(node)
      context.report({ node, messageId, data: { name } })
    }
    const checkLiteral = (node, iconPosition) => {
      if (typeof node.value !== 'string') return
      const v = node.value.trim()
      if (OTHER_ICON.test(v) || (iconPosition && ANY_ICON_NAME.test(v))) flag(node, node.value)
      else if (baseNamesOnly && iconPosition && FULL_PH.test(v)) flag(node, node.value, 'full')
    }
    /** Checks every string literal reachable through arrays/objects/conditionals of `expr`. */
    const walk = (expr, iconPosition) => {
      if (!expr) return
      if (expr.type === 'Literal') checkLiteral(expr, iconPosition)
      else if (expr.type === 'ConditionalExpression') {
        walk(expr.consequent, iconPosition)
        walk(expr.alternate, iconPosition)
      } else if (expr.type === 'LogicalExpression') walk(expr.right, iconPosition)
      else if (expr.type === 'ArrayExpression') expr.elements.forEach((e) => walk(e, iconPosition))
      else if (expr.type === 'ObjectExpression')
        expr.properties.forEach((p) => p.type === 'Property' && walk(p.value, iconPosition))
      else if (expr.type === 'TSAsExpression' || expr.type === 'TSSatisfiesExpression')
        walk(expr.expression, iconPosition)
    }
    const script = {
      Property(node) {
        const key = node.key.type === 'Identifier' ? node.key.name : node.key.value
        if (!node.computed && typeof key === 'string' && ICON_PROPS.test(key))
          walk(node.value, true)
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && ICON_VAR.test(node.id.name)) walk(node.init, true)
      },
      Literal(node) {
        checkLiteral(node, false)
      },
    }
    const parser = context.sourceCode.parserServices
    if (!parser?.defineTemplateBodyVisitor) return script
    return parser.defineTemplateBodyVisitor(
      {
        VAttribute(node) {
          if (node.directive) {
            const arg = node.key.argument?.name
            if (node.key.name?.name === 'bind' && typeof arg === 'string' && ICON_ATTRS.test(arg))
              walk(node.value?.expression, true)
            return
          }
          const name = node.key.name
          if (typeof name === 'string' && ICON_ATTRS.test(name) && node.value?.value) {
            const v = node.value.value.trim()
            if (OTHER_ICON.test(v) || ANY_ICON_NAME.test(v)) flag(node, node.value.value)
            else if (baseNamesOnly && FULL_PH.test(v)) flag(node, node.value.value, 'full')
          }
        },
        Literal(node) {
          checkLiteral(node, false)
        },
      },
      script,
    )
  },
}
