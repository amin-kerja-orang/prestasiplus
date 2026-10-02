/**
 * What module mock code imports from the mock core (overview §4, §6.4, §6.10): the plugin type and
 * `defineMockModule`, `defineTable` (implemented in `./db/table.ts`, F-05), id strategies, route
 * helpers, responders, pagination, validation and the auth guards.
 *
 * ```ts
 * import { defineMockModule, defineTable, maxPlusOne, route, int, ok, notFound, requireAuth } from '@/mock/define'
 * ```
 */

// Plugin type and definition (the real type behind `src/mock/registry.ts`'s structural `{ id }`).
export {
  defineMockCore,
  defineMockModule,
  type MockCore,
  type MockCoreDef,
  type MockDatasetLike,
  type MockHook,
  type MockModule,
  type MockModuleDef,
  type MockModuleId,
  type MockPlugin,
  type MockPluginId,
  type SeedContext,
} from './server/plugin'

// Storage (F-05).
export { defineTable, type Table, type TableDef } from './db/table'
export { floor, maxPlusOne, opaque, sequence, uuid } from './db/id-strategies'
export { ID_RANGES } from './db/id-ranges'
export type { Store, Where } from './db/store'

// Routing and handlers.
export {
  int,
  route,
  str,
  type ParamParser,
  type RouteDef,
  type RouteOptions,
} from './server/router'
export type {
  Handler,
  Middleware,
  MockContext,
  MockParams,
  MockQuery,
  MockRequest,
  MockResponse,
} from './server/types'
export {
  abort,
  blob,
  conflict,
  created,
  DEFAULT_ERROR_MESSAGES,
  fail,
  forbidden,
  list,
  MockHttpError,
  noContent,
  notFound,
  ok,
  rateLimited,
  raw,
  serverError,
  unauthorized,
  validationError,
} from './server/respond'
export { pageMeta, pageParams, paged, paginate, unpaged, type PageRequest } from './server/paginate'
export { queryInt, queryIntList, queryList, queryString } from './server/request'
export {
  assertValid,
  confirmed,
  email,
  exists,
  isIn,
  max,
  min,
  oneOf,
  required,
  rule,
  unique,
  validate,
  validationErrors,
  type RuleSet,
  type ValidationRule,
} from './server/validate'

// Auth guards.
export {
  requireAuth,
  requireOwner,
  requireRole,
  type MockRole,
  type MockSession,
  type SessionResolver,
} from './auth/middleware'
