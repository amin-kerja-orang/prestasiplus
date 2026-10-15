// Stylelint config for design-system strict files (V2-T04; guard rules G-3b and G-7).
// It is NOT run over the whole repo: `scripts/lint-ds-css.mjs` feeds it only the css/vue files
// matched by config/ds-strict.json (minus its `exempt` list, which holds src/theme/** where
// tokens.css and the ui config are the only places allowed to define colours and lines).
/** @type {import('stylelint').Config} */
export default {
  overrides: [{ files: ['**/*.vue'], customSyntax: 'postcss-html' }],
  rules: {
    // G-7: colours are decided in tokens.css only.
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': [
      [
        'rgb',
        'rgba',
        'hsl',
        'hsla',
        'hwb',
        'lab',
        'lch',
        'oklab',
        'oklch',
        'color',
        'color-mix',
        // Gradients live inside component variants (G-3).
        '/gradient$/',
      ],
      {
        message:
          'Colour functions and gradients are forbidden outside tokens.css (G-3, G-7). Use a token variable.',
      },
    ],
    // G-3b: no lines. Borders and outlines do not exist in this design system.
    'property-disallowed-list': [
      ['/^border/', '/^outline/'],
      { message: 'border*/outline* are forbidden outside tokens.css and the ui config (G-3b).' },
    ],
    'declaration-no-important': true,
  },
}
