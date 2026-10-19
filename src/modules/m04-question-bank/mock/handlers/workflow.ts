/**
 * The M04-T2 workflow routes (SRS §7 #9–#13 and #18–#27): imports and template, quality and audit,
 * structured reads, teacher question papers, diagram audit and master notes. The report endpoints
 * #14–#17 are not here: #15 belongs to M04-T6a, #17 to M04-T6b and #14 / #16 to M04-T6c (build-plan).
 */

import type { RouteDef } from '@/mock/define'

import { diagramRoutes } from './diagram-audit'
import { importRoutes } from './imports'
import { masterNoteRoutes } from './master-notes'
import { qualityRoutes } from './quality'
import { structuredRoutes } from './structured'
import { submissionRoutes } from './submissions'

export const workflowRoutes: RouteDef[] = [
  ...importRoutes,
  ...qualityRoutes,
  ...structuredRoutes,
  ...submissionRoutes,
  ...diagramRoutes,
  ...masterNoteRoutes,
]
