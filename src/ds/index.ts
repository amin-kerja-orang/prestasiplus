/** Composite layer (V2-T05). Pages import the composites from `@/ds`. */
export { default as DsArt3D } from './DsArt3D.vue'
export { default as DsBrandLogo } from './DsBrandLogo.vue'
export { default as DsCarousel } from './DsCarousel.vue'
export { default as DsCharacterCard } from './DsCharacterCard.vue'
export { default as DsDrillTable } from './DsDrillTable.vue'
export { default as DsEmptyState } from './DsEmptyState.vue'
export { default as DsFeedbackSheet } from './DsFeedbackSheet.vue'
export { default as DsFloatScore } from './DsFloatScore.vue'
export { default as DsFriendAvatar } from './DsFriendAvatar.vue'
export { default as DsFriendPicker, type FriendOption } from './DsFriendPicker.vue'
export { default as DsIconChip } from './DsIconChip.vue'
export { default as DsLiveBadge } from './DsLiveBadge.vue'
export { default as DsLiveTiles, type LiveTile } from './DsLiveTiles.vue'
export { default as DsQuizOption } from './DsQuizOption.vue'
export { default as DsScoreRing } from './DsScoreRing.vue'
export { default as DsSpeechBubble } from './DsSpeechBubble.vue'
export { default as DsStatTile } from './DsStatTile.vue'
export { default as DsSticker } from './DsSticker.vue'
export { default as DsWinHero } from './DsWinHero.vue'
export { art3dNames, friendIds, type Art3DName, type FriendId } from './assets'
export type {
  DsAccent,
  DsHeadingLevel,
  DsIconName,
  DsIconProp,
  DsLegacyIconClass,
  DsTableDensity,
  DsTileDensity,
  DsTone,
  DsValueTone,
  FriendMood,
  QuizOptionState,
} from './types'
export { default as DsThemeScope } from './DsThemeScope.vue'
export { default as DsHeroCard } from './DsHeroCard.vue'
export { default as DsIcon } from './DsIcon.vue'
export { default as DsQuizHeader } from './DsQuizHeader.vue'
export { default as DsRewardChip } from './DsRewardChip.vue'
export { default as DsSubjectStrip, type SubjectTile } from './DsSubjectStrip.vue'
export { default as DsWinScreen, type WinReward, type WinSticker } from './DsWinScreen.vue'
export { usePersonality } from './personality'
export { default as DsPage } from './DsPage.vue'
export { default as DsPanel } from './DsPanel.vue'
export { default as DsFilterBar } from './DsFilterBar.vue'
export { default as DsDataTable, type CardField } from './DsDataTable.vue'
export { default as DsChart, type ChartSeries } from './DsChart.vue'
export { default as DsDialog } from './DsDialog.vue'
export { default as DsConfirmHost } from './DsConfirmHost.vue'
export { useConfirm, type ConfirmOptions } from './useConfirm'
export { default as DsErrorPage } from './DsErrorPage.vue'
export { default as DsLeaderRow } from './DsLeaderRow.vue'
export { default as DsHeatGrid, type HeatRow } from './DsHeatGrid.vue'
export { default as DsMediaCard } from './DsMediaCard.vue'
export { default as DsProse } from './DsProse.vue'
export { default as DsShopCard } from './DsShopCard.vue'
export { default as DsBadgeTile } from './DsBadgeTile.vue'
export { default as DsGameTile } from './DsGameTile.vue'
export { default as DsWheel } from './DsWheel.vue'
export { default as DsLevelMap, type LevelNode } from './DsLevelMap.vue'
export { default as DsAudioPlayer } from './DsAudioPlayer.vue'
export { default as DsPrintSheet } from './DsPrintSheet.vue'
export { dsCopy, fillCopy, type DsCopyKey } from './copy'
export { default as DsActiveFilters } from './DsActiveFilters.vue'
export { default as DsRowActions, type RowAction } from './DsRowActions.vue'
export { default as DsStatRow, type StatItem } from './DsStatRow.vue'
export type { StatDelta } from './DsStatTile.vue'
export { default as DsStatusBadge } from './DsStatusBadge.vue'
export { default as DsTag } from './DsTag.vue'
export { default as DsThumb } from './DsThumb.vue'
export { default as DsIdentity } from './DsIdentity.vue'
export { statusMap, type DsStatus } from './status'
export { default as DsLoadError } from './DsLoadError.vue'
export { default as DsFormField } from './DsFormField.vue'
export { default as DsFormSection } from './DsFormSection.vue'
export { default as DsFormBar } from './DsFormBar.vue'
export { default as DsStickyActions } from './DsStickyActions.vue'
export { default as DsNativeSelect, type NativeSelectItem } from './DsNativeSelect.vue'
export { default as DsSelect } from './DsNativeSelect.vue'
export { default as DsSwitchField } from './DsSwitchField.vue'
export { default as DsFileField } from './DsFileField.vue'
export { default as DsRtlScope } from './DsRtlScope.vue'
export { default as DsPageHeader } from './DsPageHeader.vue'
export { default as DsBackLink } from './DsBackLink.vue'
export { default as DsBreadcrumb, type CrumbItem } from './DsBreadcrumb.vue'
export { default as DsPillNav, type PillItem } from './DsPillNav.vue'
export {
  provideShellSubtitle,
  provideShellTitle,
  shellEntityTitle,
  shellPageSubtitle,
  useShellEntityTitle,
  useShellPrintsSubtitle,
  useShellPrintsTitle,
  useShellSubtitle,
} from './shellTitle'
export { default as DsAdminShell } from './DsAdminShell.vue'
export type {
  DsShellAccountIcon,
  DsShellAccountItem,
  DsShellNavGroup,
  DsShellNavLink,
  DsShellNavSub,
  DsShellSearchGroup,
} from './adminShell'
export { default as DsText } from './DsText.vue'
export { default as DsHeading } from './DsHeading.vue'
export { default as DsStack } from './DsStack.vue'
export { default as DsCluster } from './DsCluster.vue'
export { default as DsSpacer } from './DsSpacer.vue'
export { default as DsGrid } from './DsGrid.vue'
export { default as DsGridItem } from './DsGridItem.vue'
export { default as DsSplit } from './DsSplit.vue'
export { default as DsSection } from './DsSection.vue'
export { default as DsSurface } from './DsSurface.vue'
export { default as DsStateView } from './DsStateView.vue'
export type {
  DsSpace,
  DsPadding,
  DsBreakpoint,
  DsSize,
  DsTextRole,
  DsTextTone,
  DsCols,
  DsResponsive,
  DsSurfaceLevel,
  DsPageLayout,
  DsPageWidth,
} from './types'
export { default as DsBadge } from './DsBadge.vue'
export { default as DsCallout } from './DsCallout.vue'
export { default as DsDefinitionList, type DefinitionItem } from './DsDefinitionList.vue'
export { default as DsDrawer } from './DsDrawer.vue'
export { formatCount, formatPercent, formatStat, EMPTY_VALUE } from './format'
export { default as DsProgress } from './DsProgress.vue'
export { default as DsListRow } from './DsListRow.vue'
export { default as DsLink } from './DsLink.vue'
