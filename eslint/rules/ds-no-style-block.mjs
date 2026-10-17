// pp/ds-no-style-block: no `<style>` blocks in strict `.vue` files (G-4). Visual decisions live in
// tokens.css and the Nuxt UI theme config.
export default {
  meta: {
    type: 'problem',
    docs: { description: 'No <style> blocks in strict files' },
    schema: [],
    messages: {
      style:
        '`<style>` blocks are forbidden in design-system files (G-4). Use components and token utilities.',
    },
  },
  create(context) {
    const fragment = context.sourceCode.parserServices?.getDocumentFragment?.()
    return {
      Program() {
        if (!fragment) return
        for (const child of fragment.children) {
          if (child.type === 'VElement' && child.name === 'style')
            context.report({ loc: child.loc, messageId: 'style' })
        }
      },
    }
  },
}
