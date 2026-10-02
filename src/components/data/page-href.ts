export type PagerQueryValue = string | number | boolean | null | undefined | readonly string[]

/**
 * Href of a pager link: the other query values are kept in their given order (empty ones are
 * dropped, as Laravel `withQueryString()` links on live), the page parameter (`page`, or `pageParam` for pages with two lists, M04 S11) goes last (M09 E2E-17:
 * `?category=TIPS_BELAJAR&page=1`). Arrays become `key[]=v` pairs.
 *
 * `path` must not contain `?` or `#`: pass the bare pathname and put filters in `query`.
 */
export function pageHref(
  path: string,
  query: Readonly<Record<string, PagerQueryValue>> | undefined,
  page: number,
  pageParam = 'page',
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (key === pageParam || value === null || value === undefined || value === '') continue
    if (Array.isArray(value)) {
      for (const v of value) params.append(`${key}[]`, v)
    } else {
      params.append(key, String(value))
    }
  }
  params.set(pageParam, String(page))
  return `${path}?${params.toString()}`
}
