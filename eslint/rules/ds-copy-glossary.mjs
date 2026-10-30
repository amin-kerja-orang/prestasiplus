// R11 pp/ds-copy-glossary: banned wording (docs/design/v2-admin-page-templates.md glossary) in
// template text, attribute strings and script literals, plus the add-button rule. Exceptions live in
// config/copy-exceptions.json (file + text + module + ref + reason).
// Heuristic for "add button": a UButton whose icon is `plus` must have a label that starts with
// "Tambah ", "Daftar ", "Muat Naik " or "Import "; a label starting "Daftar " must name one of the
// four allowed entities.
import {
  ADD_LABEL_RE,
  BANNED_COPY,
  DAFTAR_ENTITIES,
  NO_DATA_RE,
  readCopyExceptions,
} from '../ds-admin-data.mjs'
import { attrInfo, componentName, findAttr, relFile, stringValue, visit } from '../lib/vue-helpers.mjs'

const PLUS_ICON = /^(?:i-ph-)?plus(?:-.*)?$/

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Glossary wording and add-button labels' },
    schema: [{ type: 'object', properties: { exceptions: { type: 'array' } }, additionalProperties: false }],
    messages: {
      copy: 'Wording "{{text}}" is not allowed: {{why}}.',
      add: 'Add button "{{text}}" must start with "Tambah ", "Daftar ", "Muat Naik " or "Import ".',
      daftar:
        '"Daftar" is only used with Pengguna, Sekolah, Pelajar Komplimen or Langganan (got "{{text}}").',
    },
  },
  create(context) {
    const file = relFile(context)
    const exceptions = (context.options[0]?.exceptions ?? readCopyExceptions()).filter(
      (e) => e.file === file,
    )
    const excused = (match) => exceptions.some((e) => match.includes(e.text))
    // One entry per open element: true while inside <DsEmptyState size="sm">.
    const smStack = []
    const inSm = () => smStack.at(-1) === true

    const scan = (node, text) => {
      if (typeof text !== 'string' || !text.trim()) return
      for (const { re, why } of BANNED_COPY) {
        const m = re.exec(text)
        if (m && !excused(m[0]))
          context.report({ node, messageId: 'copy', data: { text: m[0].trim(), why } })
      }
      const nd = NO_DATA_RE.exec(text)
      if (nd && !inSm() && !excused(nd[0]))
        context.report({
          node,
          messageId: 'copy',
          data: { text: nd[0], why: '"Tiada data." only inside DsEmptyState size="sm"' },
        })
    }

    const checkAddButton = (element) => {
      if (componentName(element) !== 'UButton') return
      const labelAttr = findAttr(element, 'label')
      const text = (
        (labelAttr ? stringValue(labelAttr) : undefined) ??
        element.children
          .filter((c) => c.type === 'VText')
          .map((c) => c.value)
          .join('')
      ).trim()
      if (!text) return
      const iconAttr = findAttr(element, 'icon')
      const iconName = iconAttr ? stringValue(iconAttr) : undefined
      if (iconName && PLUS_ICON.test(iconName) && !ADD_LABEL_RE.test(text))
        context.report({ node: element, messageId: 'add', data: { text } })
      else if (/^Daftar /.test(text) && !DAFTAR_ENTITIES.test(text))
        context.report({ node: element, messageId: 'daftar', data: { text } })
    }

    const isModuleSource = (node) =>
      ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(
        node.parent?.type,
      )

    return visit(
      context,
      {
        VElement(node) {
          if (componentName(node) === 'DsEmptyState') {
            const size = findAttr(node, 'size')
            smStack.push(size ? stringValue(size) === 'sm' : false)
          } else smStack.push(inSm())
          checkAddButton(node)
        },
        'VElement:exit'() {
          smStack.pop()
        },
        VText(node) {
          scan(node, node.value)
        },
        VAttribute(node) {
          const info = attrInfo(node)
          if (info.kind !== 'static') return
          if (['class', 'style', 'icon', 'to', 'href', 'size', 'variant', 'tone'].includes(info.name)) return
          scan(node, info.value)
        },
        'VExpressionContainer Literal'(node) {
          if (typeof node.value === 'string') scan(node, node.value)
        },
      },
      {
        Literal(node) {
          if (typeof node.value === 'string' && !isModuleSource(node)) scan(node, node.value)
        },
        TemplateElement(node) {
          scan(node, node.value.cooked)
        },
      },
    )
  },
}
