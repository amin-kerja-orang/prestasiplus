import { defineComponent, h } from 'vue'
import { createMemoryHistory, type Router } from 'vue-router'

import type { Transport, TransportRequest, TransportResponse } from '@/api'
import { PP_AUTH_STORAGE_KEY, type ClientSession, type UserMe } from '@/stores'

import type { ModuleManifest } from '../modules'
import { createAppRouter } from '../router'

export const NOW = '2026-09-25T15:40:00+08:00'

function user(overrides: Partial<UserMe>): UserMe {
  return {
    id: 2,
    name: 'Pelajar Demo',
    email: 'pelajar@demo.test',
    phone: null,
    role: 'student',
    grade: 11,
    schoolId: 900001,
    bio: null,
    avatarUrl: null,
    createdAt: '2026-02-06T09:00:00+08:00',
    updatedAt: '2026-02-06T09:00:00+08:00',
    lastLoginAt: null,
    school: null,
    landingPath: '/dashboard',
    ...overrides,
  }
}

export const STUDENT = user({})
export const ADMIN = user({
  id: 1,
  name: 'Admin Demo',
  email: 'admin@demo.test',
  role: 'admin',
  grade: null,
  landingPath: '/admin',
})
/** Account 11 (`tidakaktif`, inactive, M01 §6.8). */
export const INACTIVE_STUDENT = user({
  id: 11,
  name: 'Tidak Aktif Demo',
  email: 'tidakaktif@demo.test',
})

export function logIn(u: UserMe, overrides: Partial<ClientSession> = {}): void {
  const session: ClientSession = {
    token: `token_${String(u.id)}`,
    remember: false,
    expiresAt: '2026-09-25T17:40:00+08:00',
    user: u,
    ...overrides,
  }
  localStorage.setItem(PP_AUTH_STORAGE_KEY, JSON.stringify(session))
}

function page(testId: string) {
  return defineComponent({
    name: `Page_${testId}`,
    setup: () => () => h('p', { 'data-testid': testId }, testId),
  })
}

/** A synthetic registry covering every meta combination the guards and LayoutHost handle. */
export const TEST_REGISTRY: readonly ModuleManifest[] = [
  {
    id: 'M99',
    slug: 'm99-test',
    routes: [
      {
        path: '/login',
        component: page('login'),
        meta: { layout: 'bare', access: 'public', title: 'Log Masuk - PRESTASIPLUS' },
      },
      {
        path: '/register',
        component: page('register'),
        meta: { layout: 'bare', access: 'public', title: 'Daftar - PRESTASIPLUS' },
      },
      {
        path: '/dashboard',
        component: page('dashboard'),
        meta: { layout: 'user', access: 'auth', title: 'Papan Pemuka - PRESTASIPLUS' },
      },
      {
        path: '/topics',
        component: page('topics'),
        meta: { layout: 'user', access: 'auth', title: (r) => `Topik ${String(r.query.s ?? '')}` },
      },
      {
        path: '/admin',
        component: page('admin'),
        meta: { layout: 'admin', access: 'auth', roles: ['admin'], title: 'Admin Panel' },
      },
      {
        path: '/admin/questions/:id(\\d+)',
        component: page('admin-question'),
        meta: { layout: 'admin', access: 'auth', roles: ['admin'] },
      },
      {
        path: '/prestasi-sekolah',
        component: page('school-performance'),
        meta: { layout: 'user', access: 'auth', roles: ['teacher'], onForbidden: '403' },
      },
      {
        path: '/timeline/:id',
        component: page('timeline'),
        meta: { layout: 'user', access: 'auth', roles: ['admin'], onForbidden: '404' },
      },
      {
        path: '/tetapan',
        component: page('tetapan'),
        meta: { layout: 'role', access: 'auth', title: 'Tetapan Peribadi' },
      },
      {
        path: '/artikel',
        component: page('artikel'),
        meta: { layout: 'public-or-user', access: 'public', title: 'Artikel — PRESTASIPLUS' },
      },
    ],
  },
]

export function testRouter(): Router {
  return createAppRouter({ history: createMemoryHistory(), registry: TEST_REGISTRY })
}

/** The user of the stored session (what `GET /api/me` returns for its token). */
function storedUser(): UserMe | null {
  const raw = localStorage.getItem(PP_AUTH_STORAGE_KEY)
  return raw === null ? null : (JSON.parse(raw) as ClientSession).user
}

type Responder = (req: TransportRequest) => Partial<TransportResponse>

/** Records requests; answers `/api/me` and the unread count by default. */
export function fakeTransport(
  respond: Responder = () => ({}),
): Transport & { requests: TransportRequest[] } {
  const requests: TransportRequest[] = []
  return {
    requests,
    request(req) {
      requests.push(req)
      const custom = respond(req)
      let body: unknown = null
      if (req.url === '/api/me') body = { data: storedUser() }
      if (req.url === '/api/me/notifications/unread-count') body = { data: { count: 3 } }
      return Promise.resolve({ status: 200, headers: {}, body, ...custom })
    },
  }
}
