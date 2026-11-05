<script setup lang="ts">
/**
 * Edit Pengguna tab "Ibu Bapa" (R1-ADM-P2-16, S6-T15): the card "Anak yang Dipautkan" of one parent. ONE
 * writer per action: the list and "Buang pautan" use `admin/parent-links` (list / delete); adding a child
 * saves at once through the user update with `linkedStudentIds` = the CURRENT linked ids + the new one
 * (the server replaces the whole set, so an existing link is never dropped). At most 10 children
 * (FR-ADM-U02): the search is disabled at 10 and says so. Search reuses `GET /api/students/search`.
 */
import { computed, ref } from 'vue'

import { useApi, useSearchPicker } from '@/composables'
import { isHttpMode } from '@/api/mode'
import {
  DsCallout,
  DsDialog,
  DsFormField,
  DsHeading,
  DsIcon,
  DsListRow,
  DsStack,
  DsStateView,
  DsSurface,
  DsText,
} from '@/ds'

import { deleteAdminParentLink, listAdminParentLinks, type AdminParentLink } from '../api/parent-invite'
import {
  rolesAfterEdit,
  searchStudents,
  updateAdminUser,
  type AdminUserDetail,
  type StudentSearchItem,
} from '../api/users'
import { errorLines } from '../lib/user-list'
import { studentSearchMinChars } from '../lib/user-form-options'

const MAX_CHILDREN = 10

const props = defineProps<{ user: AdminUserDetail }>()

const { data, error: loadError, loading, reload } = useApi(
  (signal) => listAdminParentLinks({ parentId: props.user.id, signal }),
  () => props.user.id,
)
const links = computed<AdminParentLink[]>(() => data.value?.data ?? [])
const linkedIds = computed(() => links.value.map((l) => l.student.id))
const full = computed(() => links.value.length >= MAX_CHILDREN)

const errors = ref<string[]>([])
const busy = ref(false)

// --- search ------------------------------------------------------------------------------------------
const rootComp = ref<{ $el: Element } | null>(null)
const root = computed(() => rootComp.value?.$el ?? null)
const viewStatus = computed<'loading' | 'error' | 'ready'>(() =>
  loadError.value ? 'error' : loading.value && data.value === null ? 'loading' : 'ready',
)
/** Already linked children are not offered again. */
const offered = computed(() => results.value.filter((s) => !linkedIds.value.includes(s.id)))
const doneTerm = ref('')
const minChars = studentSearchMinChars()
const picker = useSearchPicker<StudentSearchItem>({
  minChars,
  root,
  search: async (term, signal) => {
    const rows = await searchStudents(term, { signal })
    doneTerm.value = term
    return rows
  },
})
const { term, results, open, searching } = picker
const longEnough = computed(() => term.value.length >= minChars)
const showEmpty = computed(
  () =>
    longEnough.value &&
    !searching.value &&
    doneTerm.value === term.value &&
    offered.value.length === 0,
)
const showDropdown = computed(
  () =>
    open.value &&
    !full.value &&
    longEnough.value &&
    (searching.value || offered.value.length > 0 || showEmpty.value),
)

function onInput(value: string): void {
  picker.setTerm(value)
  picker.onFocus()
}

async function add(student: StudentSearchItem): Promise<void> {
  if (busy.value || full.value || linkedIds.value.includes(student.id)) return
  busy.value = true
  errors.value = []
  try {
    const u = props.user
    await updateAdminUser(u.id, {
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: 'parent',
      isActive: u.isActive,
      ...(isHttpMode() ? { roles: rolesAfterEdit(u.roles ?? [], 'parent') } : {}),
      // The server replaces the whole set: keep every current link, add the new one.
      linkedStudentIds: [...linkedIds.value, student.id],
    })
    picker.reset()
    doneTerm.value = ''
    await reload()
  } catch (err) {
    errors.value = errorLines(err)
  } finally {
    busy.value = false
  }
}

// --- remove ------------------------------------------------------------------------------------------
const removing = ref<AdminParentLink | null>(null)
const removeOpen = computed({
  get: () => removing.value !== null,
  set: (open: boolean) => {
    if (!open && !busy.value) removing.value = null
  },
})

async function confirmRemove(): Promise<void> {
  const link = removing.value
  if (!link || busy.value) return
  busy.value = true
  errors.value = []
  try {
    await deleteAdminParentLink(link.linkId)
    removing.value = null
    await reload()
  } catch (err) {
    removing.value = null
    errors.value = errorLines(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DsStack ref="rootComp" as="section" data-testid="parents-tab">
    <DsStack as="header" gap="xs">
      <DsHeading :level="3" variant="label">
        <DsIcon name="baby" />
        Anak yang Dipautkan
      </DsHeading>
    </DsStack>

    <DsCallout
      v-if="errors.length > 0"
      tone="error"
      :title="errors.join(' ')"
      data-testid="parents-alert"
    />

    <DsFormField native for="parents-search" label="Cari pelajar">
      <DsStack gap="xs">
        <UInput
          id="parents-search"
          :model-value="term"
          type="text"
          autocomplete="off"
          placeholder="Cari nama atau emel pelajar..."
          :loading="searching"
          :disabled="full || busy"
          aria-label="Cari pelajar"
          data-testid="parents-search"
          @update:model-value="onInput"
          @focus="picker.onFocus()"
        />
        <DsSurface
          v-if="showDropdown"
          level="elevated"
          shadow="lift"
          padding="sm"
          data-testid="parents-dropdown"
        >
          <DsStateView
            v-if="searching"
            status="loading"
            skeleton="text"
            :rows="1"
            data-testid="parents-search-loading"
          />
          <DsStack v-else as="ul" gap="xs">
            <DsListRow
              v-for="student in offered"
              :key="student.id"
              button
              density="tight"
              :title="student.name"
              :sub="[student.classLevel, student.schoolName].filter(Boolean).join(' · ')"
              data-testid="parents-result"
              @select="add(student)"
            />
            <DsText v-if="showEmpty" as="li" variant="label" tone="muted" data-testid="parents-search-empty">
              Tiada pelajar dijumpai
            </DsText>
          </DsStack>
        </DsSurface>
      </DsStack>
    </DsFormField>
    <DsText v-if="full" variant="caption" tone="muted" data-testid="parents-max">
      Paling banyak 10 anak boleh dipautkan.
    </DsText>

    <DsStateView
      v-if="viewStatus !== 'ready'"
      :status="viewStatus"
      skeleton="list"
      :rows="2"
      error="Tidak dapat memuatkan pautan. Sila cuba semula."
      :data-testid="viewStatus === 'error' ? 'parents-load-error' : 'parents-skeleton'"
      @retry="reload()"
    />
    <DsStack v-else-if="links.length > 0" as="ul" gap="xs" data-testid="parents-list">
      <DsListRow
        v-for="link in links"
        :key="link.linkId"
        :title="link.student.name"
        :sub="link.student.schoolName ?? undefined"
        data-testid="parents-row"
      >
        <template #meta>
          <UButton
            type="button"
            color="error"
            variant="ghost"
            label="Buang pautan"
            :disabled="busy"
            data-testid="parents-remove"
            @click="removing = link"
          />
        </template>
      </DsListRow>
    </DsStack>
    <DsText v-else variant="caption" tone="muted" data-testid="parents-none">
      Tiada pelajar dipautkan lagi
    </DsText>

    <DsDialog
      v-model:open="removeOpen"
      title="Buang pautan ini?"
      :loading="busy"
      data-testid="parents-remove-modal"
    >
      <DsText variant="body">Ibu bapa tidak lagi dapat melihat anak ini.</DsText>
      <template #footer>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          label="Batal"
          :disabled="busy"
          data-testid="parents-remove-cancel"
          @click="removing = null"
        />
        <UButton
          type="button"
          color="error"
          label="Ya, Buang"
          :disabled="busy"
          data-testid="parents-remove-confirm"
          @click="confirmRemove"
        />
      </template>
    </DsDialog>
  </DsStack>
</template>
