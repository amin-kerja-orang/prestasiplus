<script setup lang="ts">
/**
 * S6 `/guru/pelajar` (FR-M10-35..37; URS FT-M10-3.3): counter, "Cipta Pelajar" link, tabs
 * "Pelajar Sekolah" / "Pelajar Saya" (default, client state), the empty and no-school cards, and
 * the PROPOSED student rows with add (#16) and remove (#17).
 */
import { computed, ref } from 'vue'

import { ApiError } from '@/api'
import { useApi, useDebouncedRef, useFlash, usePrototypeScope } from '@/composables'
import { DsIconChip, DsPage, useConfirm } from '@/ds'

import {
  addStudentToClass,
  fetchGuruClasses,
  fetchGuruStudents,
  removeStudentFromClass,
} from '../api/guru'
import type { StudentTab } from '../api/types'
import { PELAJAR_COPY } from '../components/pelajar/copy'
import NativeSelect from '../components/native/NativeSelect.vue'
import StudentRow from '../components/pelajar/StudentRow.vue'

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
  if (!(await confirm({ message: PELAJAR_COPY.removeConfirm, tone: 'danger' }))) return
  await act(() => removeStudentFromClass(studentId, classId), PELAJAR_COPY.removed)
}
</script>

<template>
  <DsPage data-testid="pelajar-page">
    <UCard>
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <DsIconChip icon="i-ph-users-three-duotone" size="lg" />
          <div class="min-w-0">
            <p class="tabular text-title text-highlighted" data-testid="pelajar-count">
              {{ count }}
            </p>
            <p class="text-body text-muted">{{ PELAJAR_COPY.counterLabel }}</p>
          </div>
        </div>
        <UButton
          to="/guru/pelajar/cipta"
          icon="i-ph-user-plus-duotone"
          class="min-h-11 shrink-0"
          data-testid="pelajar-create"
          >Cipta<span class="hidden sm:inline">&nbsp;Pelajar</span></UButton
        >
      </div>
    </UCard>

    <UFieldGroup class="w-full sm:w-fit" data-testid="pelajar-tabs">
      <UButton
        type="button"
        :color="tab === 'school' ? 'primary' : 'neutral'"
        :variant="tab === 'school' ? 'solid' : 'soft'"
        icon="i-ph-buildings-duotone"
        class="min-h-11 grow justify-center"
        :aria-pressed="tab === 'school'"
        data-testid="tab-school"
        @click="tab = 'school'"
        >{{ PELAJAR_COPY.tabSchool }}</UButton
      >
      <UButton
        type="button"
        :color="tab === 'mine' ? 'primary' : 'neutral'"
        :variant="tab === 'mine' ? 'solid' : 'soft'"
        icon="i-ph-user-check-duotone"
        class="min-h-11 grow justify-center"
        :aria-pressed="tab === 'mine'"
        data-testid="tab-mine"
        @click="tab = 'mine'"
      >
        {{ PELAJAR_COPY.tabMine }}
        <UBadge color="neutral" variant="subtle" data-testid="tab-mine-count">{{ count }}</UBadge>
      </UButton>
    </UFieldGroup>

    <UAlert
      v-if="loadError"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle-duotone"
      :title="PELAJAR_COPY.loadFailed"
      :actions="[
        { label: 'Cuba Lagi', color: 'neutral', variant: 'soft', onClick: () => reloadAll() },
      ]"
      role="alert"
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
      <UCard v-else-if="mineRows.length === 0" data-testid="pelajar-empty">
        <div class="flex flex-col items-center gap-2 py-6 text-center">
          <UIcon name="i-ph-graduation-cap-duotone" class="size-12 text-dimmed" />
          <h2 class="text-subheading text-highlighted">{{ PELAJAR_COPY.emptyTitle }}</h2>
          <p class="text-body text-muted">{{ PELAJAR_COPY.emptyBody }}</p>
          <UButton
            to="/guru/kelas/cipta"
            icon="i-ph-plus"
            class="mt-3 min-h-11"
            data-testid="pelajar-empty-create"
            >{{ PELAJAR_COPY.createClass }}</UButton
          >
        </div>
      </UCard>
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
      <UCard data-testid="pelajar-add-bar">
        <div class="flex flex-wrap items-center gap-3">
          <label for="pelajar-target" class="flex items-center gap-2 text-label text-highlighted">
            <UIcon name="i-ph-plus-circle-duotone" class="size-4 text-primary" />{{
              PELAJAR_COPY.addTo
            }}
          </label>
          <NativeSelect
            id="pelajar-target"
            v-model="targetClass"
            class="min-w-0 grow"
            data-testid="pelajar-target"
          >
            <option value="">{{ PELAJAR_COPY.chooseClass }}</option>
            <option v-for="c in ownClasses" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </NativeSelect>
        </div>
      </UCard>

      <UCard v-if="school.data.value && !schoolSet" data-testid="pelajar-no-school">
        <div class="flex flex-col items-center gap-2 py-6 text-center">
          <UIcon name="i-ph-buildings-duotone" class="size-12 text-dimmed" />
          <h2 class="text-subheading text-highlighted">{{ PELAJAR_COPY.noSchoolTitle }}</h2>
          <p class="max-w-prose text-body text-muted">{{ PELAJAR_COPY.noSchoolBody }}</p>
          <UButton
            v-if="allows('/guru/profil/edit')"
            to="/guru/profil/edit"
            icon="i-ph-user-gear-duotone"
            class="mt-3 min-h-11"
            data-testid="pelajar-profile-link"
            >{{ PELAJAR_COPY.profileSettings }}</UButton
          >
        </div>
      </UCard>
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
        <UCard v-if="schoolRows.length === 0" data-testid="pelajar-school-empty">
          <p class="py-4 text-center text-body text-muted">{{ PELAJAR_COPY.schoolEmpty }}</p>
        </UCard>
        <ul v-else class="flex flex-col gap-2" data-testid="pelajar-school-list">
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
      <div v-else class="flex flex-col gap-2" aria-busy="true" data-testid="pelajar-loading">
        <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
      </div>
    </template>
  </DsPage>
</template>
