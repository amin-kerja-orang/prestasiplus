import type { BuilderPreview, BuilderQuestionInfo, BuilderQuestionSource, BuilderGroupInfo } from './ports'

/** STUB: replaced by the PoC builder question source task. */
export class PocBuilderQuestionSource implements BuilderQuestionSource {
  async describe(): Promise<ReadonlyMap<string, BuilderQuestionInfo>> {
    return new Map()
  }
  async candidates(): Promise<string[]> {
    return []
  }
  async groups(): Promise<ReadonlyMap<string, BuilderGroupInfo>> {
    return new Map()
  }
  async review(): Promise<BuilderPreview> {
    return { questions: [], stimuli: {}, optionBanks: {} }
  }
}
