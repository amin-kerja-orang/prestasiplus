// Stylelint config for design-system strict files (V2-T04; guard rules G-3b, G-7, G-12).
// It is NOT run over the whole repo: `scripts/lint-ds-css.mjs` feeds it only the css/vue files
// matched by config/ds-strict.json (minus its `exempt` list, which holds src/theme/** where
// tokens.css and the ui config are the only places allowed to define colours and lines).
// Two levels, like ESLint: `page` (default export) and `ds` (composites; colour-mix and gradient
// functions are allowed because the colour arguments are still checked, so only tokens fit).

const COLOUR_FNS = ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color']

/** @param {'page' | 'ds'} level @returns {import('stylelint').Config} */
export function createConfig(level) {
  const isDs = level === 'ds'
  return {
    overrides: [{ files: ['**/*.vue'], customSyntax: 'postcss-html' }],
    rules: {
      // G-7: colours are decided in tokens.css only.
      'color-no-hex': true,
      'color-named': 'never',
      'function-disallowed-list': [
        isDs ? COLOUR_FNS : [...COLOUR_FNS, 'color-mix', '/gradient$/'],
        {
          message: isDs
            ? 'Colour functions are forbidden outside tokens.css (G-7). Use a token variable.'
            : 'Colour functions and gradients are forbidden outside tokens.css (G-3, G-7). Use a token variable.',
        },
      ],
      // G-3b: no lines. Borders and outlines do not exist in this design system.
      'property-disallowed-list': [
        ['/^border/', '/^outline/'],
        { message: 'border*/outline* are forbidden outside tokens.css and the ui config (G-3b).' },
      ],
      // G-12: nothing is fetched from a remote host.
      'function-url-scheme-disallowed-list': [
        ['/^https?$/', 'ftp', '/^$/'],
        { message: 'Remote url(...) is forbidden (G-12); ship the asset in the repo.' },
      ],
      'at-rule-disallowed-list': [
        ['import'],
        {
          message: '@import is forbidden in strict files (G-12); the theme loads fonts and tokens.',
        },
      ],
      'declaration-no-important': true,
    },
  }
}

export default createConfig('page')
export const dsConfig = createConfig('ds')
