<script setup lang="ts">
/**
 * One student row of S6 (PROPOSED, FR-M10-36/37): name, level, the viewer's class chips. On the
 * "Pelajar Saya" tab each chip with a known class id has a remove button (#17); on the school tab
 * the row has an add button (#16) for the class chosen in the "Tambah pelajar ke:" bar. A card at
 * every width (layers, no lines); the name links to the student's prestasi page.
 */
import type { GuruStudent } from '../../api/types'
import { PELAJAR_COPY } from './copy'

defineProps<{
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
defineEmits<{ add: [studentId: number]; remove: [studentId: number, classId: number] }>()
</script>

<template>
  <li class="min-w-0" data-testid="student-row" :data-student-id="student.id">
    <UCard :ui="{ body: 'p-3 sm:p-3' }">
      <div class="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <UAvatar :alt="student.name" size="md" />
          <div class="min-w-0 flex-1">
            <p class="text-label break-words text-highlighted" data-testid="student-name">
              {{ student.name }}
            </p>
            <p v-if="student.levelName" class="text-caption text-muted" data-testid="student-level">
              {{ student.levelName }}
            </p>
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
          <UBadge
            v-if="alreadyIn"
            color="success"
            variant="subtle"
            icon="i-ph-check-circle-duotone"
            data-testid="student-in-class"
            >{{ PELAJAR_COPY.inClass }}</UBadge
          >
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
    </UCard>
  </li>
</template>
