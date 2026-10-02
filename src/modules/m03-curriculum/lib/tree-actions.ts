import { inject, type InjectionKey } from 'vue'

import type { ChapterNode, SubtopicUpdateInput, TopicNode } from '../api/admin-curriculum'

/**
 * What the S1 tree components can do (provided by `CurriculumBrowserPage`): confirm and send the
 * mutation, reload the tree and show the flash. The save/add calls resolve to `true` on success.
 */
export interface TreeActions {
  deleteChapter(chapter: ChapterNode): Promise<void>
  deleteTopic(topic: TopicNode): Promise<void>
  deleteSubtopic(subtopicId: number): Promise<void>
  saveSubtopic(subtopicId: number, input: SubtopicUpdateInput): Promise<boolean>
  addSubtopic(topicId: number, input: SubtopicUpdateInput): Promise<boolean>
}

export const TREE_ACTIONS: InjectionKey<TreeActions> = Symbol('m03-tree-actions')

export function useTreeActions(): TreeActions {
  const actions = inject(TREE_ACTIONS)
  if (!actions) throw new Error('TREE_ACTIONS is not provided')
  return actions
}
