// R2 pp/ds-no-class-literal-in-script: class-like string literals in `<script>` and `.ts` files of
// the portal (group-accent.ts, NAV_UI, TH/TD constants, route / menu helpers). The mapping moves into
// src/ds (accent keys, not classes). Template literals are checked per static part.
import { looksLikeClassList } from '../../scripts/lib/ds-debt-scan.mjs'
import { visit } from '../lib/vue-helpers.mjs'

const isImportSource = (node) =>
  node.parent &&
  (node.parent.type === 'ImportDeclaration' ||
    node.parent.type === 'ExportNamedDeclaration' ||
    node.parent.type === 'ExportAllDeclaration' ||
    node.parent.type === 'ImportExpression' ||
    node.parent.type === 'TSLiteralType' ||
    node.parent.type === 'TSImportType')

export default {
  meta: {
    type: 'problem',
    docs: { description: 'No class-like string literals in script / .ts files of the portal' },
    schema: [],
    messages: {
      lit: 'Class-like literal "{{text}}" in script. Move the mapping into src/ds (accent / tone keys).',
    },
  },
  create(context) {
    const check = (node, text) => {
      if (typeof text !== 'string' || !looksLikeClassList(text)) return
      context.report({ node, messageId: 'lit', data: { text: text.trim().slice(0, 60) } })
    }
    return visit(
      context,
      {},
      {
        Literal(node) {
          if (typeof node.value === 'string' && !isImportSource(node)) check(node, node.value)
        },
        TemplateElement(node) {
          check(node, node.value.cooked)
        },
      },
    )
  },
}
