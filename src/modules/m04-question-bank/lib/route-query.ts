/** Reading the URL query of the M04 list pages (the query string is the page state). */

import type { LocationQueryValue } from 'vue-router'

export type QueryValue = LocationQueryValue | LocationQueryValue[] | undefined

/** The first value of a query key as text ("" when absent). */
export function queryText(value: QueryValue): string {
  const first = Array.isArray(value) ? value[0] : value
  return first ?? ''
}

/** A 1-based page number from the query (anything invalid is page 1). */
export function pageOf(value: QueryValue): number {
  return Math.max(1, Number.parseInt(queryText(value), 10) || 1)
}
