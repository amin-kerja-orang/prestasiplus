import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { SchoolPupilRow, SchoolTeacherRow, SchoolUserDetail } from '../../api/school-admin'
import { useSessionStore } from '@/stores/session'

export const SCHOOL = {
  id: 900001,
  name: 'SMK Contoh Ujian',
  code: 'ABC1234',
  type: 'SMK',
  state: 'Selangor',
  district: 'PPD Contoh',
  city: null,
}

/** Signs a school admin in the active pinia (the page reads the school name from the session user). */
export function signIn(): void {
  useSessionStore().setSession({
    token: 't',
    remember: false,
    expiresAt: '2099-01-01T00:00:00+08:00',
    user: {
      id: 8,
      name: 'Admin Contoh',
      email: 'admin@demo.test',
      phone: null,
      role: 'school_admin',
      grade: null,
      schoolId: SCHOOL.id,
      bio: null,
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00+08:00',
      updatedAt: '2026-01-01T00:00:00+08:00',
      lastLoginAt: null,
      school: SCHOOL,
      landingPath: '/admin-sekolah',
    },
  })
}

export interface Mounted {
  wrapper: VueWrapper
  router: Router
}

export async function mountAt(
  component: Component,
  url: string,
  props: Record<string, unknown> = {},
  attachTo?: HTMLElement,
): Promise<Mounted> {
  const pinia = createPinia()
  setActivePinia(pinia)
  signIn()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(component, { props, global: { plugins: [pinia, router] }, ...(attachTo ? { attachTo } : {}) })
  await flushPromises()
  return { wrapper, router }
}

export const pupil = (over: Partial<SchoolPupilRow> = {}): SchoolPupilRow => ({
  id: 3001,
  name: 'Murid Contoh Satu',
  initials: 'MC',
  email: 'murid1@demo.test',
  phone: '0191234567',
  gradeLabel: 'Tingkatan 5',
  classNames: ['5 Amanah', '5 Bestari'],
  isActive: true,
  createdAt: '2026-03-04T10:00:00+08:00',
  canEdit: true,
  ...over,
})

export const teacher = (over: Partial<SchoolTeacherRow> = {}): SchoolTeacherRow => ({
  id: 5,
  name: 'Guru Contoh Satu',
  initials: 'GC',
  email: 'guru@demo.test',
  phone: null,
  classCount: 2,
  lastLoginAt: null,
  isActive: true,
  createdAt: '2026-02-01T09:30:00+08:00',
  canEdit: true,
  ...over,
})

export const detail = (over: Partial<SchoolUserDetail> = {}): SchoolUserDetail => ({
  id: 3001,
  name: 'Murid Contoh Satu',
  email: 'murid1@demo.test',
  phone: '0191234567',
  isActive: true,
  createdAt: '2026-03-04T10:00:00+08:00',
  updatedAt: '2026-04-05T14:07:00+08:00',
  role: 'student',
  school: { id: 900001, name: SCHOOL.name, code: SCHOOL.code, district: SCHOOL.district, state: SCHOOL.state },
  ...over,
})

export const text = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`).text()
export const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()
