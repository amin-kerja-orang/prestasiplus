import { OpenApiGeneratorV31, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import {
  AccessGroupIdSchema,
  AccessGroupSchema,
  AccessScopeSchema,
  CapabilitySchema,
  LearningMenuGroupSchema,
  LearningRoleSchema,
  MatrixItemSchema,
  PrototypeItemSchema,
  RoleModesSchema,
} from './access/schema'
import { envelopeOf, listEnvelopeOf, ListMetaSchema, PageQuerySchema } from './common/envelope'
import { AccessModeSchema, PortalIdSchema, RoleCodeSchema, ScopeLevelSchema } from './common/enums'
import { ErrorBodySchema, ErrorCodeSchema, ErrorPayloadSchema } from './common/error'
import { ClientUuidSchema, IdSchema } from './common/ids'
import { SESSION_COMPONENT_SCHEMAS, registerSessionPaths } from './session/paths'
import { CONTENT_COMPONENT_SCHEMAS, registerContentPaths } from './content/paths'
import { SUPPORT_COMPONENT_SCHEMAS, registerSupportPaths } from './support/paths'
import { DateOnlySchema, TimestampInputSchema, TimestampSchema } from './common/time'
import { WALLET_COMPONENT_SCHEMAS, registerWalletPaths } from './wallet/paths'

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
  ...WALLET_COMPONENT_SCHEMAS, // BE-11
  ...CONTENT_COMPONENT_SCHEMAS, // BE-24 (M09)
  ...SUPPORT_COMPONENT_SCHEMAS, // BE-24 (M22)
  // V2-T08 access matrix
  AccessGroupId: AccessGroupIdSchema,
  AccessGroup: AccessGroupSchema,
  AccessRoleModes: RoleModesSchema,
  AccessMatrixItem: MatrixItemSchema,
  AccessCapability: CapabilitySchema,
  AccessScope: AccessScopeSchema,
  LearningRole: LearningRoleSchema,
  LearningMenuGroup: LearningMenuGroupSchema,
  PrototypeItem: PrototypeItemSchema,
} as const

export const CONTRACT_VERSION = '0.1.0'

/** Builds the OpenAPI 3.1 document. Pure and deterministic (no dates, no environment). */
export function buildOpenApiDocument(): Record<string, unknown> {
  const registry = new OpenAPIRegistry()
  for (const [name, schema] of Object.entries(COMPONENT_SCHEMAS)) registry.register(name, schema)
  registerSessionPaths(registry) // V2-T07
  registerWalletPaths(registry) // BE-11
  registerContentPaths(registry) // BE-24 (M09)
  registerSupportPaths(registry) // BE-24 (M22)
  const generator = new OpenApiGeneratorV31(registry.definitions)
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
