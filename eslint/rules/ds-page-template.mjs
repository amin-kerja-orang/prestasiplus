// R12 pp/ds-page-template: structural check of a routed page (`*Page.vue`).
//  - the root is `DsPage` with `layout` set and no `title` (print pages with a DsPrintSheet root are exempt);
//  - at most one DsFilterBar, one DsPillNav, one DsStatRow and (list layout) one `DsDataTable variant="flush"`;
//  - a DsStatRow with an `items` array literal has 2-5 items;
//  - every DsDataTable has `cardTitle` and `cardFields`;
//  - no DsPanel directly inside a DsPanel;
//  - DsBackLink is not written (use DsPage `backTo`), and `backLabel` is not used.
// A `v-else` / `v-else-if` element is the alternative of an earlier one and is not counted again.
import {
  attrInfo,
  childElements,
  componentName,
  findAttr,
  stringValue,
  templateRoot,
  walkElements,
} from '../lib/vue-helpers.mjs'

const hasDirective = (el, names) =>
  el.startTag.attributes.some((a) => a.directive && names.includes(a.key.name?.name))

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Routed pages follow the DsPage template structure' },
    schema: [],
    messages: {
      root: 'The page root must be a single <DsPage> (found {{found}}).',
      layout: '<DsPage> needs a `layout` prop.',
      title: '<DsPage> must not set `title`; the shell header owns the page title.',
      dup: 'More than one <{{tag}}> in a page; a page has one.',
      items: '<DsStatRow> items must be 2 to 5 (got {{n}}).',
      card: '<DsDataTable> needs `cardTitle` and `cardFields` (mobile cards).',
      nested: '<DsPanel> directly inside <DsPanel>. No cards in cards.',
      back: '<DsBackLink> is not written in a page. Set `backTo` on <DsPage>.',
      backLabel: '`backLabel` is not allowed; the back label is "Kembali".',
    },
  },
  create(context) {
    return {
      Program() {
        const tpl = templateRoot(context)
        if (!tpl) return
        const roots = childElements(tpl)
        const rootName = roots.length === 1 ? componentName(roots[0]) : null
        if (rootName === 'DsPrintSheet') return
        if (rootName !== 'DsPage') {
          context.report({
            loc: (roots[0] ?? tpl).loc,
            messageId: 'root',
            data: { found: roots.length === 1 ? `<${roots[0].rawName ?? roots[0].name}>` : `${roots.length} roots` },
          })
          return
        }
        const root = roots[0]
        const layout = findAttr(root, 'layout')
        if (!layout) context.report({ loc: root.loc, messageId: 'layout' })
        if (findAttr(root, 'title')) context.report({ loc: root.loc, messageId: 'title' })
        const layoutName = layout ? stringValue(layout) : undefined

        const counts = { DsFilterBar: 0, DsPillNav: 0, DsStatRow: 0, flush: 0 }
        walkElements(root, (el, parent) => {
          for (const a of el.startTag.attributes) {
            const info = attrInfo(a)
            if (info.name === 'backLabel' || info.name === 'back-label')
              context.report({ node: a, messageId: 'backLabel' })
          }
          const name = componentName(el)
          if (!name) return
          const alternative = hasDirective(el, ['else', 'else-if'])
          if (name === 'DsFilterBar' || name === 'DsPillNav' || name === 'DsStatRow') {
            if (!alternative && ++counts[name] === 2)
              context.report({ node: el, messageId: 'dup', data: { tag: name } })
          }
          if (name === 'DsStatRow') {
            const items = findAttr(el, 'items')
            if (items?.expr?.type === 'ArrayExpression') {
              const n = items.expr.elements.length
              if (n < 2 || n > 5) context.report({ node: el, messageId: 'items', data: { n } })
            }
          }
          if (name === 'DsDataTable') {
            if (!findAttr(el, 'cardTitle') || !findAttr(el, 'cardFields'))
              context.report({ node: el, messageId: 'card' })
            const variant = findAttr(el, 'variant')
            if (layoutName === 'list' && variant && stringValue(variant) === 'flush' && !alternative)
              if (++counts.flush === 2)
                context.report({ node: el, messageId: 'dup', data: { tag: 'DsDataTable variant="flush"' } })
          }
          if (name === 'DsPanel') {
            let p = parent
            while (p && p.name === 'template') p = p.parent // v-if / slot wrappers do not separate panels
            if (p && componentName(p) === 'DsPanel') context.report({ node: el, messageId: 'nested' })
          }
          if (name === 'DsBackLink') context.report({ node: el, messageId: 'back' })
        })
      },
    }
  },
}
