export { CurriculumModule } from './curriculum.module'
export { CurriculumRepository } from './curriculum.repository'
export type { SubjectWithLevels } from './curriculum.repository'
export {
  CurriculumPorts,
  type QuestionCountProvider,
  type TopicProgressProvider,
} from './providers'
export { deriveSubjectLevelPairs, type TopicProgress } from './rules'
export { parseDskpExtract, type DskpExtract } from './dskp/dskp-loader'
