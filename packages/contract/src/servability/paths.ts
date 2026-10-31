import {
  ServabilityActivityResultSchema,
  ServabilityActivitySchema,
  ServabilityReasonCodeSchema,
  ServabilityReasonSchema,
  ServabilityReportSchema,
} from './schema'

/**
 * Components contributed by R1-T29 (appended to COMPONENT_SCHEMAS in openapi.ts). No route yet: the admin reads are R1-B11 (T30),
 * which registers its paths here.
 */
export const SERVABILITY_COMPONENT_SCHEMAS = {
  ServabilityActivity: ServabilityActivitySchema,
  ServabilityReasonCode: ServabilityReasonCodeSchema,
  ServabilityReason: ServabilityReasonSchema,
  ServabilityActivityResult: ServabilityActivityResultSchema,
  ServabilityReport: ServabilityReportSchema,
} as const
