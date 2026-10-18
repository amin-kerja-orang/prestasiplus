<script setup lang="ts">
/**
 * S6 `/practice/revision` "Soalan Aku Salah" (M05-T5; FR-M05-68…73, BR-14; DV-M05-01, DV-M05-15),
 * restyled for v2 (batch B01).
 *
 * - Title block, the total of queued questions (orange character card), one card per subject with
 *   queued questions (grid 1 / `md` 2 / `lg` 3) linking to S7, the "Tips Ulang Kaji" card and
 *   "Kembali ke Latihan".
 * - The info flash "Tiada soalan salah untuk subjek ini. Tahniah!" (set by S7 for a subject with no
 *   queued question) shows once, between the total and the cards as on live, and is gone on reload.
 * - No queued question at all: the total reads "0 soalan perlu diulang kaji" and no card shows (INFERRED, LS-11).
 */
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { useApi } from '@/composables'
import { DsCharacterCard, DsIconChip, DsLoadError, DsPage } from '@/ds'

import { fetchRevisionOverview } from '../api/practice'
import { subjectAccent, subjectGlyph } from '../components/quiz/subject-glyph'
import { takeRevisionFlash } from '../components/revision/revision-flash'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

// Read once when the page opens: the flash is shown once and cleared (FR-M05-72).
const flash = ref<string | null>(takeRevisionFlash())

const { data, error, reload } = useApi((signal) => fetchRevisionOverview({ signal }))
const subjects = computed(() => data.value?.subjects ?? [])

const TIPS = [
  'Soalan yang paling kerap dijawab salah akan dipaparkan dahulu',
  'Apabila anda jawab betul, soalan itu akan dikeluarkan dari senarai ini',
  'Anda tetap mendapat syiling dan coin seperti latihan biasa',
] as const
</script>

<template>
  <DsPage
    title="Soalan Aku Salah"
    subtitle="Ulang kaji soalan yang pernah dijawab salah"
    data-testid="revision-list-page"
  >

    <template v-if="data">
      <DsCharacterCard
        variant="warning"
        icon="i-ph-arrow-counter-clockwise-duotone"
        :title="`${data.total} soalan perlu diulang kaji`"
        data-testid="revision-total"
      />

      <UAlert
        v-if="flash"
        color="success"
        variant="soft"
        icon="i-ph-check-circle-duotone"
        :title="flash"
        data-testid="revision-flash"
      />

      <ul
        v-if="subjects.length > 0"
        class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3"
        data-testid="revision-grid"
      >
        <li v-for="(s, i) in subjects" :key="s.code" class="min-w-0">
          <RouterLink
            :to="`/practice/revision/${s.code}`"
            class="block h-full"
            :data-testid="`revision-subject-${s.code}`"
          >
            <UCard class="h-full">
              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-3">
                  <DsIconChip
                    :icon="subjectGlyph(s.icon)"
                    :accent="subjectAccent(i)"
                    size="lg"
                    data-testid="revision-subject-icon"
                  />
                  <div class="flex min-w-0 flex-1 flex-col gap-1">
                    <h2
                      class="truncate text-subheading text-highlighted"
                      data-testid="revision-subject-name"
                    >
                      {{ s.name }}
                    </h2>
                    <p class="text-caption text-muted">{{ s.nameEn }}</p>
                  </div>
                  <UIcon
                    name="i-ph-caret-right-bold"
                    class="size-5 shrink-0 text-muted"
                    aria-hidden="true"
                  />
                </div>
                <UBadge
                  color="error"
                  variant="solid"
                  size="lg"
                  icon="i-ph-x-circle-bold"
                  class="self-start"
                  data-testid="revision-subject-count"
                  >{{ s.count }} soalan salah</UBadge
                >
              </div>
            </UCard>
          </RouterLink>
        </li>
      </ul>

      <UCard data-testid="revision-tips">
        <div class="flex flex-col gap-3">
          <h2 class="flex items-center gap-2 text-subheading text-highlighted">
            <UIcon name="i-ph-lightbulb-duotone" class="size-6 text-warning" aria-hidden="true" />
            Tips Ulang Kaji
          </h2>
          <ul class="flex flex-col gap-2">
            <li v-for="tip in TIPS" :key="tip" class="text-body text-default">{{ tip }}</li>
          </ul>
        </div>
      </UCard>

      <UButton
        to="/practice"
        color="neutral"
        variant="ghost"
        icon="i-ph-arrow-left-bold"
        class="min-h-11 self-center"
        data-testid="revision-back"
        >Kembali ke Latihan</UButton
      >
    </template>

    <DsLoadError
      v-else-if="error"
      :message="LOAD_ERROR"
      retry-testid="revision-retry"
      testid="revision-error"
      @retry="reload()"
    />
  </DsPage>
</template>
