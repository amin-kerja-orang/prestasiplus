import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { ContributedQuestion, ContributedQuestionDetail, Contributions } from '../../api/types'

/** `extra` registers more stub routes (the Alat Soalan targets); `meta` sets route meta by path. */
export function makeRouter(
  extra: string[] = [],
  meta: Record<string, Record<string, unknown>> = {},
): Router {
  const stub = { template: '<div />' }
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/guru/soalan', component: stub },
      { path: '/guru/soalan/cipta', component: stub },
      { path: '/guru/soalan/:id', component: stub },
      { path: '/guru/soalan/:id/edit', component: stub },
      { path: '/admin/audio-kbat', component: stub },
      { path: '/admin/audio-kbat/create', component: stub },
      ...extra.map((path) => ({ path, component: stub, meta: meta[path] ?? {} })),
    ],
  })
}

export function summary(overrides: Partial<Contributions> = {}): Contributions {
  return {
    stats: { total: 120, approved: 100, pending: 20, used: 3 },
    tiers: [
      { name: 'Penyumbang Baru', threshold: 10, icon: 'fa-seedling', reached: true },
      { name: 'Penyumbang Aktif', threshold: 100, icon: 'fa-fire', reached: true },
      { name: 'Penyumbang Dedikasi', threshold: 500, icon: 'fa-award', reached: false },
    ],
    nextTier: { name: 'Penyumbang Dedikasi', threshold: 500 },
    breakdown: [
      { label: 'Matematik', count: 3287 },
      { label: 'Lain', count: 763 },
    ],
    ...overrides,
  }
}

export function question(overrides: Partial<ContributedQuestion> = {}): ContributedQuestion {
  return {
    id: 522425,
    questionType: 'mcq',
    questionText: 'Pilih ayat yang betul?',
    subjectId: 1,
    subjectName: 'Bahasa Melayu',
    educationLevelId: 11,
    levelName: 'Tingkatan 5',
    difficultyLevel: 4,
    difficultyLabel: 'Sukar',
    dskpTagged: true,
    status: 'approved',
    statusLabel: 'Diluluskan',
    rejectionReason: null,
    editable: false,
    options: ['Satu', 'Dua', 'Tiga', 'Empat'],
    correctAnswer: 2,
    explanation: 'Kerana tiga.',
    createdAt: '2026-05-02T10:00:00+08:00',
    ...overrides,
  }
}

export function detail(
  overrides: Partial<ContributedQuestionDetail> = {},
): ContributedQuestionDetail {
  return {
    ...question(),
    chapterId: null,
    spIds: [],
    tp: null,
    cognitiveLevel: null,
    ...overrides,
  }
}

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
