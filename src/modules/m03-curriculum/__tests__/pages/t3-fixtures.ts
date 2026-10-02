import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type {
  ChapterDetail,
  ChapterNode,
  CurriculumTree,
  TopicNode,
} from '../../api/admin-curriculum'

export function subtopic(id: number, topicId: number, name = `Subtopik ${String(id)}`) {
  return { id, topicId, name, nameEn: null, learningObjective: null, createdSeq: id }
}

export function topic(id: number, chapterId: number, extra: Partial<TopicNode> = {}): TopicNode {
  return {
    id,
    chapterId,
    name: `Topik nama ${String(id)}`,
    nameEn: null,
    topicNumber: String(id),
    description: null,
    learningStandard: null,
    isActive: true,
    createdSeq: id,
    subtopics: [],
    ...extra,
  }
}

export function chapter(id: number, extra: Partial<ChapterNode> = {}): ChapterNode {
  return {
    id,
    subjectId: 3,
    educationLevelId: 10,
    name: `Bab nama ${String(id)}`,
    nameEn: null,
    chapterNumber: id,
    description: null,
    isActive: true,
    createdSeq: id,
    topics: [],
    ...extra,
  }
}

export function tree(chapters: ChapterNode[]): CurriculumTree {
  const topics = chapters.flatMap((c) => c.topics)
  return {
    subject: { id: 3, name: 'Matematik' },
    level: { id: 10, name: 'Tingkatan 4' },
    stats: {
      chapters: chapters.length,
      topics: topics.length,
      subtopics: topics.reduce((n, t) => n + t.subtopics.length, 0),
    },
    chapters,
  }
}

export function chapterDetail(extra: Partial<ChapterDetail> = {}): ChapterDetail {
  return {
    id: 91,
    subjectId: 3,
    educationLevelId: 10,
    name: 'Fungsi dan Persamaan Kuadratik',
    nameEn: 'Functions and Quadratic Equations',
    chapterNumber: 1,
    description: null,
    isActive: true,
    createdSeq: 1,
    subject: { id: 3, name: 'Matematik' },
    level: { id: 10, name: 'Tingkatan 4' },
    ...extra,
  }
}

export const SUBJECTS = [
  { id: 1, name: 'Bahasa Melayu' },
  { id: 3, name: 'Matematik' },
]
export const LEVELS = [
  { id: 9, name: 'Tingkatan 3' },
  { id: 10, name: 'Tingkatan 4' },
]

export function list<T>(data: T[]) {
  return {
    data,
    meta: { page: 1, pageSize: data.length, totalItems: data.length, totalPages: 1 },
  }
}

/** A memory router with the page at `path` and stubs for every other M03 admin route. */
export function makeRouter(path: string, component: object): Router {
  const stub = { template: '<div />' }
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path, component },
      { path: '/admin/curriculum', component: stub },
      { path: '/admin/curriculum/chapters/create', component: stub },
      { path: '/admin/curriculum/topics/create', component: stub },
    ],
  })
}
