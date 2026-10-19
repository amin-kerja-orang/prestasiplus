/**
 * The only thing a conformance scenario may touch (BE-31, AC7). An adapter turns it into a real
 * transport: the frontend mock (`mock/mock-client.ts`), supertest against Nest (after BE-03), or
 * `fetch` against a running server.
 *
 * Paths are relative to the contract server base (`openapi.json` `servers[0].url`, i.e. `/api`):
 * write `/articles`, never `/api/articles`. The adapter adds the base. A query string may be part
 * of the path. Header names are lower-case on the way out and on the way in. A transport never
 * throws for an HTTP error status; it rejects only when there is no response at all.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface HttpRequestInit {
  /** JSON-serialisable value; `undefined` means no body. */
  body?: unknown
  /**
   * One multipart/form-data file part (instead of a JSON body). Only targets that can send files
   * support it (the NestJS adapter does; the mock adapter ignores it), so a scenario that uses it
   * is declared `targets: ['api']`.
   */
  file?: { field: string; filename: string; contentType: string; content: Uint8Array }
  headers?: Record<string, string>
}

export interface HttpResponse {
  status: number
  /** Lower-case names. Several `set-cookie` values are joined with a newline. */
  headers: Record<string, string>
  /** Parsed JSON, or `null` for an empty body (204). */
  body: unknown
}

export interface HttpClient {
  request(method: HttpMethod, path: string, init?: HttpRequestInit): Promise<HttpResponse>
}

/** The roles a scenario can ask for. Each target maps them to seeded accounts. */
export type ActorRole =
  'student' | 'teacher' | 'school_admin' | 'ppd_officer' | 'jpn_officer' | 'admin'

export interface ActorOptions {
  /** `false`: the same session but no `X-CSRF-Token` header on writes (for `CSRF_INVALID` scenarios). Ignored by targets with no CSRF (the mock). */
  csrf?: boolean
  /** Set by the runner: a client the actor's login must go through, so the login response is contract-checked. */
  via?: HttpClient
}

/** What a run is pointed at: an anonymous client plus a way to get an authenticated one. */
export interface Target {
  /** Human label for reports, for example `mock` or `api`. */
  name: string
  /** A client with no credentials. */
  anonymous: HttpClient
  /** A client that carries the session of a seeded account of this role. */
  actor(role: ActorRole, opts?: ActorOptions): Promise<HttpClient>
  /** Login credentials of the seeded account of this role (for the auth scenarios). */
  credentials(role: ActorRole): { identifier: string; password: string }
  /**
   * Whether the target serves this operation yet. A scenario that sends a request to an operation
   * the target does not serve is reported as "not yet implemented" (never as a failure) and the
   * request is not sent. Omitted: every operation counts as served (the mock).
   */
  implements?(op: { key: string; method: HttpMethod; path: string }): boolean
  /** Called before each scenario; the API target uses it to give the scenario its own client address (throttles). */
  beginScenario?(id: string): void
}
