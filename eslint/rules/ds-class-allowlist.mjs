// pp/ds-class-allowlist: checks class strings against the design-system allowlist (G-1, G-2, G-3,
// G-3b) at the level given by the option `{ level: 'page' | 'ds' }`.
// Where it looks:
//   template: `class="..."`, `:class="..."` (strings, arrays, object keys, ternaries, logicals,
//             template literals, cn()/clsx() calls, `as` casts, spreads) and `:ui="{ ... }"`
//             (every string value, nested).
//   script:   cn()/clsx()/twMerge() arguments, `class`/`className`/`classes`/`ui` properties and
//             variables whose name ends in class/classes/className/cls/ui.
// A class held in a plain variable cannot be resolved; pp/ds-no-dynamic-class warns about that.
import { classifyToken, splitClasses } from '../class-allowlist.mjs'

export const CLASS_FNS = new Set(['cn', 'clsx', 'classnames', 'classNames', 'twMerge', 'twJoin'])
const CLASS_KEYS = new Set(['class', 'className', 'classes', 'ui'])
const CLASS_VAR = /(?:class|classes|className|cls|ui)$/i

const calleeName = (c) =>
  c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? c.property?.name : undefined

/**
 * Collects `{ node, token }` pairs from an expression.
 * mode 'class': object keys are class names. mode 'ui': object values are class strings.
 */
export function collect(expr, out, mode = 'class') {
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
        // A token touching a `${}` is only a fragment of a class name; skip it.
        if (i > 0 && tokens.length && !/^\s/.test(text)) tokens.shift()
        if (i < expr.quasis.length - 1 && tokens.length && !/\s$/.test(text)) tokens.pop()
        for (const token of tokens) out.push({ node: q, token })
      })
      break
    case 'ArrayExpression':
      for (const el of expr.elements) collect(el, out, mode)
      break
    case 'SpreadElement':
      collect(expr.argument, out, mode)
      break
    case 'ObjectExpression':
      for (const p of expr.properties) {
        if (p.type === 'SpreadElement') collect(p.argument, out, mode)
        else if (p.type !== 'Property') continue
        else if (mode === 'ui') collect(p.value, out, 'ui')
        else if (p.computed) continue
        else if (p.key.type === 'Identifier') out.push({ node: p.key, token: p.key.name })
        else collect(p.key, out, mode)
      }
      break
    case 'ConditionalExpression':
      collect(expr.consequent, out, mode)
      collect(expr.alternate, out, mode)
      break
    case 'LogicalExpression':
      collect(expr.left, out, mode)
      collect(expr.right, out, mode)
      break
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'TSTypeAssertion':
    case 'ParenthesizedExpression':
      collect(expr.expression, out, mode)
      break
    case 'CallExpression': {
      const name = calleeName(expr.callee)
      if (name && CLASS_FNS.has(name)) for (const a of expr.arguments) collect(a, out, mode)
      break
    }
    default:
  }
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Only layout and token utilities in class strings of strict files' },
    schema: [
      {
        type: 'object',
        properties: { level: { enum: ['page', 'ds'] } },
        additionalProperties: false,
      },
    ],
    messages: { forbidden: '{{detail}}' },
  },
  create(context) {
    const level = context.options[0]?.level ?? 'page'
    const seen = new Set()
    const report = (node, token) => {
      const bad = classifyToken(token, level)
      const key = `${node.range?.join('-')}:${token}`
      if (!bad || seen.has(key)) return
      seen.add(key)
      context.report({
        node,
        messageId: 'forbidden',
        data: { detail: `${bad.message} [${token}]` },
      })
    }
    const reportAll = (expr, mode) => {
      const out = []
      collect(expr, out, mode)
      for (const { node, token } of out) report(node, token)
    }

    const script = {
      CallExpression(node) {
        const name = calleeName(node.callee)
        if (name && CLASS_FNS.has(name)) for (const a of node.arguments) reportAll(a, 'class')
      },
      Property(node) {
        if (node.computed) return
        const key = node.key.type === 'Identifier' ? node.key.name : node.key.value
        if (typeof key === 'string' && CLASS_KEYS.has(key))
          reportAll(node.value, key === 'ui' ? 'ui' : 'class')
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && CLASS_VAR.test(node.id.name) && node.init)
          reportAll(node.init, /ui$/i.test(node.id.name) ? 'ui' : 'class')
      },
    }

    const parser = context.sourceCode.parserServices
    if (!parser?.defineTemplateBodyVisitor) return script
    return parser.defineTemplateBodyVisitor(
      {
        CallExpression: script.CallExpression,
        VAttribute(node) {
          if (!node.directive) {
            if (node.key.name === 'class' && node.value?.value) {
              for (const token of splitClasses(node.value.value)) report(node.value, token)
            }
            return
          }
          if (node.key.name?.name !== 'bind') return
          const arg = node.key.argument?.name
          if (arg === 'class') reportAll(node.value?.expression, 'class')
          else if (arg === 'ui') reportAll(node.value?.expression, 'ui')
        },
      },
      script,
    )
  },
}
