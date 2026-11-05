import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf } from './envelope'
import { ErrorBodySchema } from './error'

/**
 * Kawalan Ciri (S0-T10, DM-34, API-ADM-09, API-AUTH-16). Server-side feature flags: the admin list/toggle,
 * the API `FeatureGuard` and the `features` map of `GET /api/session`. S0-T11 completes the 32 keys.
 */

export const FEATURE_AUDIENCES = ['pelajar', 'guru'] as const
export const FeatureAudienceSchema = z.enum(FEATURE_AUDIENCES).meta({ id: 'FeatureAudience' })
export type FeatureAudience = z.infer<typeof FeatureAudienceSchema>

/** One row of `GET /api/admin/feature-toggles`. A locked toggle is OFF and cannot be switched on (INV-29). */
export const FeatureToggleSchema = z
  .object({
    key: z.string().min(1),
    labelMs: z.string().min(1),
    audience: FeatureAudienceSchema,
    enabled: z.boolean(),
    locked: z.boolean(),
  })
  .meta({ id: 'FeatureToggle' })
export type FeatureToggle = z.infer<typeof FeatureToggleSchema>

/** `GET /api/admin/feature-toggles` body, ordered by sort_order. */
export const FeatureToggleListResponseSchema = envelopeOf(z.array(FeatureToggleSchema)).meta({
  id: 'FeatureToggleListResponse',
})
export type FeatureToggleListResponse = z.infer<typeof FeatureToggleListResponseSchema>

/** `PUT /api/admin/feature-toggles/:key` body. Strict: nothing else is accepted. */
export const FeatureToggleUpdateRequestSchema = z
  .strictObject({ enabled: z.boolean() })
  .meta({ id: 'FeatureToggleUpdateRequest' })
export type FeatureToggleUpdateRequest = z.infer<typeof FeatureToggleUpdateRequestSchema>

/** `PUT` answer. */
export const FeatureToggleResponseSchema = envelopeOf(FeatureToggleSchema).meta({ id: 'FeatureToggleResponse' })

/** The `features` field of `Session` (API-AUTH-03): key to enabled. A key that is absent counts as ON (fail-open). */
export const FeatureMapSchema = z.record(z.string(), z.boolean()).meta({
  id: 'FeatureMap',
  description: 'Feature key to enabled. A key that is absent counts as ON (FR-ADM-N06.4).',
})
export type FeatureMap = z.infer<typeof FeatureMapSchema>

/** Code of the 409 answered to `PUT {enabled:true}` on a locked key (INV-29). */
export const FEATURE_LOCKED_CODE = 'CONFLICT'

export const FEATURE_MESSAGES = {
  lockedOn: 'Ciri ini dikunci dan tidak boleh diaktifkan.',
  unknownKey: 'Ciri tidak dijumpai.',
} as const

export interface FeatureRoutePrefixes {
  /** Front-end path prefixes (the SPA hides the menu item and shows its 404 page). Boundary-aware: `/x` matches `/x` and `/x/...`. */
  fe: readonly string[]
  /** Paths below `/api` that `FeatureGuard` answers 404 for while the flag is OFF. Written WITH the `/api` prefix. */
  api: readonly string[]
  /** Front-end sub-paths of `fe` that belong to another module and stay reachable. */
  feExcept?: readonly string[]
}

/**
 * Route prefixes per flag key (API-AUTH-16): the 32 keys of Kawalan Ciri (S0-T10 seeded 4, S0-T11 the other 28).
 *
 * Audience-blind (S0-T11 D-3): one URL cannot be split by audience, so the key whose label a shared page carries governs it
 * for every role (`/headcount` -> guru.headcount, `/video` -> video-pembelajaran, `/panduan`, `/perutusan`, `/kombo`). A pupil key
 * owns the pupil route and what no guru key claims; a guru key owns its `/guru/...` paths and `/prestasi/kelas|sekolah|tingkatan`.
 *
 * A key with `api: []` is enforced on the front-end only (D115, S0-T11 D-7): it has no dedicated API controller, or its
 * endpoint is shared with other screens (`latih-tubi`: `/api/practice/sessions` serves Latih Bab, Ulang Kaji, Permainan and the
 * dashboard; `prestasi`: `/api/performance/*`; `guru.kelas`: `/api/guru/classes` also feeds Cikgu Alesa). The locked keys
 * `cikgu-alesa` and `keluarga-angkat` are OFF for ever (INV-29).
 */
export const FEATURE_ROUTE_PREFIXES: Readonly<Record<string, FeatureRoutePrefixes>> = {
  // Pelajar
  permainan: { fe: ['/permainan'], api: ['/api/games', '/api/papan-bijak'] },
  'misi-harian': { fe: ['/misi-harian'], api: ['/api/missions'] },
  kombo: { fe: ['/kombo'], api: [] },
  leaderboard: { fe: ['/gamification/leaderboard'], api: ['/api/gamification/leaderboard'] },
  remedial: { fe: ['/remedial'], api: ['/api/remedial-tests'] },
  'cita-cita': { fe: ['/cita-cita'], api: [], feExcept: ['/cita-cita/universiti', '/cita-cita/biasiswa'] },
  universiti: { fe: ['/cita-cita/universiti'], api: [] },
  biasiswa: { fe: ['/cita-cita/biasiswa'], api: [] },
  'target-spm': { fe: ['/target-spm'], api: ['/api/spm-targets'] },
  'analisa-item': { fe: ['/analisa-item'], api: ['/api/item-analysis'] },
  prestasi: {
    fe: ['/prestasi'],
    api: [],
    feExcept: ['/prestasi/kelas', '/prestasi/sekolah', '/prestasi/tingkatan'],
  },
  psikometrik: { fe: ['/psikometrik'], api: [] },
  'profil-cerah': { fe: ['/profil-cerah'], api: [] },
  'kemajuan-saya': { fe: ['/practice/progress'], api: [] },
  'sejarah-latihan': { fe: ['/practice/history'], api: [] },
  'video-pembelajaran': { fe: ['/video'], api: ['/api/videos'] },
  perutusan: { fe: ['/perutusan'], api: ['/api/perutusan', '/api/public/perutusan'] },
  'panduan-pengguna': { fe: ['/panduan'], api: [] },
  'tiket-bantuan': { fe: ['/pusat-tuisyen/tiket'], api: ['/api/tiket'] },
  'latih-tubi': {
    fe: ['/practice'],
    api: [],
    feExcept: ['/practice/chapter', '/practice/revision', '/practice/progress', '/practice/history'],
  },
  'cikgu-alesa': { fe: ['/cikgu'], api: ['/api/cikgu'] },
  'keluarga-angkat': { fe: ['/mohon-keluarga-angkat'], api: ['/api/mohon-keluarga-angkat'] },
  // Guru
  'guru.headcount': { fe: ['/headcount'], api: ['/api/headcounts'] },
  'guru.misi-harian': { fe: ['/guru/misi-harian'], api: [] },
  'guru.kelas': { fe: ['/guru/kelas'], api: [] },
  'guru.prestasi': { fe: ['/prestasi/kelas', '/prestasi/sekolah', '/prestasi/tingkatan'], api: [] },
  'guru.monitoring': { fe: ['/guru/monitoring'], api: ['/api/monitoring'] },
  'guru.analisis-item': { fe: ['/guru/analisis-item'], api: ['/api/teacher/item-analysis'] },
  'guru.gamifikasi': { fe: ['/guru/gamifikasi'], api: [] },
  'guru.broadcast': { fe: ['/guru/broadcast'], api: [] },
  'guru.databank': { fe: ['/guru/databank'], api: [] },
  'guru.sumbang-soalan': { fe: ['/guru/soalan'], api: ['/api/guru/questions'] },
}

/** True when `path` equals `prefix` or lies below it (`/api/games` matches `/api/games/hub`, not `/api/gamesx`). */
export function pathHasPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

/** The flag key whose api prefix covers `path` (query string ignored), or null. */
export function featureKeyForApiPath(path: string): string | null {
  const clean = path.split('?')[0] ?? path
  for (const [key, p] of Object.entries(FEATURE_ROUTE_PREFIXES)) {
    if (p.api.some((prefix) => pathHasPrefix(clean, prefix))) return key
  }
  return null
}

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})

/** Components contributed by S0-T10; appended to COMPONENT_SCHEMAS in openapi.ts. */
export const FEATURE_FLAGS_COMPONENT_SCHEMAS = {
  FeatureAudience: FeatureAudienceSchema,
  FeatureToggle: FeatureToggleSchema,
  FeatureToggleListResponse: FeatureToggleListResponseSchema,
  FeatureToggleUpdateRequest: FeatureToggleUpdateRequestSchema,
  FeatureToggleResponse: FeatureToggleResponseSchema,
  FeatureMap: FeatureMapSchema,
} as const

/** Registers API-ADM-09 (Admin Pusat only). */
export function registerFeatureFlagsPaths(registry: OpenAPIRegistry): void {
  const err = (d: string) => json(ErrorBodySchema, d)
  registry.registerPath({
    method: 'get',
    path: '/admin/feature-toggles',
    tags: ['admin'],
    summary: 'Kawalan Ciri: list the feature toggles',
    description: 'Admin Pusat only. Ordered by sort_order.',
    responses: {
      200: json(FeatureToggleListResponseSchema, 'All toggles.'),
      401: err('UNAUTHORIZED: no valid session.'),
      403: err('FORBIDDEN (not an admin).'),
    },
  })
  registry.registerPath({
    method: 'put',
    path: '/admin/feature-toggles/{key}',
    tags: ['admin'],
    summary: 'Kawalan Ciri: switch one toggle',
    description:
      'Admin Pusat only, audited (actor, key, old, new). Effective on the next request (5 s in-process cache, dropped on write). `{enabled:true}` on a locked key answers 409 CONFLICT.',
    request: {
      params: z.object({ key: z.string().min(1) }),
      body: { required: true, content: { 'application/json': { schema: FeatureToggleUpdateRequestSchema } } },
    },
    responses: {
      200: json(FeatureToggleResponseSchema, 'The toggle after the write.'),
      401: err('UNAUTHORIZED: no valid session.'),
      403: err('FORBIDDEN (not an admin) or CSRF_INVALID.'),
      404: err('NOT_FOUND: no such key.'),
      409: err('CONFLICT: the key is locked and cannot be switched on.'),
      422: err('VALIDATION_ERROR: enabled is not a boolean.'),
    },
  })
}
