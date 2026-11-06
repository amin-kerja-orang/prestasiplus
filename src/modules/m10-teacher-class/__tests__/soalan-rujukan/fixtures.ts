import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { PersonalQuestion } from '../../api/personal-questions-types'

export function makeRouter(): Router {
  const stub = { template: '<div />' }
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/guru/soalan-guru', component: stub },
      { path: '/guru/soalan-guru/cipta', component: stub },
      { path: '/guru/soalan-guru/:id/sunting', component: stub },
    ],
  })
}

export function personal(over: Partial<PersonalQuestion> = {}): PersonalQuestion {
  return {
    id: 7801,
    subjectId: 3,
    subjectName: 'Matematik',
    educationLevelId: 10,
    difficulty: 3,
    text: 'Apakah nilai bagi 2x + 3 apabila x = 4?',
    chapterId: null,
    spIds: [],
    tp: null,
    cognitiveLevel: null,
    options: [{ text: '8' }, { text: '9' }, { text: '10' }, { text: '11' }],
    correctIndex: 3,
    referenceUrl: 'https://example.org/rujukan/ungkapan-algebra',
    createdAt: '2026-09-24T09:00:00+08:00',
    ...over,
  }
}

export const LEVELS = [7, 8, 9, 10, 11].map((id) => ({ id, name: `Tingkatan ${String(id - 6)}` }))

export function listMeta(total: number, page = 1) {
  return {
    page,
    pageSize: 20,
    totalItems: total,
    totalPages: Math.max(1, Math.ceil(total / 20)),
    from: total ? (page - 1) * 20 + 1 : null,
    to: total ? Math.min(page * 20, total) : null,
  }
}
