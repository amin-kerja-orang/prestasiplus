<script setup lang="ts">
/**
 * S6 `/guru/pelajar` (FR-M10-35..37; URS FT-M10-3.3): counter, "Cipta Pelajar" link, tabs
 * "Pelajar Sekolah" / "Pelajar Saya" (default, client state), the empty and no-school cards, and
 * the PROPOSED student rows with add (#16) and remove (#17).
 */
import {
  CirclePlus,
  GraduationCap,
  Building2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Plus,
} from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { ApiError } from '@/api'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from '@/components/form'
import { confirmNative } from '@/components/overlay'
import { useApi, useDebouncedRef, useFlash } from '@/composables'

import {
  addStudentToClass,
  fetchGuruClasses,
  fetchGuruStudents,
  removeStudentFromClass,
} from '../api/guru'
import type { StudentTab } from '../api/types'
import { PELAJAR_COPY } from '../components/pelajar/copy'
import StudentRow from '../components/pelajar/StudentRow.vue'

const flash = useFlash()
const tab = ref<StudentTab>('mine')
const search = ref('')
const searchApplied = useDebouncedRef(search, 300)
const targetClass = ref('')
const busy = ref(false)

const mine = useApi((signal) => fetchGuruStudents({ tab: 'mine' }, { signal }))
const classes = useApi((signal) => fetchGuruClasses({ signal }))
const school = useApi(
  async (signal) =>
    tab.value === 'school'
      ? fetchGuruStudents({ tab: 'school', search: searchApplied.value.trim() }, { signal })
      : null,
  [tab, searchApplied],
)

const ownClasses = computed(() => (classes.data.value?.data ?? []).filter((c) => c.isActive))
const mineRows = computed(() => mine.data.value?.data ?? [])
const count = computed(() => mine.data.value?.meta.count ?? 0)
const schoolSet = computed(
  () => school.data.value?.meta.schoolSet ?? mine.data.value?.meta.schoolSet ?? false,
)
const schoolRows = computed(() => school.data.value?.data ?? [])
const loadError = computed(() => mine.error.value !== null || school.error.value !== null)

/**
 * Chip name → class id, only for names that identify one active class. Known limitation: the API
 * lists class names, not ids, so a chip of a duplicated class name has no remove button.
 */
const classIds = computed(() => {
  const seen = new Map<string, number>()
  const dup = new Set<string>()
  for (const c of ownClasses.value) {
    if (seen.has(c.name)) dup.add(c.name)
    else seen.set(c.name, c.id)
  }
  for (const name of dup) seen.delete(name)
  return seen
})

const targetName = computed(
  () => ownClasses.value.find((c) => String(c.id) === targetClass.value)?.name ?? null,
)

async function reloadAll(): Promise<void> {
  await Promise.all([mine.reload(), classes.reload(), school.reload()])
}

async function act(run: () => Promise<unknown>, okMessage: string): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await run()
    flash.show({ type: 'success', message: okMessage })
    await reloadAll()
  } catch (err) {
    flash.show({
      type: 'error',
      message: err instanceof ApiError ? err.message : PELAJAR_COPY.actionFailed,
    })
  } finally {
    busy.value = false
  }
}

const add = (studentId: number): Promise<void> =>
  act(
    () => addStudentToClass(studentId, { classroomId: Number(targetClass.value) }),
    PELAJAR_COPY.added,
  )

async function remove(studentId: number, classId: number): Promise<void> {
  if (!confirmNative(PELAJAR_COPY.removeConfirm)) return
  await act(() => removeStudentFromClass(studentId, classId), PELAJAR_COPY.removed)
}

const TAB =
  'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition'
const TAB_ON = 'bg-white text-indigo-700 shadow-sm'
const TAB_OFF = 'text-slate-500 hover:text-slate-700'
const CTA =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-6 text-sm font-semibold text-white hover:bg-indigo-600'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="pelajar-page">
    <section
      class="flex items-center justify-between gap-3 rounded-2xl bg-linear-to-r from-blue-500 to-indigo-600 p-4 text-white shadow sm:p-5"
    >
      <div class="flex min-w-0 items-center gap-3">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <Users class="h-6 w-6" />
        </span>
        <div class="min-w-0">
          <p class="font-heading text-2xl leading-none font-bold" data-testid="pelajar-count">
            {{ count }}
          </p>
          <p class="text-sm text-white/80">{{ PELAJAR_COPY.counterLabel }}</p>
        </div>
      </div>
      <RouterLink
        to="/guru/pelajar/cipta"
        class="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
        data-testid="pelajar-create"
      >
        <UserPlus class="h-4 w-4" />Cipta<span class="hidden sm:inline">&nbsp;Pelajar</span>
      </RouterLink>
    </section>

    <div class="flex gap-1 rounded-xl bg-slate-100 p-1" data-testid="pelajar-tabs">
      <button
        type="button"
        :class="[TAB, tab === 'school' ? TAB_ON : TAB_OFF]"
        data-testid="tab-school"
        @click="tab = 'school'"
      >
        <Building2 class="h-4 w-4" />{{ PELAJAR_COPY.tabSchool }}
      </button>
      <button
        type="button"
        :class="[TAB, tab === 'mine' ? TAB_ON : TAB_OFF]"
        data-testid="tab-mine"
        @click="tab = 'mine'"
      >
        <UserCheck class="h-4 w-4" />{{ PELAJAR_COPY.tabMine }}
        <span
          class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700"
          data-testid="tab-mine-count"
          >{{ count }}</span
        >
      </button>
    </div>

    <AlertBox v-if="loadError" :messages="PELAJAR_COPY.loadFailed" />

    <!-- Pelajar Saya -->
    <template v-else-if="tab === 'mine'">
      <div
        v-if="!mine.data.value"
        class="flex justify-center py-10 text-slate-400"
        data-testid="pelajar-loading"
      >
        <LoadingSpinner :size="28" />
      </div>
      <section
        v-else-if="mineRows.length === 0"
        class="rounded-2xl bg-white px-6 py-10 text-center shadow-sm"
        data-testid="pelajar-empty"
      >
        <GraduationCap class="mx-auto h-14 w-14 text-slate-400" />
        <h2 class="mt-3 font-heading text-lg font-bold text-slate-500">
          {{ PELAJAR_COPY.emptyTitle }}
        </h2>
        <p class="mt-1 text-sm text-slate-400">{{ PELAJAR_COPY.emptyBody }}</p>
        <RouterLink
          to="/guru/kelas/cipta"
          :class="[CTA, 'mt-5']"
          data-testid="pelajar-empty-create"
        >
          <Plus class="h-4 w-4" />{{ PELAJAR_COPY.createClass }}
        </RouterLink>
      </section>
      <ul v-else class="space-y-2" data-testid="pelajar-mine-list">
        <StudentRow
          v-for="s in mineRows"
          :key="s.id"
          :student="s"
          mode="mine"
          :class-ids="classIds"
          :busy="busy"
          @remove="remove"
        />
      </ul>
    </template>

    <!-- Pelajar Sekolah -->
    <template v-else>
      <section class="rounded-2xl bg-white p-4 shadow-sm" data-testid="pelajar-add-bar">
        <div class="flex flex-wrap items-center gap-3">
          <label
            for="pelajar-target"
            class="flex items-center gap-2 text-sm font-semibold text-indigo-700"
          >
            <CirclePlus class="h-4 w-4" />{{ PELAJAR_COPY.addTo }}
          </label>
          <select
            id="pelajar-target"
            v-model="targetClass"
            :class="[FORM_SELECT_CLASS, 'min-w-0 flex-1']"
            data-testid="pelajar-target"
          >
            <option value="">{{ PELAJAR_COPY.chooseClass }}</option>
            <option v-for="c in ownClasses" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </select>
        </div>
      </section>

      <section
        v-if="school.data.value && !schoolSet"
        class="rounded-2xl bg-white px-6 py-10 text-center shadow-sm"
        data-testid="pelajar-no-school"
      >
        <Building2 class="mx-auto h-14 w-14 text-slate-300" />
        <h2 class="mt-3 font-heading text-lg font-bold text-slate-700">
          {{ PELAJAR_COPY.noSchoolTitle }}
        </h2>
        <p class="mx-auto mt-1 max-w-md text-sm text-slate-400">{{ PELAJAR_COPY.noSchoolBody }}</p>
        <RouterLink
          to="/guru/profil/edit"
          :class="[CTA, 'mt-5']"
          data-testid="pelajar-profile-link"
        >
          <UserCog class="h-4 w-4" />{{ PELAJAR_COPY.profileSettings }}
        </RouterLink>
      </section>
      <template v-else-if="school.data.value">
        <input
          v-model="search"
          type="search"
          :placeholder="PELAJAR_COPY.searchPlaceholder"
          :class="FORM_INPUT_CLASS"
          data-testid="pelajar-search"
        />
        <p
          v-if="schoolRows.length === 0"
          class="rounded-2xl bg-white px-6 py-8 text-center text-sm text-slate-500 shadow-sm"
          data-testid="pelajar-school-empty"
        >
          {{ PELAJAR_COPY.schoolEmpty }}
        </p>
        <ul v-else class="space-y-2" data-testid="pelajar-school-list">
          <StudentRow
            v-for="s in schoolRows"
            :key="s.id"
            :student="s"
            mode="school"
            :can-add="targetClass !== ''"
            :already-in="targetName !== null && s.classNames.includes(targetName)"
            :busy="busy"
            @add="add"
          />
        </ul>
      </template>
      <div v-else class="flex justify-center py-10 text-slate-400" data-testid="pelajar-loading">
        <LoadingSpinner :size="28" />
      </div>
    </template>
  </div>
</template>
