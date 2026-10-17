<script setup lang="ts">
/** "Subjek Tersedia" (FR-M05-23, 24): one card per subject with its question count and a start link. */
import { computed, ref } from 'vue'

import { DsArt3D } from '@/ds'

import type { PracticeSubject } from '../../api/types'
import SubjectIcon from '../quiz/SubjectIcon.vue'

const props = defineProps<{ subjects: PracticeSubject[] }>()

/** Compact by default: the first 6 subjects, then "Lihat semua". */
const COMPACT = 6
const showAll = ref(false)
const shown = computed(() => (showAll.value ? props.subjects : props.subjects.slice(0, COMPACT)))
</script>

<template>
  <section
    class="flex flex-col gap-3"
    aria-labelledby="dash-subjects-h"
    data-testid="dash-subjects"
  >
    <div class="flex items-center justify-between gap-3">
      <h2 id="dash-subjects-h" class="text-heading text-highlighted">📖 Subjek Tersedia</h2>
      <span class="flex items-center gap-2">
        <DsArt3D name="books" size="sm" />
        <span class="text-label text-muted" data-testid="dash-subjects-count"
          >{{ subjects.length }} subjek</span
        >
      </span>
    </div>
    <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <li v-for="s in shown" :key="s.code" class="min-w-0" :data-testid="`dash-subject-${s.code}`">
        <UCard :ui="{ body: 'flex h-full flex-col gap-2 p-4' }">
          <div class="flex items-center justify-between gap-2">
            <span
              class="grid size-10 place-items-center text-heading text-primary"
              data-testid="dash-subject-icon"
            >
              <SubjectIcon :icon="s.icon" class="size-6" />
            </span>
            <UBadge color="neutral" variant="subtle" data-testid="dash-subject-count"
              >{{ s.approvedCount }} soalan</UBadge
            >
          </div>
          <h3 class="text-subheading text-highlighted" data-testid="dash-subject-name">
            {{ s.name }}
          </h3>
          <p class="text-caption text-muted">{{ s.nameEn }}</p>
          <p v-if="s.isCore" class="text-caption text-warning" data-testid="dash-subject-core">
            ⭐ Subjek Teras
          </p>
          <UButton
            :to="`/practice?subject=${s.code}`"
            block
            class="mt-auto min-h-11"
            data-testid="dash-subject-start"
            >Mula Latihan 🚀</UButton
          >
        </UCard>
      </li>
    </ul>
    <UButton
      v-if="subjects.length > 6"
      color="neutral"
      variant="soft"
      class="min-h-11 self-center"
      :aria-expanded="showAll ? 'true' : 'false'"
      data-testid="dash-subjects-toggle"
      @click="showAll = !showAll"
      >{{ showAll ? 'Tunjuk kurang' : 'Lihat semua' }}</UButton
    >
  </section>
</template>
