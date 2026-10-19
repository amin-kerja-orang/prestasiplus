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
import { PRACTICE_COMPONENT_SCHEMAS, registerPracticePaths } from './practice/paths'
import { SESSION_COMPONENT_SCHEMAS, registerSessionPaths } from './session/paths'
import { CONTENT_COMPONENT_SCHEMAS, registerContentPaths } from './content/paths'
import { SUPPORT_COMPONENT_SCHEMAS, registerSupportPaths } from './support/paths'
import { GAMIFICATION_COMPONENT_SCHEMAS, registerGamificationPaths } from './gamification/paths'
import { QUESTION_WORKFLOW_COMPONENT_SCHEMAS, registerQuestionWorkflowPaths } from './question-workflow/paths'
import { CLASSES_COMPONENT_SCHEMAS, registerClassesPaths } from './classes/paths'
import { DateOnlySchema, TimestampInputSchema, TimestampSchema } from './common/time'
import { WALLET_COMPONENT_SCHEMAS, registerWalletPaths } from './wallet/paths'
import { BIJAK_PAPERS_COMPONENT_SCHEMAS, registerBijakPapersPaths } from './bijak/papers/paths'
import { BIJAK_ATTEMPTS_COMPONENT_SCHEMAS, registerBijakAttemptsPaths } from './bijak/attempts/paths'
import { SPM_COMPONENT_SCHEMAS, registerSpmPaths } from './spm/paths'
import { HEATMAP_COMPONENT_SCHEMAS, registerHeatmapPaths } from './heatmap/paths'
import { COMMAND_CENTER_COMPONENT_SCHEMAS, registerCommandCenterPaths } from './admin/command-center/paths'
import { CURRICULUM_COMPONENT_SCHEMAS, registerCurriculumPaths } from './curriculum/paths'
import { BATTLE_COMPONENT_SCHEMAS, registerBattlePaths } from './battle/paths'
import { GAMES_COMPONENT_SCHEMAS, registerGamesPaths } from './games/paths'
import { MARKETPLACE_COMPONENT_SCHEMAS, registerMarketplacePaths } from './marketplace/paths'
import { SPONSORSHIP_COMPONENT_SCHEMAS, registerSponsorshipPaths } from './sponsorship/paths'
import { ACCOUNT_COMPONENT_SCHEMAS, registerAccountPaths } from './account/paths'
import { NOTIFICATIONS_COMPONENT_SCHEMAS, registerNotificationsPaths } from './notifications/paths'

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
  ...GAMIFICATION_COMPONENT_SCHEMAS, // BE-23
  ...QUESTION_WORKFLOW_COMPONENT_SCHEMAS, // BE-10
  ...BIJAK_PAPERS_COMPONENT_SCHEMAS, // BE-15
  ...BIJAK_ATTEMPTS_COMPONENT_SCHEMAS, // BE-16
  ...SPM_COMPONENT_SCHEMAS, // BE-41
  ...HEATMAP_COMPONENT_SCHEMAS, // BE-48 (M25)
  ...COMMAND_CENTER_COMPONENT_SCHEMAS, // BE-22
  ...CLASSES_COMPONENT_SCHEMAS, // BE-17
  ...BATTLE_COMPONENT_SCHEMAS, // BE-44 (M16)
  ...GAMES_COMPONENT_SCHEMAS, // BE-45 (M16 games, leagues)
  ...MARKETPLACE_COMPONENT_SCHEMAS, // BE-46 (M20)
  ...SPONSORSHIP_COMPONENT_SCHEMAS, // BE-47 (M21 student side)
  ...ACCOUNT_COMPONENT_SCHEMAS, // BE-06 (M01 account)
  ...NOTIFICATIONS_COMPONENT_SCHEMAS, // BE-06 (M01 notifications)
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
  ...CURRICULUM_COMPONENT_SCHEMAS, // BE-08
  ...PRACTICE_COMPONENT_SCHEMAS, // BE-12
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
  registerGamificationPaths(registry) // BE-23
  registerQuestionWorkflowPaths(registry) // BE-10
  registerBijakPapersPaths(registry) // BE-15
  registerBijakAttemptsPaths(registry) // BE-16
  registerSpmPaths(registry) // BE-41
  registerHeatmapPaths(registry) // BE-48 (M25)
  registerCommandCenterPaths(registry) // BE-22
  registerCurriculumPaths(registry) // BE-08
  registerPracticePaths(registry) // BE-12
  registerClassesPaths(registry) // BE-17
  registerBattlePaths(registry) // BE-44 (M16)
  registerGamesPaths(registry) // BE-45 (M16 games, leagues)
  registerMarketplacePaths(registry) // BE-46 (M20)
  registerSponsorshipPaths(registry) // BE-47 (M21 student side)
  registerAccountPaths(registry) // BE-06 (M01 account)
  registerNotificationsPaths(registry) // BE-06 (M01 notifications)
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
