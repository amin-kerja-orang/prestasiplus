/**
 * The JSON body limit the app runs with on every route that has no larger parser of its own: Nest's default
 * body-parser limit (100kb). configure-app.ts only adds larger parsers (import, content routes); it never lowers this one.
 * The error filter reads it for the `{n}` of a 413 that does not say which limit applied.
 */
export const DEFAULT_JSON_LIMIT_BYTES = 100 * 1024
