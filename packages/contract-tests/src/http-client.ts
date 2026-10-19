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

/** What a run is pointed at: an anonymous client plus a way to get an authenticated one. */
export interface Target {
  /** Human label for reports, for example `mock` or `api`. */
  name: string
  /** A client with no credentials. */
  anonymous: HttpClient
  /** A client that carries the session of a seeded account of this role. */
  actor(role: ActorRole): Promise<HttpClient>
  /** Login credentials of the seeded account of this role (for the auth scenarios). */
  credentials(role: ActorRole): { identifier: string; password: string }
}
