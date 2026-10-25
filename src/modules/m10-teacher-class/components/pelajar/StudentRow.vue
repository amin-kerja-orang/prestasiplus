<script setup lang="ts">
/**
 * One student row of S6 (PROPOSED, FR-M10-36/37): name, level, the viewer's class chips. On the
 * "Pelajar Saya" tab each chip with a known class id has a remove button (#17); on the school tab
 * the row has an add button (#16) for the class chosen in the "Tambah pelajar ke:" bar. A card at
 * every width (layers, no lines). D54/T3 (DV-M10-35): the name links to the student's Prestasi 360
 * (`/prestasi/{id}`) when the viewer may open it, i.e. the student is in one of the viewer's own
 * classes (M08 BR-M08-26: a teacher opens only pupils of own classes, else 403); the "Pelajar
 * Sekolah" rows of other students stay plain text.
 */
import { computed } from 'vue'

import { DsIdentity, DsPanel, DsStatusBadge } from '@/ds'

import type { GuruStudent } from '../../api/types'
import { PELAJAR_COPY } from './copy'

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
  /** Class name → id for the chips that can be removed (unique active class names only). */
  classIds?: ReadonlyMap<string, number>
  /** School tab: a class is chosen. */
  canAdd?: boolean
  /** School tab: the student is already in the chosen class. */
  alreadyIn?: boolean
  busy?: boolean
}>()
/** The viewer teaches this student (`classNames` = the viewer's own active classes). */
const prestasiTo = computed(() =>
  props.student.classNames.length > 0 ? `/prestasi/${String(props.student.id)}` : null,
)
defineEmits<{ add: [studentId: number]; remove: [studentId: number, classId: number] }>()
</script>

<template>
  <li class="min-w-0" data-testid="student-row" :data-student-id="student.id">
    <DsPanel>
      <div class="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <div class="min-w-0 flex-1">
            <DsIdentity
              :name="student.name"
              :sub="student.levelName ?? undefined"
              :initials="initialsOf(student.name)"
            >
              <template #name
                ><ULink
                  v-if="prestasiTo"
                  :to="prestasiTo"
                  class="block truncate"
                  data-testid="student-name"
                  >{{ student.name }}</ULink
                >
                <span v-else data-testid="student-name">{{ student.name }}</span></template
              >
            </DsIdentity>
            <ul v-if="student.classNames.length > 0" class="mt-2 flex flex-wrap items-center gap-2">
              <li
                v-for="cls in student.classNames"
                :key="cls"
                class="inline-flex items-center gap-1"
                data-testid="student-class"
              >
                <UBadge color="primary" variant="subtle">{{ cls }}</UBadge>
                <UButton
                  v-if="mode === 'mine' && classIds?.has(cls)"
                  type="button"
                  color="neutral"
                  variant="ghost"
                  icon="i-ph-x"
                  :aria-label="`Keluarkan daripada ${cls}`"
                  class="size-11 justify-center"
                  :disabled="busy"
                  data-testid="student-remove"
                  @click="$emit('remove', student.id, classIds?.get(cls) as number)"
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
            :disabled="!canAdd || busy"
            data-testid="student-add"
            @click="$emit('add', student.id)"
            >{{ PELAJAR_COPY.add }}</UButton
          >
        </template>
      </div>
    </DsPanel>
  </li>
</template>
