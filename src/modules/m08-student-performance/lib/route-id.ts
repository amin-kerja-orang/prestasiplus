/**
 * A route-param id for an API call. Mock ids are numbers; on the real API (BE-19) ids are opaque
 * strings (`IdSchema`) that must not go through `Number()`. Mock mode keeps the number.
 */

import { isHttpMode } from '@/api/mode'

export const routeId = (param: unknown): number | string =>
  isHttpMode() ? String(param) : Number(param)
