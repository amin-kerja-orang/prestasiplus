export { HeatmapModule } from './heatmap.module'
export { HeatmapService, type HeatmapCaller } from './heatmap.service'
export { HeatmapPorts, PracticeLogAnswerCounts, type HeatmapAnswerCounts } from './ports'
export { HEATMAP_LIMITS } from './heatmap.controller'
export {
  buildHeatmap,
  chapterTile,
  compareChapterRefs,
  compareIds,
  compareNames,
  compareSubjectRefs,
  compareSpRefs,
  levelKey,
  spCounts,
  spTile,
  type ChapterCount,
  type HeatmapSpInput,
  type HeatmapSpRef,
  type QuestionCount,
} from './heatmap.rules'
