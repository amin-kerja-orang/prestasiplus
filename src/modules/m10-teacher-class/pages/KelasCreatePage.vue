<script setup lang="ts">
/**
 * R1-GUR-8 `/guru/kelas/cipta` and `/guru/kelas/:id/edit` (S6-T14; API-GUR-02 create, API-GUR-03 edit):
 * one page, two modes. Card "Maklumat Kelas": Nama Kelas, Tingkatan, Subjek (pilihan), Tahun Sesi.
 * No school picker, no description, no join code (D113). Client checks use the server texts
 * (`CLASS_MESSAGES`); a 422 shows each `fields.*` under its field, a 409 shows "Nama kelas sudah
 * digunakan." under the name. A teacher with no school sees the message instead of the form.
 * Edit mode adds the member list ("Keluarkan" after a confirm), "Tambah pelajar sedia ada" (type-ahead
 * over the school pupils) and a link to Cipta Pelajar (`/guru/pelajar/cipta`, S6-T10).
 */
import { CLASS_MESSAGES } from '@pp/contract'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useApi, useFlash } from '@/composables'
import { useSearchPicker } from '@/composables/useSearchPicker'
import {
  DsBackLink,
  DsCluster,
  DsDataTable,
  DsEmptyState,
  DsFormField,
  DsHeading,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStack,
  DsText,
  useConfirm,
} from '@/ds'
import { clock, formatDate, formatDateKey } from '@/lib/time'
import { useSessionStore } from '@/stores/session'

import {
  addStudentToClass,
  createGuruClass,
  fetchGuruClasses,
  fetchGuruStudents,
  removeStudentFromClass,
  updateGuruClass,
} from '../api/guru'
import type { EducationLevelSlug, GuruStudent } from '../api/types'
import { KELAS_COPY, LEVEL_TILES } from '../components/kelas/copy'
import { KELAS_COPY as KELAS_SAYA_COPY } from '../components/kelas-saya/copy'
import { fetchSubjectOptions } from '../components/kelas/subjects'
import { moduleMessage } from '../lib/generic-server-text'

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()
const session = useSessionStore()

const classId = computed(() => (typeof route.params.id === 'string' ? route.params.id : null))
const isEdit = computed(() => classId.value !== null)

const { data: subjects } = useApi((signal) => fetchSubjectOptions(signal))
/** The class of the edit page: there is no `GET /guru/classes/:id`, so it is read from the own list. */
const {
  data: classList,
  error: classError,
  reload: reloadClass,
} = useApi((signal) => fetchGuruClasses({ signal }), undefined, { immediate: isEdit.value })
const current = computed(
  () => classList.value?.data.find((c) => String(c.id) === classId.value) ?? null,
)

/** Account with no school (R1-GUR-8): the message replaces the form. */
const noSchool = computed(
  () =>
    session.user !== null && (session.user.schoolId === null || session.user.schoolId === undefined),
)

const currentYear = Number(formatDateKey(clock.now()).slice(0, 4))
const name = ref('')
const level = ref<EducationLevelSlug | ''>('')
const subjectId = ref('')
/** A number input hands over a number once edited; `asInt` reads both. */
const year = ref(String(currentYear))
const submitting = ref(false)
const fields = ref<Record<string, string>>({})
const failure = ref<string[]>([])
const INLINE_FIELDS = ['name', 'educationLevel', 'subjectId', 'year']

let filled = false
watch(
  current,
  (c) => {
    if (!c || filled) return
    filled = true
    name.value = c.name
    level.value = c.educationLevel
    subjectId.value = c.subjectId === null ? '' : String(c.subjectId)
    year.value = String(c.year ?? c.academicYear)
  },
  { immediate: true },
)

const asInt = (v: unknown): number => (String(v).trim() === '' ? Number.NaN : Number(v))

/** The same rules and texts as `ClassUpsertRequestSchema`. */
function validate(): Record<string, string> {
  const e: Record<string, string> = {}
  const n = name.value.trim()
  if (n === '') e.name = CLASS_MESSAGES.nameRequired
  else if ([...n].length > 100) e.name = CLASS_MESSAGES.nameTooLong
  if (level.value === '') e.educationLevel = CLASS_MESSAGES.educationLevelRequired
  const y = asInt(year.value)
  if (!Number.isInteger(y) || y < 2020 || y > 2100) e.year = CLASS_MESSAGES.yearRange
  return e
}

async function submit(): Promise<void> {
  if (submitting.value) return
  failure.value = []
  fields.value = validate()
  if (Object.keys(fields.value).length > 0) return
  submitting.value = true
  const body = {
    name: name.value.trim(),
    educationLevel: level.value as EducationLevelSlug,
    subjectId: subjectId.value === '' ? null : subjectId.value,
    year: asInt(year.value),
  }
  try {
    if (classId.value !== null) {
      await updateGuruClass(classId.value, body)
      flash.show({ type: 'success', message: CLASS_MESSAGES.updated })
      await reloadClass()
    } else {
      await createGuruClass(body)
      flash.success(CLASS_MESSAGES.created)
      await router.push('/guru/kelas')
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      fields.value = { name: CLASS_MESSAGES.nameTaken }
    } else if (err instanceof ApiError && err.fields) {
      fields.value = err.fields
      // A field without an inline slot (schoolId, description) goes to the box, so no message is lost.
      failure.value = Object.entries(err.fields)
        .filter(([key]) => !INLINE_FIELDS.includes(key))
        .map(([, message]) => message)
    } else if (err instanceof ApiError && err.status === 0) failure.value = [KELAS_SAYA_COPY.network]
    else failure.value = [moduleMessage(err) ?? KELAS_COPY.createFailed]
  } finally {
    submitting.value = false
  }
}

// --- Edit mode: members --------------------------------------------------------------------------

/** `lastActiveAt` arrives with the S6-T10 roster fields; `null` or absent prints "—". */
type Pupil = GuruStudent & { lastActiveAt?: string | null }

const {
  data: roster,
  error: rosterError,
  reload: reloadRoster,
} = useApi((signal) => fetchGuruStudents({ tab: 'mine' }, { signal }), undefined, {
  immediate: isEdit.value,
})

const inThisClass = (p: Pupil): boolean =>
  p.classes
    ? p.classes.some((c) => String(c.id) === classId.value)
    : current.value !== null && p.classNames.includes(current.value.name)

const members = computed<Pupil[]>(() =>
  ((roster.value?.data ?? []) as Pupil[])
    .filter(inThisClass)
    .sort((a, b) => a.name.localeCompare(b.name, 'ms')),
)

interface MemberRow extends Record<string, unknown> {
  id: number
  name: string
  level: string
  active: string
}
const rows = computed<MemberRow[]>(() =>
  members.value.map((p) => ({
    id: p.id,
    name: p.name,
    level: p.levelName ?? '—',
    active: p.lastActiveAt ? formatDate(p.lastActiveAt) : '—',
  })),
)
const columns = [
  { accessorKey: 'name', header: KELAS_COPY.colName },
  { accessorKey: 'level', header: KELAS_COPY.colLevel },
  { accessorKey: 'active', header: KELAS_COPY.colActive },
  { accessorKey: 'actions', header: '' },
]
const cardFields = [
  { key: 'level', label: KELAS_COPY.colLevel },
  { key: 'active', label: KELAS_COPY.colActive },
]

const busy = ref<number | null>(null)

async function remove(row: MemberRow): Promise<void> {
  if (busy.value !== null || classId.value === null) return
  const ok = await confirm({
    title: KELAS_COPY.removeTitle,
    message: `${row.name} akan dikeluarkan daripada kelas ini. Akaun pelajar kekal.`,
    tone: 'error',
    confirmLabel: KELAS_COPY.remove,
  })
  if (!ok) return
  busy.value = row.id
  try {
    await removeStudentFromClass(row.id, classId.value)
    flash.show({ type: 'success', message: KELAS_COPY.removed })
  } catch (err) {
    flash.show({ type: 'error', message: moduleMessage(err) ?? KELAS_COPY.memberFailed })
  } finally {
    busy.value = null
    await reloadRoster()
  }
}

// --- Edit mode: "Tambah pelajar sedia ada" ---------------------------------------------------------

const PICKER_MAX = 20
const picker = useSearchPicker<Pupil>({
  minChars: 2,
  openOnFocus: false,
  search: async (term, signal) => {
    const res = await fetchGuruStudents({ tab: 'school', search: term }, { signal })
    return (res.data as Pupil[]).filter((p) => !inThisClass(p)).slice(0, PICKER_MAX)
  },
})
const searched = computed(() => picker.term.value.trim().length >= 2)

async function addExisting(p: Pupil): Promise<void> {
  if (busy.value !== null || classId.value === null) return
  busy.value = p.id
  try {
    await addStudentToClass(p.id, { classroomId: classId.value })
    flash.show({ type: 'success', message: KELAS_COPY.added })
    picker.reset()
  } catch (err) {
    flash.show({ type: 'error', message: moduleMessage(err) ?? KELAS_COPY.memberFailed })
  } finally {
    busy.value = null
    await reloadRoster()
  }
}

const tiles = LEVEL_TILES
</script>

<template>
  <DsPage class="max-w-4xl" data-testid="kelas-create-page">
    <DsBackLink to="/guru/kelas" :label="KELAS_COPY.back" data-testid="kelas-back" />

    <UAlert
      v-if="noSchool"
      color="warning"
      variant="subtle"
      icon="i-ph-warning-circle-duotone"
      :title="CLASS_MESSAGES.noSchool"
      role="alert"
      data-testid="kelas-no-school"
    />

    <DsLoadError
      v-else-if="isEdit && classError"
      :message="KELAS_COPY.loadOneFailed"
      :retry-label="KELAS_COPY.retry"
      testid="kelas-error"
      @retry="reloadClass"
    />
    <USkeleton
      v-else-if="isEdit && !classList"
      class="h-64 w-full"
      aria-busy="true"
      data-testid="kelas-loading"
    />
    <DsPanel v-else-if="isEdit && !current" data-testid="kelas-not-found">
      <DsEmptyState :title="KELAS_COPY.notFound" icon="chalkboard-teacher" />
    </DsPanel>

    <template v-else>
      <DsStack as="form" gap="md" novalidate data-testid="kelas-form" @submit.prevent="submit">
        <UAlert
          v-if="failure.length"
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle-duotone"
          :title="failure.join(' ')"
          role="alert"
          data-testid="kelas-failure"
        />

        <DsPanel>
          <DsStack gap="md">
            <DsHeading :level="2" variant="subheading">{{ KELAS_COPY.info }}</DsHeading>

            <DsFormField :label="`${KELAS_COPY.name} *`" name="kelas-name" :error="fields.name">
              <UInput
                id="kelas-name"
                v-model="name"
                type="text"
                :placeholder="KELAS_COPY.namePlaceholder"
                class="w-full"
                data-testid="kelas-name"
              />
            </DsFormField>

            <DsFormField
              :label="`${KELAS_COPY.level} *`"
              name="kelas-level"
              :error="fields.educationLevel"
            >
              <DsNativeSelect id="kelas-level" v-model="level" data-testid="kelas-level">
                <option value="">{{ KELAS_COPY.levelPlaceholder }}</option>
                <option v-for="t in tiles" :key="t.slug" :value="t.slug">{{ t.label }}</option>
              </DsNativeSelect>
            </DsFormField>

            <DsFormField
              :label="KELAS_COPY.subject"
              name="kelas-subject"
              :error="fields.subjectId"
            >
              <DsNativeSelect id="kelas-subject" v-model="subjectId" data-testid="kelas-subject">
                <option value="">{{ KELAS_COPY.subjectNone }}</option>
                <option v-for="s in subjects ?? []" :key="s.id" :value="String(s.id)">
                  {{ s.name }}
                </option>
              </DsNativeSelect>
            </DsFormField>

            <DsFormField :label="`${KELAS_COPY.year} *`" name="kelas-year" :error="fields.year">
              <UInput
                id="kelas-year"
                v-model="year"
                type="number"
                inputmode="numeric"
                class="w-full"
                data-testid="kelas-year"
              />
            </DsFormField>
          </DsStack>
        </DsPanel>

        <DsCluster stack-below="sm">
          <UButton
            type="submit"
            size="xl"
            class="min-h-11 sm:min-w-48"
            :loading="submitting"
            :disabled="submitting"
            :icon="submitting ? undefined : 'i-ph-plus-circle-duotone'"
            data-testid="kelas-submit"
          >
            {{
              submitting
                ? KELAS_COPY.submitting
                : isEdit
                  ? KELAS_COPY.submitEdit
                  : KELAS_COPY.submit
            }}
          </UButton>
          <UButton
            to="/guru/kelas"
            color="neutral"
            variant="ghost"
            size="xl"
            class="min-h-11"
            data-testid="kelas-cancel"
            >{{ KELAS_COPY.cancel }}</UButton
          >
        </DsCluster>
      </DsStack>

      <template v-if="isEdit">
        <DsPanel data-testid="kelas-members-card">
          <DsStack gap="md">
            <DsHeading :level="2" variant="subheading">{{ KELAS_COPY.membersTitle }}</DsHeading>
            <DsLoadError
              v-if="rosterError"
              :message="KELAS_COPY.membersFailed"
              :retry-label="KELAS_COPY.retry"
              testid="kelas-members-error"
              @retry="reloadRoster"
            />
            <USkeleton v-else-if="!roster" class="h-24 w-full" aria-busy="true" />
            <DsEmptyState
              v-else-if="members.length === 0"
              size="sm"
              :title="CLASS_MESSAGES.noMembers"
              icon="users"
              data-testid="kelas-members-empty"
            />
            <DsDataTable
              v-else
              variant="bare"
              :data="rows"
              :columns="columns"
              :caption="KELAS_COPY.membersTitle"
              card-title="name"
              :card-fields="cardFields"
              data-testid="kelas-members"
            >
              <template #name-cell="{ row }">
                <span data-testid="member-name">{{ row.original.name }}</span>
              </template>
              <template #actions-cell="{ row }">
                <UButton
                  type="button"
                  color="error"
                  variant="soft"
                  icon="i-ph-user-minus-duotone"
                  class="min-h-11 min-w-11"
                  :loading="busy === row.original.id"
                  :disabled="busy !== null"
                  :aria-label="`${KELAS_COPY.remove} ${row.original.name}`"
                  data-testid="member-remove"
                  @click="remove(row.original)"
                  >{{ KELAS_COPY.remove }}</UButton
                >
              </template>
              <template #card-actions="{ row }">
                <UButton
                  type="button"
                  color="error"
                  variant="soft"
                  icon="i-ph-user-minus-duotone"
                  class="min-h-11 min-w-11"
                  :loading="busy === (row as MemberRow).id"
                  :disabled="busy !== null"
                  :aria-label="`${KELAS_COPY.remove} ${(row as MemberRow).name}`"
                  data-testid="member-remove"
                  @click="remove(row as MemberRow)"
                  >{{ KELAS_COPY.remove }}</UButton
                >
              </template>
            </DsDataTable>
          </DsStack>
        </DsPanel>

        <DsPanel data-testid="kelas-add-existing">
          <DsStack gap="md">
            <DsHeading :level="2" variant="subheading">{{ KELAS_COPY.addExisting }}</DsHeading>
            <DsFormField
              :label="KELAS_COPY.searchPupil"
              name="kelas-pupil-search"
              :hint="KELAS_COPY.searchHint"
            >
              <UInput
                id="kelas-pupil-search"
                :model-value="picker.term.value"
                type="search"
                autocomplete="off"
                :placeholder="KELAS_COPY.searchPupil"
                class="w-full"
                data-testid="kelas-pupil-search"
                @update:model-value="picker.setTerm(String($event))"
              />
            </DsFormField>
            <DsText
              v-if="searched && !picker.searching.value && picker.results.value.length === 0"
              variant="body"
              tone="muted"
              role="status"
              data-testid="kelas-pupil-none"
              >{{ CLASS_MESSAGES.noStudentFound }}</DsText
            >
            <DsStack
              v-if="picker.results.value.length > 0"
              as="ul"
              gap="xs"
              data-testid="kelas-pupil-results"
            >
              <li v-for="p in picker.results.value" :key="p.id" data-testid="kelas-pupil-option">
                <DsCluster justify="between" :wrap="false">
                  <DsText variant="body" wrap="anywhere" class="min-w-0"
                    >{{ p.name }} · {{ p.levelName ?? '—' }}</DsText
                  >
                  <UButton
                    type="button"
                    color="neutral"
                    variant="soft"
                    icon="i-ph-user-plus-duotone"
                    class="min-h-11 shrink-0"
                    :disabled="busy !== null"
                    :aria-label="`${KELAS_COPY.add} ${p.name}`"
                    data-testid="kelas-pupil-add"
                    @click="addExisting(p)"
                    >{{ KELAS_COPY.add }}</UButton
                  >
                </DsCluster>
              </li>
            </DsStack>
          </DsStack>
        </DsPanel>

        <DsPanel data-testid="kelas-new-pupil">
          <DsStack gap="sm">
            <DsHeading :level="2" variant="subheading">{{ KELAS_COPY.newPupil }}</DsHeading>
            <DsText variant="body" tone="muted">{{ KELAS_COPY.newPupilText }}</DsText>
            <DsCluster>
              <UButton
                to="/guru/pelajar/cipta"
                color="neutral"
                variant="soft"
                icon="i-ph-user-plus-duotone"
                class="min-h-11"
                data-testid="kelas-new-pupil-link"
                >{{ KELAS_COPY.newPupilLink }}</UButton
              >
            </DsCluster>
          </DsStack>
        </DsPanel>
      </template>
    </template>
  </DsPage>
</template>
