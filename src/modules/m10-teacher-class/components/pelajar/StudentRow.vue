<script setup lang="ts">
/**
 * One student row of S6 (PROPOSED, FR-M10-36/37): name, level, the viewer's class chips. On the
 * "Pelajar Saya" tab each chip with a known class id has a remove button (#17); on the school tab
 * the row has an add button (#16) for the class chosen in the "Tambah pelajar ke:" bar. A card at
 * every width (layers, no lines); the name links to the student's prestasi page.
 */
import { computed } from 'vue'

import { DsCluster, DsIdentity, DsPanel, DsStatusBadge, DsText } from '@/ds'

import type { GuruStudent } from '../../api/types'
import { PELAJAR_COPY } from './copy'
import { chipsOf, type StudentChip } from './student-classes'

/** Two-letter avatar initials of a name. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
}

const props = defineProps<{
  student: GuruStudent
  mode: 'mine' | 'school'
  /**
   * Fallback for an API without `student.classes` (SW5-03): class name → id for the chips that can
   * be removed (unique active class names only). Chips that carry an id never read it.
   */
  classIds?: ReadonlyMap<string, number>
  /** School tab: the student is already in the chosen class. */
  alreadyIn?: boolean
  busy?: boolean
}>()
defineEmits<{ add: [studentId: number]; remove: [studentId: number, classId: number] }>()

const chips = computed(() => chipsOf(props.student))

/** `dd/mm/yyyy` of an instant in Malaysia time (MYT), or the dash when there is none. */
const MYT_DATE = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
function dateOf(iso: string | null): string {
  if (iso === null) return PELAJAR_COPY.none
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? PELAJAR_COPY.none : MYT_DATE.format(d)
}

/** The "Pelajar Saya" columns after the class chips (FR-GUR-41-6): Tahap, Tugasan, Skor Purata, Terakhir Aktif. */
const columns = computed(() => [
  { key: 'tahap', label: PELAJAR_COPY.colTahap, value: props.student.levelName ?? PELAJAR_COPY.none },
  { key: 'tugasan', label: PELAJAR_COPY.colTugasan, value: String(props.student.tugasan) },
  {
    key: 'skor',
    label: PELAJAR_COPY.colSkor,
    value: props.student.skorPurata === null ? PELAJAR_COPY.none : `${String(props.student.skorPurata)}%`,
  },
  { key: 'active', label: PELAJAR_COPY.colActive, value: dateOf(props.student.lastActiveAt) },
])

/** The class a chip's remove button acts on: its own id, else the name's id when the name is unique. */
function removeIdOf(chip: StudentChip): number | undefined {
  return chip.id ?? props.classIds?.get(chip.name)
}
</script>

<template>
  <li class="min-w-0" data-testid="student-row" :data-student-id="student.id">
    <DsPanel>
      <div class="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <div class="min-w-0 flex-1">
            <DsIdentity
              :name="student.name"
              :sub="(mode === 'mine' ? student.username : student.levelName) ?? undefined"
              :initials="initialsOf(student.name)"
            >
              <template #name
                ><span data-testid="student-name">{{ student.name }}</span></template
              >
            </DsIdentity>
            <DsCluster v-if="mode === 'mine'" gap="md" data-testid="student-columns">
              <DsText
                v-for="c in columns"
                :key="c.key"
                as="span"
                variant="caption"
                tone="muted"
                :data-testid="`student-${c.key}`"
                >{{ c.label }}: {{ c.value }}</DsText
              >
            </DsCluster>
            <ul v-if="chips.length > 0" class="mt-2 flex flex-wrap items-center gap-2">
              <li
                v-for="chip in chips"
                :key="chip.key"
                class="inline-flex items-center gap-1"
                data-testid="student-class"
              >
                <UBadge color="primary" variant="subtle">{{ chip.name }}</UBadge>
                <UButton
                  v-if="mode === 'mine' && removeIdOf(chip) !== undefined"
                  type="button"
                  color="neutral"
                  variant="ghost"
                  icon="i-ph-x"
                  :aria-label="`Keluarkan daripada ${chip.name}`"
                  class="size-11 justify-center"
                  :disabled="busy"
                  data-testid="student-remove"
                  @click="$emit('remove', student.id, removeIdOf(chip) as number)"
                />
              </li>
            </ul>
          </div>
        </div>
        <template v-if="mode === 'school'">
          <DsStatusBadge
            v-if="alreadyIn"
            status="active"
            :label="PELAJAR_COPY.inClass"
            data-testid="student-in-class"
          />
          <UButton
            v-else
            type="button"
            icon="i-ph-plus"
            class="min-h-11"
            :disabled="busy"
            data-testid="student-add"
            @click="$emit('add', student.id)"
            >{{ PELAJAR_COPY.add }}</UButton
          >
        </template>
      </div>
    </DsPanel>
  </li>
</template>
