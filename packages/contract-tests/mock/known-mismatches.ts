import type { KnownMismatch } from '../src/runner'

/**
 * Mismatches between the frontend mock and the merged contracts that the first harness run found
 * (BE-31). They are tracked here and reported apart; fixing one on the mock side makes its entry
 * stale and the test fails until the entry is removed. The runner never edits the mock or the
 * contract to make a scenario pass.
 *
 * Not listed because the adapter maps them (`withWireMapping`, ADR-0018 item 6): numeric ids vs
 * string ids, and `Z` instants vs `+08:00`. Run with `MOCK_RAW=1` to see them.
 */
const NO_SESSION_ROUTE =
  'Mock side: no GET /api/session route (the mock exposes /api/me; the contract defines one-call GET /session).'
const NO_BIJAK =
  'Mock side: no Bijak SPM (M28) routes under /api/bijak/*; the module has no mock. Contract routes come from BE-15 / BE-16.'

const NO_PARENT_LINKS =
  'Mock side: no GET /api/me/parent-links route (404); the contract defines it.'

const NO_FILES =
  'Mock side: no /api/files route (404); file storage is a backend service (BE-04) and the mock keeps pictures inline.'
const NO_BUILDER =
  'Mock side: no Bijak paper builder / blueprint admin routes (404); the contract routes come from BE-37 to BE-39.'

export const KNOWN_MISMATCHES: KnownMismatch[] = [
  { scenario: 'files/POST /files anonymous -> 401', reason: NO_FILES },
  {
    scenario: 'schools/GET /admin/schools -> 200',
    reason:
      'Mock side: the admin school rows carry no joinCode; the contract (BE-05) requires the key (string or null).',
  },
  {
    scenario: 'users/GET /admin/users -> 200',
    reason:
      'Mock side: the user rows carry no username, no roles[] and no isSuspended; the contract (BE-05, v2-frontend section 6) requires them.',
  },
  { scenario: 'bijak-builder/GET /admin/papers -> 200', reason: NO_BUILDER },
  { scenario: 'bijak-builder/GET /admin/papers anonymous -> 401', reason: NO_BUILDER },
  { scenario: 'bijak-builder/GET /admin/papers as student -> 403', reason: NO_BUILDER },
  { scenario: 'bijak-blueprint-admin/GET /admin/blueprints -> 200', reason: NO_BUILDER },
  { scenario: 'bijak-blueprint-admin/GET /admin/blueprints anonymous -> 401', reason: NO_BUILDER },
  { scenario: 'bijak-blueprint-admin/GET /admin/blueprints as student -> 403', reason: NO_BUILDER },
  {
    scenario: 'auth/POST /auth/login -> 200',
    reason:
      'Mock side: login body is { email, password, remember } and the answer is { data: { token, expiresAt, user } } (Bearer, no cookie, no csrf). The contract body is { identifier, password, remember } and the answer is a Session. The mock answers 422 to the contract body.',
  },
  {
    scenario: 'auth/POST /auth/login wrong password -> 401',
    reason:
      'Mock side: same body-shape difference as above (identifier vs email), so 422 instead of 401.',
  },
  { scenario: 'auth/GET /session anonymous -> 401', reason: NO_SESSION_ROUTE },
  { scenario: 'auth/GET /session as student -> 200', reason: NO_SESSION_ROUTE },
  { scenario: 'session/GET /session -> 200', reason: NO_SESSION_ROUTE },
  { scenario: 'session/GET /session anonymous -> 401', reason: NO_SESSION_ROUTE },
  { scenario: 'bijak-papers/GET /bijak/papers -> 200', reason: NO_BIJAK },
  { scenario: 'bijak-papers/GET /bijak/papers anonymous -> 401', reason: NO_BIJAK },
  { scenario: 'bijak-papers/GET /bijak/papers as teacher -> 403', reason: NO_BIJAK },
  { scenario: 'bijak-attempts/GET /bijak/history -> 200', reason: NO_BIJAK },
  { scenario: 'bijak-attempts/GET /bijak/history anonymous -> 401', reason: NO_BIJAK },
  { scenario: 'bijak-attempts/GET /bijak/history as teacher -> 403', reason: NO_BIJAK },
  {
    scenario: 'command-center-guru/GET /guru/command-center/live-data -> 200',
    reason:
      'Documented in the contract (guru.ts educationLevel): the mock emits slugs "tahun-1".."tingkatan-5", the contract wants DARJAH_1..TINGKATAN_5. A mapping belongs to the mock adapter or the mock handler (BE-22).',
  },
  {
    scenario: 'account/GET /me -> 200',
    reason:
      'Mock side: GET /api/me answers the prototype user shape; the contract (BE-04) requires data.username and data.roles (array), both missing in the mock.',
  },
  {
    scenario: 'parent-invites/GET /me/parent-invite -> 200',
    reason:
      'Mock side: the mock invite payload lacks hasToken, expiresAt and parents[].linkId / emailMasked / relationship as the contract defines them.',
  },
  { scenario: 'parent-links/GET /me/parent-links -> 200', reason: NO_PARENT_LINKS },
  { scenario: 'parent-links/GET /me/parent-links anonymous -> 401', reason: NO_PARENT_LINKS },
  { scenario: 'parent-links/GET /me/parent-links as student -> 403', reason: NO_PARENT_LINKS },
  {
    scenario: 'comp-students/GET /admin/comp-students -> 200',
    reason:
      'Mock side: data[].icMasked does not match the contract schema (the mock value format differs from the masked-IC rule of the contract).',
  },
]
