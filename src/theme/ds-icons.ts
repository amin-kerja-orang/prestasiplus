import { learnIconNames } from './learn-icons.ts'

/**
 * Phosphor base names that `DsIcon` may build at run time (`i-ph-<name>`, `i-ph-<name>-duotone`,
 * `i-ph-<name>-bold`). The icon bundler only finds literal `i-ph-*` strings, so every base name
 * used through `DsIcon` is listed here and added to `iconBundle` (vite.config). Add a name here when
 * a composite or page starts using it. Weights per design system 10.1: learner Duotone, staff
 * Regular, Bold for tiny status glyphs.
 */
export const dsIconBaseNames = [
  'arrow-right',
  'book-open',
  'caret-down',
  'caret-up-down',
  'gear',
  'list',
  'pulse',
  'squares-four',
  'student',
  'user-circle',
  'wallet',
  'books',
  'book-open-text',
  'calculator',
  'chalkboard-teacher',
  'chart-line-up',
  'check',
  'coins',
  'dots-three-circle',
  'fire',
  'flask',
  'game-controller',
  'gift',
  'graduation-cap',
  'house',
  'lightbulb',
  'lightning',
  'moon',
  'pencil-simple-line',
  'rocket-launch',
  'scroll',
  'share-network',
  'sparkle',
  'star',
  'sun',
  'translate',
  'trophy',
  'tray',
  'users',
  'x',
  'funnel',
  'warning-circle',
  'warning',
  'warning-octagon',
  'dots-three',
  'pencil-simple',
  'trash',
  'eye',
  'check-circle',
  'x-circle',
  'minus-circle',
  'hourglass',
  'clock',
  'upload-simple',
  'spinner-gap',
  'shield-check',
  'arrow-up',
  'arrow-down',
  'minus',
  'magnifying-glass',
  'caret-right',
  'info',
  'broadcast',
] as const

export const dsIconWeights = ['regular', 'duotone', 'bold'] as const
export type DsIconWeight = (typeof dsIconWeights)[number]

export const dsIconWeightSuffix: Record<DsIconWeight, string> = {
  regular: '',
  duotone: '-duotone',
  bold: '-bold',
}

/** Every `i-ph-*` class the `DsIcon` name space can produce. */
export const dsIconClasses: string[] = dsIconBaseNames.flatMap((name) =>
  dsIconWeights.map((w) => `i-ph-${name}${dsIconWeightSuffix[w]}`),
)

/**
 * Pembelajaran menu glyphs (`learn-icons.ts`): only the two weights the menu uses (learner Duotone,
 * staff Regular), so the offline bundle stays under the Nuxt Icon size limit.
 */
export const learnIconClasses: string[] = learnIconNames.flatMap((name) => [
  `i-ph-${name}`,
  `i-ph-${name}-duotone`,
])
