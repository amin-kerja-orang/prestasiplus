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
import { PRACTICE_READS_COMPONENT_SCHEMAS, registerPracticeReadsPaths } from './practice/reads/paths'
import { SESSION_COMPONENT_SCHEMAS, registerSessionPaths } from './session/paths'
import { CONTENT_COMPONENT_SCHEMAS, registerContentPaths } from './content/paths'
import { SUPPORT_COMPONENT_SCHEMAS, registerSupportPaths } from './support/paths'
import { GAMIFICATION_COMPONENT_SCHEMAS, registerGamificationPaths } from './gamification/paths'
import { QUESTION_WORKFLOW_COMPONENT_SCHEMAS, registerQuestionWorkflowPaths } from './question-workflow/paths'
import { CLASSES_COMPONENT_SCHEMAS, registerClassesPaths } from './classes/paths'
import { SCHOOL_ADMIN_COMPONENT_SCHEMAS, registerSchoolAdminPaths } from './school-admin/paths'
import { SCHOOL_ADMIN_PENDING_COMPONENT_SCHEMAS, registerSchoolAdminPendingTeacherPaths } from './school-admin/pending-teachers'
import { QUESTIONS_COMPONENT_SCHEMAS, registerQuestionsPaths } from './questions/paths'
import { STIMULI_COMPONENT_SCHEMAS, registerStimuliPaths } from './questions/stimuli'
import { PERFORMANCE_COMPONENT_SCHEMAS, registerPerformancePaths } from './reports/performance/paths'
import { DateOnlySchema, TimestampInputSchema, TimestampSchema } from './common/time'
import { WALLET_COMPONENT_SCHEMAS, registerWalletPaths } from './wallet/paths'
import { BIJAK_PAPERS_COMPONENT_SCHEMAS, registerBijakPapersPaths } from './bijak/papers/paths'
import { BIJAK_KUIZ_COMPONENT_SCHEMAS, registerBijakKuizPaths } from './bijak/kuiz/paths'
import { BIJAK_ATTEMPTS_COMPONENT_SCHEMAS, registerBijakAttemptsPaths } from './bijak/attempts/paths'
import { SPM_COMPONENT_SCHEMAS, registerSpmPaths } from './spm/paths'
import { HEATMAP_COMPONENT_SCHEMAS, registerHeatmapPaths } from './heatmap/paths'
import { SERVABILITY_COMPONENT_SCHEMAS, registerServabilityPaths } from './servability/paths'
import { COMMAND_CENTER_COMPONENT_SCHEMAS, registerCommandCenterPaths } from './admin/command-center/paths'
import { CURRICULUM_COMPONENT_SCHEMAS, registerCurriculumPaths } from './curriculum/paths'
import { BATTLE_COMPONENT_SCHEMAS, registerBattlePaths } from './battle/paths'
import { GAMES_COMPONENT_SCHEMAS, registerGamesPaths } from './games/paths'
import { MARKETPLACE_COMPONENT_SCHEMAS, registerMarketplacePaths } from './marketplace/paths'
import { SPONSORSHIP_COMPONENT_SCHEMAS, registerSponsorshipPaths } from './sponsorship/paths'
import { SCHOOLS_COMPONENT_SCHEMAS, registerSchoolsPaths } from './schools/paths' // BE-05
import { USERS_COMPONENT_SCHEMAS, registerUsersPaths } from './users/paths' // BE-05
import { ACCOUNT_COMPONENT_SCHEMAS, registerAccountPaths } from './account/paths'
import { NOTIFICATIONS_COMPONENT_SCHEMAS, registerNotificationsPaths } from './notifications/paths'
import { MISSIONS_COMPONENT_SCHEMAS, registerMissionsPaths } from './classes/missions/paths'
import { QUESTION_SETS_COMPONENT_SCHEMAS, registerQuestionSetsPaths } from './classes/question-sets/paths'
import { PKSK_COMPONENT_SCHEMAS, registerPkskPaths } from './pksk/paths'
import { ANALYTICS_COMPONENT_SCHEMAS, registerAnalyticsPaths } from './reports/analytics/paths'
import { KIRKPATRICK_COMPONENT_SCHEMAS, registerKirkpatrickPaths } from './reports/kirkpatrick/paths'
import { BIJAK_BUILDER_COMPONENT_SCHEMAS, registerBijakBuilderPaths } from './bijak/builder/paths'
import { BIJAK_STANDARDS_COMPONENT_SCHEMAS, registerBijakStandardsPaths } from './bijak/standards/paths'
import { PARENT_INVITE_COMPONENT_SCHEMAS, registerParentInvitePaths } from './schools/parents/paths'
import { SUBSCRIPTION_COMPONENT_SCHEMAS, registerSubscriptionPaths } from './schools/subscriptions/paths'
import { CIKGU_COMPONENT_SCHEMAS, registerCikguPaths } from './cikgu/paths'
import { FILES_COMPONENT_SCHEMAS, registerFilesPaths } from './files/paths'
import { AI_COMPONENT_SCHEMAS, registerAiPaths } from './ai/paths'
import { INTAKE_COMPONENT_SCHEMAS, registerIntakePaths } from './intake/paths'
import { INTAKE_FILES_COMPONENT_SCHEMAS, registerIntakeFilesPaths } from './intake/files-paths'
import { INTAKE_DASHBOARD_COMPONENT_SCHEMAS, registerIntakeDashboardPaths } from './intake/dashboard'

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
  ...BIJAK_KUIZ_COMPONENT_SCHEMAS, // R1-B16
  ...SPM_COMPONENT_SCHEMAS, // BE-41
  ...HEATMAP_COMPONENT_SCHEMAS, // BE-48 (M25)
  ...SERVABILITY_COMPONENT_SCHEMAS, // R1-T29
  ...COMMAND_CENTER_COMPONENT_SCHEMAS, // BE-22
  ...CLASSES_COMPONENT_SCHEMAS, // BE-17
  ...BATTLE_COMPONENT_SCHEMAS, // BE-44 (M16)
  ...GAMES_COMPONENT_SCHEMAS, // BE-45 (M16 games, leagues)
  ...MARKETPLACE_COMPONENT_SCHEMAS, // BE-46 (M20)
  ...SPONSORSHIP_COMPONENT_SCHEMAS, // BE-47 (M21 student side)
  ...SCHOOLS_COMPONENT_SCHEMAS, // BE-05
  ...USERS_COMPONENT_SCHEMAS, // BE-05
  ...ACCOUNT_COMPONENT_SCHEMAS, // BE-06 (M01 account)
  ...NOTIFICATIONS_COMPONENT_SCHEMAS, // BE-06 (M01 notifications)
  ...SCHOOL_ADMIN_COMPONENT_SCHEMAS, // BE-21 (M27 + M18 Amaran)
  ...SCHOOL_ADMIN_PENDING_COMPONENT_SCHEMAS, // BE-21 AC13 (pending teachers)
  ...QUESTIONS_COMPONENT_SCHEMAS, // BE-09
  ...STIMULI_COMPONENT_SCHEMAS, // R1-T32
  ...MISSIONS_COMPONENT_SCHEMAS, // BE-18 (M10 missions, remedial)
  ...QUESTION_SETS_COMPONENT_SCHEMAS, // BE-18 (M10 question sets, DSKP)
  ...PERFORMANCE_COMPONENT_SCHEMAS, // BE-19
  ...PARENT_INVITE_COMPONENT_SCHEMAS, // BE-25
  ...SUBSCRIPTION_COMPONENT_SCHEMAS, // BE-25
  ...CIKGU_COMPONENT_SCHEMAS, // BE-43 (M13)
  ...FILES_COMPONENT_SCHEMAS, // BE-04
  ...AI_COMPONENT_SCHEMAS, // BE-36 (AI adapter wire types)
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
  ...PKSK_COMPONENT_SCHEMAS, // BE-42
  ...PRACTICE_READS_COMPONENT_SCHEMAS, // BE-13
  ...ANALYTICS_COMPONENT_SCHEMAS, // BE-20 (M11)
  ...KIRKPATRICK_COMPONENT_SCHEMAS, // BE-20 (M12)
  ...BIJAK_BUILDER_COMPONENT_SCHEMAS, // BE-39
  ...BIJAK_STANDARDS_COMPONENT_SCHEMAS, // BJS-01
  ...INTAKE_COMPONENT_SCHEMAS, // BE-38
  ...INTAKE_FILES_COMPONENT_SCHEMAS, // BE-37
  ...INTAKE_DASHBOARD_COMPONENT_SCHEMAS, // BE-40
} as const

export const CONTRACT_VERSION = '0.1.0'

/** Builds the OpenAPI 3.1 document. Pure and deterministic (no dates, no environment). */
export function buildOpenApiDocument(): Record<string, unknown> {
  const registry = new OpenAPIRegistry()
  // Widened on purpose: with 1000+ component schemas the literal union is too complex for tsc (TS2859).
  const components = COMPONENT_SCHEMAS as Record<string, Parameters<OpenAPIRegistry["register"]>[1]>
  for (const [name, schema] of Object.entries(components)) registry.register(name, schema)
  registerSessionPaths(registry) // V2-T07
  registerWalletPaths(registry) // BE-11
  registerContentPaths(registry) // BE-24 (M09)
  registerSupportPaths(registry) // BE-24 (M22)
  registerGamificationPaths(registry) // BE-23
  registerQuestionWorkflowPaths(registry) // BE-10
  registerBijakPapersPaths(registry) // BE-15
  registerBijakAttemptsPaths(registry) // BE-16
  registerBijakKuizPaths(registry) // R1-B16
  registerSpmPaths(registry) // BE-41
  registerHeatmapPaths(registry) // BE-48 (M25)
  registerServabilityPaths(registry) // R1-T30
  registerCommandCenterPaths(registry) // BE-22
  registerCurriculumPaths(registry) // BE-08
  registerPracticePaths(registry) // BE-12
  registerPracticeReadsPaths(registry) // BE-13
  registerClassesPaths(registry) // BE-17
  registerBattlePaths(registry) // BE-44 (M16)
  registerGamesPaths(registry) // BE-45 (M16 games, leagues)
  registerMarketplacePaths(registry) // BE-46 (M20)
  registerSponsorshipPaths(registry) // BE-47 (M21 student side)
  registerSchoolsPaths(registry) // BE-05
  registerUsersPaths(registry) // BE-05
  registerAccountPaths(registry) // BE-06 (M01 account)
  registerNotificationsPaths(registry) // BE-06 (M01 notifications)
  registerSchoolAdminPaths(registry) // BE-21 (M27 + M18 Amaran)
  registerSchoolAdminPendingTeacherPaths(registry) // BE-21 AC13 (pending teachers)
  registerQuestionsPaths(registry) // BE-09
  registerStimuliPaths(registry) // R1-T32
  registerMissionsPaths(registry) // BE-18 (M10 missions, remedial)
  registerQuestionSetsPaths(registry) // BE-18 (M10 question sets, DSKP)
  registerPerformancePaths(registry) // BE-19
  registerPkskPaths(registry) // BE-42
  registerAnalyticsPaths(registry) // BE-20 (M11)
  registerKirkpatrickPaths(registry) // BE-20 (M12)
  registerBijakBuilderPaths(registry) // BE-39
  registerBijakStandardsPaths(registry) // BJS-01
  registerParentInvitePaths(registry) // BE-25
  registerSubscriptionPaths(registry) // BE-25
  registerCikguPaths(registry) // BE-43 (M13)
  registerFilesPaths(registry) // BE-04
  registerAiPaths(registry) // BE-36 (AI adapter wire types, admin routes)
  registerIntakePaths(registry) // BE-38
  registerIntakeFilesPaths(registry) // BE-37
  registerIntakeDashboardPaths(registry) // BE-40
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
