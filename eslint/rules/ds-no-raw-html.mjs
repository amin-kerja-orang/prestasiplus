// R5 pp/ds-no-raw-html: native elements are not written in portal pages and components. Compose Ds
// primitives (DsStack, DsCluster, DsGrid, DsText, DsHeading, DsFormField, ...). `<template>`,
// `<slot>`, `<component>`, `<RouterView>`, `<Teleport>`, `<KeepAlive>` and non-listed tags are fine.
import { RAW_HTML, RAW_HTML_HINT } from '../ds-admin-data.mjs'
import { tagOf, visit } from '../lib/vue-helpers.mjs'

export default {
  meta: {
    type: 'problem',
    docs: { description: 'No raw HTML elements in portal pages and components' },
    schema: [],
    messages: { raw: 'Raw <{{tag}}> is not allowed. Use {{hint}}.' },
  },
  create(context) {
    return visit(context, {
      VElement(node) {
        const tag = tagOf(node)
        // Only real HTML tags: lowercase, no dash, listed.
        if (tag !== tag.toLowerCase() || !RAW_HTML.has(tag)) return
        if (node.namespace && !node.namespace.endsWith('1999/xhtml') && tag !== 'svg') return
        context.report({
          node,
          messageId: 'raw',
          data: { tag, hint: RAW_HTML_HINT[tag] ?? 'a Ds component' },
        })
      },
    })
  },
}
