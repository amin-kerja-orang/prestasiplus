/**
 * Literal class lookup tables shared by the layout primitives. Tailwind and the class allowlist
 * need to see whole class names, so nothing here is built by string concatenation.
 */
import type { DsBreakpoint, DsCardPadding, DsCols, DsPadding, DsResponsive, DsSpace } from './types'

export const gapAll: Record<DsSpace, string> = {
  none: 'gap-0',
  '2xs': 'gap-1',
  xs: 'gap-2',
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
  '2xl': 'gap-10',
  section: 'gap-5 md:gap-6 learner:lg:gap-8',
}
export const gapX: Record<DsSpace, string> = {
  none: 'gap-x-0',
  '2xs': 'gap-x-1',
  xs: 'gap-x-2',
  sm: 'gap-x-3',
  md: 'gap-x-4',
  lg: 'gap-x-6',
  xl: 'gap-x-8',
  '2xl': 'gap-x-10',
  section: 'gap-x-5 md:gap-x-6 learner:lg:gap-x-8',
}
export const gapY: Record<DsSpace, string> = {
  none: 'gap-y-0',
  '2xs': 'gap-y-1',
  xs: 'gap-y-2',
  sm: 'gap-y-3',
  md: 'gap-y-4',
  lg: 'gap-y-6',
  xl: 'gap-y-8',
  '2xl': 'gap-y-10',
  section: 'gap-y-5 md:gap-y-6 learner:lg:gap-y-8',
}
export const paddingUtil: Record<DsPadding, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
}
/** Card body padding at every width (the responsive twin overrides the theme's `sm:p-5`). */
export const cardBodyPadding: Record<DsCardPadding, string> = {
  none: 'p-0 sm:p-0',
  sm: 'p-3 sm:p-3',
  md: 'p-4 sm:p-4',
}
export const alignUtil = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  baseline: 'items-baseline',
  stretch: 'items-stretch',
} as const
export const justifyUtil = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const

type Bp = 'base' | DsBreakpoint
type Start = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

function resolve<T extends string | number>(
  value: T | DsResponsive<T> | undefined,
  table: Record<Bp, Record<T, string>>,
): string[] {
  if (value === undefined) return []
  const map: DsResponsive<T> = typeof value === 'object' ? value : { base: value }
  const out: string[] = []
  for (const bp of ['base', 'sm', 'md', 'lg', 'xl'] as const) {
    const v = map[bp]
    if (v !== undefined) out.push(table[bp][v])
  }
  return out
}

const COLS: Record<Bp, Record<DsCols, string>> = {
  base: { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6', 12: 'grid-cols-12' },
  sm: { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5', 6: 'sm:grid-cols-6', 12: 'sm:grid-cols-12' },
  md: { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6', 12: 'md:grid-cols-12' },
  lg: { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6', 12: 'lg:grid-cols-12' },
  xl: { 1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5', 6: 'xl:grid-cols-6', 12: 'xl:grid-cols-12' },
}
const SPAN: Record<Bp, Record<DsCols, string>> = {
  base: { 1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4', 5: 'col-span-5', 6: 'col-span-6', 12: 'col-span-12' },
  sm: { 1: 'sm:col-span-1', 2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4', 5: 'sm:col-span-5', 6: 'sm:col-span-6', 12: 'sm:col-span-12' },
  md: { 1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4', 5: 'md:col-span-5', 6: 'md:col-span-6', 12: 'md:col-span-12' },
  lg: { 1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4', 5: 'lg:col-span-5', 6: 'lg:col-span-6', 12: 'lg:col-span-12' },
  xl: { 1: 'xl:col-span-1', 2: 'xl:col-span-2', 3: 'xl:col-span-3', 4: 'xl:col-span-4', 5: 'xl:col-span-5', 6: 'xl:col-span-6', 12: 'xl:col-span-12' },
}
const START: Record<Bp, Record<Start, string>> = {
  base: { 1: 'col-start-1', 2: 'col-start-2', 3: 'col-start-3', 4: 'col-start-4', 5: 'col-start-5', 6: 'col-start-6', 7: 'col-start-7', 8: 'col-start-8', 9: 'col-start-9', 10: 'col-start-10', 11: 'col-start-11', 12: 'col-start-12' },
  sm: { 1: 'sm:col-start-1', 2: 'sm:col-start-2', 3: 'sm:col-start-3', 4: 'sm:col-start-4', 5: 'sm:col-start-5', 6: 'sm:col-start-6', 7: 'sm:col-start-7', 8: 'sm:col-start-8', 9: 'sm:col-start-9', 10: 'sm:col-start-10', 11: 'sm:col-start-11', 12: 'sm:col-start-12' },
  md: { 1: 'md:col-start-1', 2: 'md:col-start-2', 3: 'md:col-start-3', 4: 'md:col-start-4', 5: 'md:col-start-5', 6: 'md:col-start-6', 7: 'md:col-start-7', 8: 'md:col-start-8', 9: 'md:col-start-9', 10: 'md:col-start-10', 11: 'md:col-start-11', 12: 'md:col-start-12' },
  lg: { 1: 'lg:col-start-1', 2: 'lg:col-start-2', 3: 'lg:col-start-3', 4: 'lg:col-start-4', 5: 'lg:col-start-5', 6: 'lg:col-start-6', 7: 'lg:col-start-7', 8: 'lg:col-start-8', 9: 'lg:col-start-9', 10: 'lg:col-start-10', 11: 'lg:col-start-11', 12: 'lg:col-start-12' },
  xl: { 1: 'xl:col-start-1', 2: 'xl:col-start-2', 3: 'xl:col-start-3', 4: 'xl:col-start-4', 5: 'xl:col-start-5', 6: 'xl:col-start-6', 7: 'xl:col-start-7', 8: 'xl:col-start-8', 9: 'xl:col-start-9', 10: 'xl:col-start-10', 11: 'xl:col-start-11', 12: 'xl:col-start-12' },
}

export const colsClasses = (v: DsCols | DsResponsive<DsCols> | undefined): string[] => resolve(v, COLS)
export const spanClasses = (v: DsCols | DsResponsive<DsCols> | undefined): string[] => resolve(v, SPAN)
export const startClasses = (v: DsResponsive<Start> | undefined): string[] => resolve(v, START)

/**
 * Auto-fit / auto-fill tracks. Token gap: the spec wants theme `@utility grid-fit-*` (src/theme is
 * owned by T-H0); until then these literal arbitrary tracks stand in (xs 9rem ... xl 24rem).
 */
export const minItemUtil = {
  fit: {
    xs: 'grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]',
    sm: 'grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]',
    md: 'grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]',
    lg: 'grid-cols-[repeat(auto-fit,minmax(20rem,1fr))]',
    xl: 'grid-cols-[repeat(auto-fit,minmax(24rem,1fr))]',
  },
  fill: {
    xs: 'grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]',
    sm: 'grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]',
    md: 'grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]',
    lg: 'grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]',
    xl: 'grid-cols-[repeat(auto-fill,minmax(24rem,1fr))]',
  },
} as const
