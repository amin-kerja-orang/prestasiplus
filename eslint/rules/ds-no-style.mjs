// R4 pp/ds-no-style: no `style=`, `:style=`, `<style>` or `<style scoped>` in a portal file (extends
// ds-no-inline-style and ds-no-style-block).
import { attrInfo, visit } from '../lib/vue-helpers.mjs'

export default {
  meta: {
    type: 'problem',
    docs: { description: 'No inline style or <style> blocks in portal files' },
    schema: [],
    messages: {
      inline: 'Inline style is not allowed. Use a Ds component prop (tone, accent, size) or a token.',
      block: '<style> blocks are not allowed. Visual decisions live in src/ds and the theme.',
    },
  },
  create(context) {
    const fragment = context.sourceCode.parserServices?.getDocumentFragment?.()
    const templateVisitor = {
      VAttribute(node) {
        const info = attrInfo(node)
        if (info.name === 'style' && (info.kind === 'static' || info.kind === 'bind'))
          context.report({ node, messageId: 'inline' })
      },
    }
    const base = visit(context, templateVisitor, {})
    return {
      ...base,
      Program() {
        for (const child of fragment?.children ?? [])
          if (child.type === 'VElement' && child.name === 'style')
            context.report({ loc: child.loc, messageId: 'block' })
      },
    }
  },
}
