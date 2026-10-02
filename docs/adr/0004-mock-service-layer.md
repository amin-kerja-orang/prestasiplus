# ADR-0004: In-process, HTTP-shaped mock service layer behind a swappable transport

- **Status:** Proposed
- **Date:** 2026-09-25

## Context
D1/D2 require the prototype to talk to a mock that is shaped like the future REST API, so that a real backend can replace it without UI rewrites. Module SRSs define endpoints as `METHOD /api/...` with the envelope and error conventions of master SRS §7. The mock must also:
- enforce auth and roles (401/403);
- run business rules;
- simulate latency so loading states are observable;
- inject faults for error-state tests;
- be deterministic for E2E on 3 viewports;
- ship in the **demo build**, because the prototype itself is the deliverable.

## Decision
- The UI calls typed module API functions → `ApiClient` → a `Transport` interface (`request(method, url, query, body, headers) → {status, headers, body}`).
- **`MockTransport`** dispatches **in-process** to a mock router of `METHOD /api/path/:param` routes. It applies latency, fault injection and a request log. Handlers return HTTP-shaped responses (status codes, envelope, error body).
- **`HttpTransport`** (fetch) is the backend-phase implementation. `bootstrap.ts` selects the transport from `VITE_API_MODE`. The mock is dynamically imported, so it is absent from `http` builds.
- Handlers live in their module (`src/modules/mXX/mock/handlers`), one file per resource (NFR-07). Shared mechanics live in `src/mock` (router, responders, auth middleware, validation helper, stores, seeds, clock, hooks).
- Live-shaped non-envelope responses that SRSs keep on purpose (`{ok, message}`, bare arrays) are returned raw, and the client reads them with `raw: true`.

## Alternatives considered
- **MSW (Mock Service Worker):** real `fetch` and network-tab visibility, but it needs a service worker in the demo build (registration and first-load races, and caching surprises in stakeholder browsers). It adds async hops, and it complicates Playwright (service workers vs. `page.route`). The in-process transport gives the same REST contract with less machinery. The transport seam can still host MSW later if wanted.
- **json-server or a local Node mock server:** an extra process to deploy for the demo, and it cannot be hosted as a static site. Business rules would end up split between server and client.
- **Direct function calls without HTTP shape:** faster to write, but it drifts from the REST contract and fails D2.

## Consequences
- The demo is a static site. No server is needed.
- The backend swap is one transport, with the contract types unchanged.
- The "network" is not visible in DevTools. The request log and `lastRequest` hook fill that gap for tests.

## Amendment 1 (2026-09-26, overview v1.2 §6.2)
The client surface as built by F-04:
- **`api.raw(method, url, body?, opts)`** returns `{status, headers, body}` for every HTTP status, with no envelope unwrap and no `ApiError` mapping. It rejects only on a network failure or an abort. It uses the same transport and keeps the Bearer token and the 401 policy. It is the documented exception for live bodies without an envelope, and it resolves M13 SQ-M13-01 (`POST /api/cikgu/send`). This is different from the `raw: true` option, which returns the 2xx body untouched but still maps errors to `ApiError`.
- Also built: the `responseType` option (`'json' | 'blob'`), the helpers `api.list`, `api.multipart` and `api.blob` (`{blob, filename}` from `Content-Disposition`), and array query values encoded as repeated keys (`ids=1&ids=2`, no `[]`).
