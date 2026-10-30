// R10 pp/ds-imports: imports a portal page or domain component may not have: `@/components/**`
// (legacy, incl. AppIcon), `@/shells/**` (outside the shell itself), `**/native/**`, icon / chart /
// font packages, remote URLs, and module-local copies of Ds kits (FormBar, RowMenu, PageHeader, ...).
// Allowed: `@/ds`, module composables / types, vue, vue-router, @nuxt/ui, api and stores.
import { LOCAL_KIT_IMPORT_RE } from '../ds-admin-data.mjs'
import { relFile } from '../lib/vue-helpers.mjs'

const BAD = [
  [/^(?:@|\/src)\/components(?:\/|$)/, 'legacy `@/components/*` (use `@/ds` or `@nuxt/ui`)'],
  [/(?:^|\/)native(?:\/|$)/, 'a `native/` component (use the Ds / Nuxt UI component)'],
  [/^(?:@lucide\/|lucide-|@iconify|@phosphor-icons\/)/, 'an icon package (icons are DsIcon base names)'],
  [/^(?:@fontsource|chart\.js)/, 'fonts and charts are owned by the theme / DsChart'],
  [/^\s*(?:https?:)?\/\//, 'a remote URL'],
]

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Forbidden imports in portal pages and components' },
    schema: [],
    messages: { imp: 'Import "{{source}}" is not allowed: {{why}}.' },
  },
  create(context) {
    const inShell = relFile(context).startsWith('src/shells/')
    const check = (node, source) => {
      if (typeof source !== 'string') return
      for (const [re, why] of BAD)
        if (re.test(source)) return context.report({ node, messageId: 'imp', data: { source, why } })
      if (!inShell && /^(?:@|\/src)\/shells(?:\/|$)/.test(source))
        return context.report({
          node,
          messageId: 'imp',
          data: { source, why: 'shells are imported only by the shell itself' },
        })
      if (!/^(?:@|\/src)\/ds(?:\/|$)/.test(source) && LOCAL_KIT_IMPORT_RE.test(source))
        context.report({
          node,
          messageId: 'imp',
          data: { source, why: 'a module-local copy of a Ds kit (use the Ds component)' },
        })
    }
    return {
      ImportDeclaration: (n) => check(n, n.source.value),
      ExportAllDeclaration: (n) => check(n, n.source.value),
      ExportNamedDeclaration: (n) => n.source && check(n, n.source.value),
      ImportExpression: (n) => n.source.type === 'Literal' && check(n, n.source.value),
    }
  },
}
