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
  type ChapterCount,
} from './heatmap.rules'
