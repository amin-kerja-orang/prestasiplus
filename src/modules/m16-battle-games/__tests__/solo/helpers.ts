import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type {
  BetulSalahPayload,
  CabaranKilatPayload,
  KadMemoriPayload,
  SusunJawapanPayload,
  TembakJawapanPayload,
} from '../../api'

/** Mounts a page at `url` with a router that accepts any path and Teleport rendered in place. */
export async function mountAt(page: Component, url: string): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:rest(.*)*', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(page, { global: { plugins: [router], stubs: { teleport: true } } })
  await flushPromises()
  return wrapper
}

export const rawOk = <B>(body: B) => ({ status: 200, headers: {}, body })

export const betulSalahPayload = (): BetulSalahPayload => ({
  sessionId: 'tf_0123456789abc',
  personalBest: 38,
  canEarnSyiling: false,
  statements: Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    statement: `Soalan ${String(i + 1)} → pilihan`,
    is_true: i % 2 === 0,
    difficulty: 1,
  })),
})

export const cabaranPayload = (): CabaranKilatPayload => ({
  sessionId: 'speed_0123456789abc',
  personalBest: 40,
  canEarnSyiling: false,
  questions: Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    question_text: `Soalan kilat ${String(i + 1)}`,
    difficulty: (i % 4) + 1,
    options: [0, 1, 2, 3].map((o) => ({ id: o, text: `Pilihan ${String(o)}`, correct: o === 1 })),
  })),
})

export const tembakPayload = (): TembakJawapanPayload => ({
  sessionId: 'shoot_0123456789abc',
  personalBest: 0,
  canEarnSyiling: true,
  questions: Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    question: `Soalan tembak ${String(i + 1)}`,
    difficulty: 1,
    options: [0, 1, 2, 3].map((o) => ({ text: `Jawapan ${String(o)}`, correct: o === 0 })),
  })),
})

export const susunPayload = (): SusunJawapanPayload => ({
  sessionId: 'ws_0123456789abc',
  personalBest: 0,
  canEarnSyiling: true,
  puzzles: Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    question: `Susun ${String(i + 1)}`,
    answer: 'ABC',
    scrambled: ['C', 'A', 'B'],
    type: 'letters' as const,
    difficulty: 1,
    points: 6,
  })),
})

export const memoriPayload = (): KadMemoriPayload => ({
  sessionId: 'mem_0123456789abc',
  personalBest: 0,
  canEarnSyiling: false,
  cards: [
    ...Array.from({ length: 6 }, (_, p) => ({
      id: p * 2 + 1,
      pair_id: p,
      type: 'question' as const,
      content: `S${String(p)}`,
      difficulty: 1,
    })),
    ...Array.from({ length: 6 }, (_, p) => ({
      id: p * 2 + 2,
      pair_id: p,
      type: 'answer' as const,
      content: `J${String(p)}`,
      difficulty: 1,
    })),
  ],
})
