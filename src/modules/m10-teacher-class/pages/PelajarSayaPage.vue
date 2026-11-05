<script setup lang="ts">
/**
 * S6 `/guru/pelajar` (FR-M10-35..37; URS FT-M10-3.3): counter, "Cipta Pelajar" link, tabs
 * "Pelajar Sekolah" / "Pelajar Saya" (default, client state), the empty and no-school cards, and
 * the PROPOSED student rows with add (#16) and remove (#17). R1-GUR-41 (S6-T10): the route
 * `/guru/pelajar/cipta` renders the same page with `create` set, which opens the "Cipta Pelajar" card
 * (Nama, Kelas, No. IC; API-GUR-06); the result message stays until dismissed; 25 rows per page.
 */
import { computed, ref, watch } from 'vue'

import { ApiError } from '@/api'

import { useApi, useDebouncedRef, useFlash, usePrototypeScope } from '@/composables'
import {
  DsCallout,
  DsEmptyState,
  DsFormField,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStack,
  DsText,
  DsPillNav,
  DsStatTile,
  useConfirm,
  type PillItem,
} from '@/ds'

import {
  addStudentToClass,
  createGuruStudent,
  fetchGuruClasses,
  fetchGuruStudents,
  removeStudentFromClass,
} from '../api/guru'
import type { StudentTab } from '../api/types'
import { PELAJAR_COPY } from '../components/pelajar/copy'
import StudentRow from '../components/pelajar/StudentRow.vue'
import { isInClass } from '../components/pelajar/student-classes'
import { moduleMessage } from '../lib/generic-server-text'

defineProps<{
  /** The route `/guru/pelajar/cipta`: the "Cipta Pelajar" card is open. */
  create?: boolean
}>()

const flash = useFlash()
const confirm = useConfirm()
// Prototype scope (D43): the teacher profile editor is outside the matrix.
const { allows } = usePrototypeScope()
const tab = ref<StudentTab>('mine')
const search = ref('')
const searchApplied = useDebouncedRef(search, 300)
const targetClass = ref('')
const busy = ref(false)
const minePage = ref(1)
const schoolPage = ref(1)
const targetError = ref('')

const mine = useApi(
  (signal) => fetchGuruStudents({ tab: 'mine', page: minePage.value }, { signal }),
  [minePage],
)
const classes = useApi((signal) => fetchGuruClasses({ signal }))
const school = useApi(
  async (signal) =>
    tab.value === 'school'
      ? fetchGuruStudents(
          { tab: 'school', search: searchApplied.value.trim(), page: schoolPage.value },
          { signal },
        )
      : null,
  [tab, searchApplied, schoolPage],
)
watch(searchApplied, () => {
  schoolPage.value = 1
})
watch(targetClass, () => {
  targetError.value = ''
})

const minePages = computed(() => mine.data.value?.meta.totalPages ?? 1)
const schoolPages = computed(() => school.data.value?.meta.totalPages ?? 1)

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

const add = (studentId: number): Promise<void> => {
  // AC-GUR-41-7: "Tambah" with no class chosen says so and adds nobody.
  if (targetClass.value === '') {
    targetError.value = PELAJAR_COPY.chooseClassFirst
    flash.show({ type: 'error', message: PELAJAR_COPY.chooseClassFirst })
    return Promise.resolve()
  }
  return act(
    () => addStudentToClass(studentId, { classroomId: targetClass.value }),
    PELAJAR_COPY.added,
  )
}

// --- Cipta Pelajar (API-GUR-06) -----------------------------------------------------------------

const IC_PATTERN = /^\d{12}$/
const newName = ref('')
const newClass = ref('')
const newIc = ref('')
const createFields = ref<Record<string, string>>({})
const creating = ref(false)
/** The server message "Pelajar dicipta. Login: ... / ...": shown until dismissed, never stored. */
const createdMessage = ref('')

/** The preselected class when the teacher has exactly one active class. */
const classChoice = computed(() =>
  newClass.value !== '' ? newClass.value : ownClasses.value.length === 1 ? String(ownClasses.value[0]?.id) : '',
)

function checkCreate(): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = newName.value.trim()
  if (name === '') errors.name = PELAJAR_COPY.errName
  else if (name.length > 255) errors.name = PELAJAR_COPY.errNameMax
  if (classChoice.value === '') errors.classroomId = PELAJAR_COPY.errClass
  const ic = newIc.value.trim()
  if (ic !== '' && !IC_PATTERN.test(ic)) errors.ic = PELAJAR_COPY.errIc
  return errors
}

async function submitCreate(): Promise<void> {
  if (creating.value) return
  createFields.value = checkCreate()
  if (Object.keys(createFields.value).length > 0) return
  creating.value = true
  createdMessage.value = ''
  try {
    const created = await createGuruStudent({
      name: newName.value.trim(),
      classroomId: classChoice.value,
      ...(newIc.value.trim() !== '' ? { ic: newIc.value.trim() } : {}),
    })
    createdMessage.value = created.message
    newName.value = ''
    newIc.value = ''
    minePage.value = 1
    await reloadAll()
  } catch (err) {
    if (err instanceof ApiError && err.fields) createFields.value = err.fields
    else flash.show({ type: 'error', message: moduleMessage(err) ?? PELAJAR_COPY.actionFailed })
  } finally {
    creating.value = false
  }
}

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

    <DsCallout
      v-if="createdMessage"
      tone="success"
      :title="createdMessage"
      dismissible
      data-testid="pelajar-created"
      @dismiss="createdMessage = ''"
    />

    <DsPanel v-if="create" data-testid="pelajar-create-card">
      <DsStack gap="md">
        <DsText as="p" variant="subheading" tone="highlighted">{{ PELAJAR_COPY.createTitle }}</DsText>
        <DsText as="p" variant="body" tone="muted">{{ PELAJAR_COPY.createIntro }}</DsText>
        <DsText
          v-if="classes.data.value && ownClasses.length === 0"
          as="p"
          variant="body"
          tone="warning"
          role="status"
          data-testid="pelajar-create-no-class"
          >{{ PELAJAR_COPY.noActiveClass }}</DsText
        >
        <DsStack v-else-if="classes.data.value" as="form" gap="md" data-testid="pelajar-create-form" @submit.prevent="submitCreate">
          <DsFormField :label="PELAJAR_COPY.fieldName" name="pelajar-new-name" required :error="createFields.name">
            <UInput id="pelajar-new-name" v-model="newName" type="text" class="w-full" data-testid="pelajar-new-name" />
          </DsFormField>
          <DsFormField :label="PELAJAR_COPY.fieldClass" name="pelajar-new-class" required :error="createFields.classroomId">
            <DsNativeSelect id="pelajar-new-class" :model-value="classChoice" data-testid="pelajar-new-class" @update:model-value="newClass = String($event)">
              <option value="">{{ PELAJAR_COPY.chooseClass }}</option>
              <option v-for="c in ownClasses" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
            </DsNativeSelect>
          </DsFormField>
          <DsFormField :label="PELAJAR_COPY.fieldIc" name="pelajar-new-ic" :hint="PELAJAR_COPY.fieldIcHint" :error="createFields.ic">
            <UInput id="pelajar-new-ic" v-model="newIc" type="text" inputmode="numeric" autocomplete="off" class="w-full" data-testid="pelajar-new-ic" />
          </DsFormField>
          <UButton type="submit" class="min-h-11" :loading="creating" :disabled="creating" data-testid="pelajar-new-submit">{{
            creating ? PELAJAR_COPY.submitting : PELAJAR_COPY.submitCreate
          }}</UButton>
        </DsStack>
      </DsStack>
    </DsPanel>

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
      <div v-if="minePages > 1" data-testid="pelajar-mine-pager">
        <UPagination
          :page="minePage"
          :total="mine.data.value?.meta.count ?? 0"
          :items-per-page="mine.data.value?.meta.pageSize ?? 25"
          @update:page="minePage = $event"
        />
      </div>
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
        <DsText
          v-if="targetError"
          as="p"
          variant="caption"
          tone="error"
          role="alert"
          data-testid="pelajar-target-error"
          >{{ targetError }}</DsText
        >
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
            :already-in="isInClass(s, { id: targetClass, name: targetName })"
            :busy="busy"
            @add="add"
          />
        </ul>
        <div v-if="schoolPages > 1" data-testid="pelajar-school-pager">
          <UPagination
            :page="schoolPage"
            :total="schoolRows.length === 0 ? 0 : (school.data.value?.meta.pageSize ?? 25) * schoolPages"
            :items-per-page="school.data.value?.meta.pageSize ?? 25"
            @update:page="schoolPage = $event"
          />
        </div>
      </template>
      <div v-else class="flex flex-col gap-2" aria-busy="true" data-testid="pelajar-loading">
        <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
      </div>
    </template>
  </DsPage>
</template>
