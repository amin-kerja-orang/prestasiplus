import type { LocationQueryValue } from 'vue-router'

/** First value of a route query parameter as a string ("" when absent). */
export function queryString(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first : ''
}
