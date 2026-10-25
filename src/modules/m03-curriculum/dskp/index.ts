/**
 * Public surface of the DSKP catalogue (DSKP-T02, design section 4.1, ADR-0022). Re-exported by
 * M03's public entry (`@/modules/m03-curriculum`) and by `@/modules/m03-curriculum/mock`; nothing
 * else in `dskp/` is imported from outside the module.
 */

export { createDskpCatalog, DskpLoadError, dskpCatalog, normaliseDskpText } from './catalogue'
export type {
  DskpCatalog,
  DskpCatalogIndex,
  DskpLoader,
  DskpLoadErrorReason,
  DskpSearchOptions,
  DskpSubjectView,
} from './catalogue'
export {
  DSKP_FLAG_LABELS,
  DSKP_INFO_FLAGS,
  DSKP_NON_SELECTABLE_FLAGS,
  DSKP_REVIEW_BADGE_FLAGS,
  sortFlags,
} from './flags'
export { dskpKey, parseDskpKey } from './keys'
export type { ParsedDskpKey } from './keys'
export { DSKP_FLAGS, DSKP_SUBJECT_CODES, DSKP_TINGKATAN } from './types'
/** Wire types (`DskpSubjectData`, `DskpUnit`, `DskpSk`, `DskpSp`, `DskpGroup`) are exported for test fixtures. */
export type {
  DskpCounts,
  DskpFlag,
  DskpGroup,
  DskpGroupId,
  DskpGroupNode,
  DskpKeyKind,
  DskpLanguage,
  DskpNode,
  DskpRtlField,
  DskpSearchHit,
  DskpSk,
  DskpSkId,
  DskpSkNode,
  DskpSp,
  DskpSpId,
  DskpSpNode,
  DskpSubjectCode,
  DskpSubjectData,
  DskpSubjectInfo,
  DskpSubjectKind,
  DskpTingkatan,
  DskpTpLevel,
  DskpUnit,
  DskpUnitId,
  DskpUnitNode,
  TpDescriptor,
  TpResolved,
  TpTable,
  TpValue,
} from './types'
