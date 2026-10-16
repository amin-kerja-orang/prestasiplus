import { OpenApiGeneratorV31, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { envelopeOf, listEnvelopeOf, ListMetaSchema, PageQuerySchema } from './common/envelope'
import { AccessModeSchema, PortalIdSchema, RoleCodeSchema, ScopeLevelSchema } from './common/enums'
import { ErrorBodySchema, ErrorCodeSchema, ErrorPayloadSchema } from './common/error'
import { ClientUuidSchema, IdSchema } from './common/ids'
import { SESSION_COMPONENT_SCHEMAS, registerSessionPaths } from './session/paths'
import { DateOnlySchema, TimestampInputSchema, TimestampSchema } from './common/time'

/** Every shared schema that becomes a component. Domain tasks (T07, T08, T24...) append here. */
export const COMPONENT_SCHEMAS = {
  Id: IdSchema,
  ClientUuid: ClientUuidSchema,
  Timestamp: TimestampSchema,
  TimestampInput: TimestampInputSchema,
  DateOnly: DateOnlySchema,
  RoleCode: RoleCodeSchema,
  PortalId: PortalIdSchema,
  ScopeLevel: ScopeLevelSchema,
  AccessMode: AccessModeSchema,
  ErrorCode: ErrorCodeSchema,
  ErrorPayload: ErrorPayloadSchema,
  ErrorBody: ErrorBodySchema,
  ListMeta: ListMetaSchema,
  PageQuery: PageQuerySchema,
  // Reference examples of the two envelope shapes; each endpoint registers its own concrete ones.
  IdEnvelope: envelopeOf(IdSchema).meta({ id: 'IdEnvelope' }),
  IdListEnvelope: listEnvelopeOf(IdSchema).meta({ id: 'IdListEnvelope' }),
  ...SESSION_COMPONENT_SCHEMAS, // V2-T07
} as const

export const CONTRACT_VERSION = '0.1.0'

/** Builds the OpenAPI 3.1 document. Pure and deterministic (no dates, no environment). */
export function buildOpenApiDocument(): Record<string, unknown> {
  const registry = new OpenAPIRegistry()
  for (const [name, schema] of Object.entries(COMPONENT_SCHEMAS)) registry.register(name, schema)
  registerSessionPaths(registry) // V2-T07
  const generator =new OpenApiGeneratorV31(registry.definitions)
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'PretasiPlus API contract',
      version: CONTRACT_VERSION,
      description:
        'Generated from packages/contract (zod). Do not edit by hand: run `npm run contract:emit`.',
    },
    servers: [{ url: '/api' }],
  }) as unknown as Record<string, unknown>
}

export function serializeOpenApi(doc: Record<string, unknown> = buildOpenApiDocument()): string {
  return `${JSON.stringify(doc, null, 2)}\n`
}
