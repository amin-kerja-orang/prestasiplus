// R8 pp/ds-no-local-kit: a module-local component whose template root is DsPanel / DsSurface / UCard
// and that only titles or wraps a slot or a list is a copy of a Ds kit (the *Panel, *Card(s),
// *Picker, *Block, *Kpis family the name-based test cannot see). Exempt: files listed in
// config/ds-domain-widgets.json (owner + reason). Pages (`*Page.vue`) are not kits.
import { readDomainWidgets } from '../ds-admin-data.mjs'
import { childElements, componentName, relFile, templateRoot } from '../lib/vue-helpers.mjs'

const WRAPPERS = new Set(['DsPanel', 'DsSurface', 'UCard'])
const TITLE_ONLY = new Set(['DsText', 'DsHeading', 'DsIcon'])

export default {
  meta: {
    type: 'problem',
    docs: { description: 'No module-local copies of DsPanel / DsSurface wrappers' },
    schema: [{ type: 'object', properties: { widgets: { type: 'array' } }, additionalProperties: false }],
    messages: {
      kit: 'This component only wraps a slot or list in <{{root}}>. Use the Ds component directly, or list it in config/ds-domain-widgets.json (owner + reason).',
    },
  },
  create(context) {
    const widgets = new Set(context.options[0]?.widgets ?? readDomainWidgets())
    const file = relFile(context)
    if (/Page\.vue$/.test(file) || widgets.has(file)) return {}
    return {
      Program() {
        const tpl = templateRoot(context)
        if (!tpl) return
        const roots = childElements(tpl)
        if (roots.length !== 1) return
        const root = roots[0]
        const name = componentName(root)
        if (!name || !WRAPPERS.has(name)) return
        const kids = childElements(root).filter((c) => !TITLE_ONLY.has(componentName(c) ?? ''))
        const hasSlot = kids.some((k) => k.name === 'slot')
        const onlyWraps = kids.every((k) => k.name === 'slot' || k.name === 'template')
        const listOnly =
          kids.length === 1 &&
          kids[0].startTag.attributes.some((a) => a.directive && a.key.name?.name === 'for')
        if ((hasSlot && onlyWraps) || listOnly)
          context.report({ loc: root.loc, messageId: 'kit', data: { root: name } })
      },
    }
  },
}
