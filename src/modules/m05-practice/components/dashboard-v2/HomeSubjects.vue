<script setup lang="ts">
/** "Subjek Tersedia" (FR-M05-23, 24): one card per subject with its question count and a start link. */
import { computed, ref } from 'vue'

import { DsArt3D, DsIconChip, DsStack, DsCluster, DsGrid, DsHeading, DsText } from '@/ds'

import type { PracticeSubject } from '../../api/types'
import { subjectAccent, subjectGlyph } from '../quiz/subject-glyph'

const props = defineProps<{ subjects: PracticeSubject[] }>()

/** Compact by default: the first 6 subjects, then "Lihat semua". */
const COMPACT = 6
const showAll = ref(false)
const shown = computed(() => (showAll.value ? props.subjects : props.subjects.slice(0, COMPACT)))
</script>

<template>
  <DsStack as="section" gap="sm" aria-labelledby="dash-subjects-h" data-testid="dash-subjects">
    <DsCluster justify="between" :wrap="false">
      <DsHeading id="dash-subjects-h" :level="2">📖 Subjek Tersedia</DsHeading>
      <DsCluster as="span" gap="xs" :wrap="false">
        <DsArt3D name="books" size="sm" />
        <DsText variant="label" tone="muted" data-testid="dash-subjects-count"
          >{{ subjects.length }} subjek</DsText
        >
      </DsCluster>
    </DsCluster>
    <DsGrid :cols="{ base: 1, sm: 2, xl: 3 }" gap="sm" as="ul">
      <li
        v-for="(s, i) in shown"
        :key="s.code"
        class="min-w-0"
        :data-testid="`dash-subject-${s.code}`"
      >
        <UCard :ui="{ body: 'flex h-full flex-col gap-2 p-4' }">
          <DsCluster gap="xs" justify="between" :wrap="false">
            <DsIconChip
              :icon="subjectGlyph(s.icon)"
              :accent="subjectAccent(i)"
              size="lg"
              data-testid="dash-subject-icon"
            />
            <UBadge color="neutral" variant="subtle" data-testid="dash-subject-count"
              >{{ s.approvedCount }} soalan</UBadge
            >
          </DsCluster>
          <DsHeading :level="3" data-testid="dash-subject-name">
            {{ s.name }}
          </DsHeading>
          <DsText variant="caption">{{ s.nameEn }}</DsText>
          <DsText v-if="s.isCore" variant="caption" tone="warning" data-testid="dash-subject-core">
            ⭐ Subjek Teras
          </DsText>
          <UButton
            :to="`/practice?subject=${s.code}`"
            block
            class="mt-auto min-h-11"
            data-testid="dash-subject-start"
            >Mula Latihan 🚀</UButton
          >
        </UCard>
      </li>
    </DsGrid>
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
  </DsStack>
</template>
