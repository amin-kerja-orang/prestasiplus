// R14 pp/ds-no-adhoc-format: numbers are formatted by the Ds formatters (`@/ds/format`:
// formatCount, formatPercent) or by DsStatTile / DsDataTable, never by hand in a page:
// `toLocaleString`, `Intl.NumberFormat`, `.toFixed(`, a `%` appended to a value (template literal
// `${x}%`, `x + '%'`, `{{ x }}%` in a template) and thousands-separator regexes.
import { visit } from '../lib/vue-helpers.mjs'

const THOUSANDS = /\(\?=\(\\d\{3\}\)\+|\(\\d\{3\}\)\+\(\?!/

export default {
  meta: {
    type: 'problem',
    docs: { description: 'No ad-hoc number formatting in pages' },
    schema: [],
    messages: {
      fmt: 'Ad-hoc number formatting ({{what}}). Use the Ds formatters (formatCount / formatPercent) or let DsStatTile / DsDataTable format.',
    },
  },
  create(context) {
    const report = (node, what) => context.report({ node, messageId: 'fmt', data: { what } })
    const scriptVisitor = {
      CallExpression(node) {
        const c = node.callee
        if (c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier') {
          if (c.property.name === 'toLocaleString') report(node, 'toLocaleString')
          else if (c.property.name === 'toFixed') report(node, 'toFixed')
        }
      },
      NewExpression(node) {
        const c = node.callee
        if (
          c.type === 'MemberExpression' &&
          c.object.type === 'Identifier' &&
          c.object.name === 'Intl' &&
          c.property.type === 'Identifier' &&
          c.property.name === 'NumberFormat'
        )
          report(node, 'Intl.NumberFormat')
      },
      MemberExpression(node) {
        // Intl.NumberFormat(...) without `new`
        if (
          node.object.type === 'Identifier' &&
          node.object.name === 'Intl' &&
          node.property.type === 'Identifier' &&
          node.property.name === 'NumberFormat' &&
          node.parent.type !== 'NewExpression'
        )
          report(node, 'Intl.NumberFormat')
      },
      TemplateLiteral(node) {
        // `${x}%` : an expression followed by a quasi that starts with %
        node.quasis.forEach((q, i) => {
          if (i > 0 && /^\s?%/.test(q.value.cooked ?? '')) report(q, 'percent suffix')
        })
      },
      BinaryExpression(node) {
        if (
          node.operator === '+' &&
          node.right.type === 'Literal' &&
          typeof node.right.value === 'string' &&
          /^\s?%/.test(node.right.value) &&
          node.left.type !== 'Literal'
        )
          report(node, 'percent suffix')
      },
      Literal(node) {
        if (node.regex && THOUSANDS.test(node.regex.pattern)) report(node, 'thousands separator')
      },
    }
    // The template visitor needs the same checks plus `{{ x }}%` text.
    const templateVisitor = {
      ...scriptVisitor,
      VText(node) {
        const prev = node.parent.children[node.parent.children.indexOf(node) - 1]
        if (prev?.type === 'VExpressionContainer' && /^\s?%/.test(node.value)) report(node, 'percent suffix')
      },
    }
    return visit(context, templateVisitor, scriptVisitor)
  },
}
