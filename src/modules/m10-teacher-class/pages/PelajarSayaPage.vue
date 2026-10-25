<script setup lang="ts">
/**
 * S6 `/guru/pelajar` (FR-M10-35..37; URS FT-M10-3.3): counter, "Cipta Pelajar" link, tabs
 * "Pelajar Sekolah" / "Pelajar Saya" (default, client state), the empty and no-school cards, and
 * the PROPOSED student rows with add (#16) and remove (#17).
 */
import { computed, ref } from 'vue'

import { useApi, useDebouncedRef, useFlash, usePrototypeScope } from '@/composables'
import {
  DsEmptyState,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsPillNav,
  DsStatTile,
  useConfirm,
  type PillItem,
} from '@/ds'

import {
  addStudentToClass,
  fetchGuruClasses,
  fetchGuruStudents,
  removeStudentFromClass,
} from '../api/guru'
import type { StudentTab } from '../api/types'
import { PELAJAR_COPY } from '../components/pelajar/copy'
import StudentRow from '../components/pelajar/StudentRow.vue'
import { isInClass } from '../components/pelajar/student-classes'
import { moduleMessage } from '../lib/generic-server-text'

const flash = useFlash()
const confirm = useConfirm()
// Prototype scope (D43): the teacher profile editor is outside the matrix.
const { allows } = usePrototypeScope()
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

const tabs = computed<PillItem<StudentTab>[]>(() => [
  { key: 'school', label: PELAJAR_COPY.tabSchool, icon: 'i-ph-buildings' },
  {
    key: 'mine',
    label: `${PELAJAR_COPY.tabMine} (${String(count.value)})`,
    icon: 'i-ph-user-check',
  },
])

const ownClasses = computed(() => (classes.data.value?.data ?? []).filter((c) => c.isActive))
const mineRows = computed(() => mine.data.value?.data ?? [])
const count = computed(() => mine.data.value?.meta.count ?? 0)
const schoolSet = computed(
  () => school.data.value?.meta.schoolSet ?? mine.data.value?.meta.schoolSet ?? false,
)
const schoolRows = computed(() => school.data.value?.data ?? [])
const loadError = computed(() => mine.error.value !== null || school.error.value !== null)

/**
 * Fallback only, for an API that lists class names without `classes` (SW5-03): chip name → class
 * id, for names that identify one active class. A chip that carries its own id never reads this.
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
      message: moduleMessage(err) ?? PELAJAR_COPY.actionFailed,
    })
  } finally {
    busy.value = false
  }
}

const add = (studentId: number): Promise<void> =>
  act(
    () => addStudentToClass(studentId, { classroomId: targetClass.value }),
    PELAJAR_COPY.added,
  )

async function remove(studentId: number, classId: number): Promise<void> {
  if (!(await confirm({ message: PELAJAR_COPY.removeConfirm, tone: 'error' }))) return
  await act(() => removeStudentFromClass(studentId, classId), PELAJAR_COPY.removed)
}
</script>

<template>
  <DsPage data-testid="pelajar-page">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <DsStatTile
        class="min-w-56"
        :value="count"
        :unit="PELAJAR_COPY.counterLabel"
        icon="users-three"
        accent="win"
        part-prefix="pelajar"
        data-testid="pelajar-counter"
      />
      <UButton
        to="/guru/pelajar/cipta"
        icon="i-ph-user-plus"
        class="min-h-11 shrink-0"
        data-testid="pelajar-create"
        >Cipta<span class="hidden sm:inline">&nbsp;Pelajar</span></UButton
      >
    </div>

    <DsPillNav
      :items="tabs"
      :active="tab"
      :label="PELAJAR_COPY.tabsLabel"
      testid-prefix="tab"
      data-testid="pelajar-tabs"
      @select="tab = $event"
    />

    <DsLoadError
      v-if="loadError"
      :message="PELAJAR_COPY.loadFailed"
      retry-label="Cuba Lagi"
      testid="pelajar-error"
      @retry="reloadAll"
    />

    <!-- Pelajar Saya -->
    <template v-else-if="tab === 'mine'">
      <div
        v-if="!mine.data.value"
        class="flex flex-col gap-2"
        aria-busy="true"
        data-testid="pelajar-loading"
      >
        <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
      </div>
      <DsPanel v-else-if="mineRows.length === 0" data-testid="pelajar-empty">
        <DsEmptyState
          :title="PELAJAR_COPY.emptyTitle"
          :description="PELAJAR_COPY.emptyBody"
          icon="graduation-cap"
        >
          <template #actions>
            <UButton
              to="/guru/kelas/cipta"
              icon="i-ph-plus"
              class="min-h-11"
              data-testid="pelajar-empty-create"
              >{{ PELAJAR_COPY.createClass }}</UButton
            >
          </template>
        </DsEmptyState>
      </DsPanel>
      <ul v-else class="flex flex-col gap-2" data-testid="pelajar-mine-list">
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
      <DsPanel data-testid="pelajar-add-bar">
        <div class="flex flex-wrap items-center gap-3">
          <label for="pelajar-target" class="flex items-center gap-2 text-label text-highlighted">
            <UIcon name="i-ph-plus-circle-duotone" class="size-4 text-primary-t" />{{
              PELAJAR_COPY.addTo
            }}
          </label>
          <DsNativeSelect
            id="pelajar-target"
            v-model="targetClass"
            class="min-w-0 grow"
            data-testid="pelajar-target"
          >
            <option value="">{{ PELAJAR_COPY.chooseClass }}</option>
            <option v-for="c in ownClasses" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </DsNativeSelect>
        </div>
      </DsPanel>

      <DsPanel v-if="school.data.value && !schoolSet" data-testid="pelajar-no-school">
        <DsEmptyState
          :title="PELAJAR_COPY.noSchoolTitle"
          :description="PELAJAR_COPY.noSchoolBody"
          icon="buildings"
        >
          <template v-if="allows('/guru/profil/edit')" #actions>
            <UButton
              to="/guru/profil/edit"
              icon="i-ph-user-gear"
              class="min-h-11"
              data-testid="pelajar-profile-link"
              >{{ PELAJAR_COPY.profileSettings }}</UButton
            >
          </template>
        </DsEmptyState>
      </DsPanel>
      <template v-else-if="school.data.value">
        <UInput
          v-model="search"
          type="search"
          icon="i-ph-magnifying-glass-duotone"
          :placeholder="PELAJAR_COPY.searchPlaceholder"
          :aria-label="PELAJAR_COPY.searchPlaceholder"
          class="w-full"
          data-testid="pelajar-search"
        />
        <DsPanel v-if="schoolRows.length === 0" data-testid="pelajar-school-empty">
          <DsEmptyState :title="PELAJAR_COPY.schoolEmpty" icon="graduation-cap" size="sm" />
        </DsPanel>
        <ul v-else class="flex flex-col gap-2" data-testid="pelajar-school-list">
          <StudentRow
            v-for="s in schoolRows"
            :key="s.id"
            :student="s"
            mode="school"
            :can-add="targetClass !== ''"
            :already-in="isInClass(s, { id: targetClass, name: targetName })"
            :busy="busy"
            @add="add"
          />
        </ul>
      </template>
      <div v-else class="flex flex-col gap-2" aria-busy="true" data-testid="pelajar-loading">
        <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
      </div>
    </template>
  </DsPage>
</template>
