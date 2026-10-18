/** Shared prop types of the composites. Copy (BM) is always passed in by the caller. */

/** Meaning colour of a chip, tile or card (design system 3.3). */
export type DsAccent = 'action' | 'win' | 'heat' | 'friend' | 'trial'

/** Mood of the virtual friend (design system 10.3). */
export type FriendMood = 'neutral' | 'happy' | 'encouraging' | 'celebrating'

/** State of a quiz option (design system 6, "Quiz option"). */
export type QuizOptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed'

/** Semantic colour (success, warning, error, info). `tone` always means this. */
export type DsTone = 'success' | 'warning' | 'error' | 'info'

/** Colour of a figure; replaces the `valueClass` escape hatch (R2). */
export type DsValueTone = 'highlighted' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'muted'

/** Table density (R4): `compact` replaces the old `compactCells` boolean. */
export type DsTableDensity = 'cozy' | 'tight' | 'compact'

/** Tile density (R4): replaces the exclusive `compact` / `roomy` booleans. */
export type DsTileDensity = 'default' | 'compact' | 'roomy'

/**
 * Phosphor base name (`fire`); the weight is decided by the personality. The generated union from
 * `src/theme/ds-icons.ts` is applied at T-Z; until then it is a string so every caller compiles.
 */
export type DsIconName = string

/** Deprecated full class form (`i-ph-fire-duotone`), accepted for one release. */
export type DsLegacyIconClass = `i-${string}`

/** Prop type of every `icon` prop: a base name, or the legacy class for one release. */
export type DsIconProp = DsIconName

/** Heading level of a component title. */
export type DsHeadingLevel = 2 | 3
