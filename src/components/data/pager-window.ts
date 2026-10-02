/**
 * Laravel `LengthAwarePaginator` window (`UrlWindow`, `onEachSide = 3`) and summary numbers.
 * Sources: overview §9 `LaravelPager`; M05 SRS §8.1; M09 BR-M09-32; M01 FR-M01-57.
 *
 * - `lastPage < 14` (onEachSide * 2 + 8): every page, no gaps.
 * - `current <= 7`: 1..10, gap, last two ("1 ... 10 ... 94 95").
 * - `current > last - 7`: first two, gap, last ten.
 * - otherwise: first two, gap, current - 3 .. current + 3, gap, last two.
 */
export const ON_EACH_SIDE = 3

export type PagerItem = { kind: 'page'; page: number } | { kind: 'gap' }

function range(from: number, to: number): number[] {
  const out: number[] = []
  for (let n = from; n <= to; n++) out.push(n)
  return out
}

export function pagerWindow(current: number, last: number): PagerItem[] {
  const pages = (list: number[]): PagerItem[] => list.map((page) => ({ kind: 'page', page }))
  const gap: PagerItem = { kind: 'gap' }
  if (last < ON_EACH_SIDE * 2 + 8) return pages(range(1, last))
  const window = ON_EACH_SIDE + 4
  if (current <= window) {
    return [...pages(range(1, window + ON_EACH_SIDE)), gap, ...pages([last - 1, last])]
  }
  if (current > last - window) {
    return [...pages([1, 2]), gap, ...pages(range(last - (window + ON_EACH_SIDE - 1), last))]
  }
  return [
    ...pages([1, 2]),
    gap,
    ...pages(range(current - ON_EACH_SIDE, current + ON_EACH_SIDE)),
    gap,
    ...pages([last - 1, last]),
  ]
}

export interface PagerNumbers {
  lastPage: number
  /** Items on the current page (0 when the page is beyond the last). */
  count: number
  /** 1-based first / last item position, or null when the page has no items. */
  from: number | null
  to: number | null
}

export function pagerNumbers(total: number, perPage: number, page: number): PagerNumbers {
  const safeTotal = Math.max(0, Math.floor(total) || 0)
  const safePer = Math.max(1, Math.floor(perPage) || 1)
  const lastPage = Math.max(1, Math.ceil(safeTotal / safePer))
  const safePage = Math.max(1, Math.floor(page) || 1)
  const offset = (safePage - 1) * safePer
  const count = Math.max(0, Math.min(safePer, safeTotal - offset))
  return {
    lastPage,
    count,
    from: count > 0 ? offset + 1 : null,
    to: count > 0 ? offset + count : null,
  }
}
