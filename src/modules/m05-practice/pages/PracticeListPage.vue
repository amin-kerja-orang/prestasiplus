<script setup lang="ts">
/**
 * S2 `/practice` "Latih Tubi" (M05-T4; FR-M05-29…34, BR-28, DV-M05-03, DV-M05-11), restyled for v2
 * (AR-HUB, batch B01).
 *
 * - Title block "Latih Tubi 🎯", the "Soalan by Chapter" banner → `/practice/chapter`.
 * - One card per practice subject (#2; grid 1 / `md` 2 / `xl` 3), each a link to `/practice/{CODE}`.
 *   The "Mula Latihan" element is a `<button>` inside the link with no handler of its own, as live
 *   (D-14 replicated, D10): a click follows the card link.
 * - `?subject={CODE}` and `?topic_id={id}` replace the URL with the subject's S3; `?level=` is ignored.
 */
import { computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsCharacterCard, DsIconChip } from '@/ds'
import { formatCount } from '@/lib/number'

import { fetchPracticeSubjects } from '../api/practice'
import { entryTarget } from '../components/quiz/entry-params'
import LoadError from '../components/quiz/LoadError.vue'
import { subjectGlyph } from '../components/quiz/subject-glyph'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const route = useRoute()
const router = useRouter()

const { data, error, reload } = useApi((signal) => fetchPracticeSubjects({ signal }))
const subjects = computed(() => data.value?.data ?? [])

// FR-M05-33: replace the URL when the entry parameter names a known subject.
watch(
  [() => data.value, () => route.query],
  async ([loaded, query]) => {
    if (!loaded) return
    const codes = loaded.data.map((s) => s.code)
    const target = await entryTarget(query, codes)
    if (target && route.path === '/practice') void router.replace(target)
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 md:gap-6" data-testid="practice-list-page">
    <div class="flex flex-col gap-1" data-testid="practice-hero">
      <h1 class="text-title text-highlighted" data-testid="practice-title">Latih Tubi 🎯</h1>
      <p class="max-w-prose text-body text-muted">Pilih subjek dan mula berlatih!</p>
    </div>

    <template v-if="data">
      <RouterLink to="/practice/chapter" class="block" data-testid="chapter-banner">
        <DsCharacterCard
          variant="action"
          art="books"
          title="Soalan by Chapter"
          description="Jawab bab demi bab ikut buku teks dan DSKP. Bab seterusnya terkunci sehingga bab semasa lengkap."
        >
          <span class="mt-1 flex items-center gap-2 text-label text-highlighted">
            <UBadge color="primary" variant="solid" size="md">Mode Baru</UBadge>
            Mula <UIcon name="i-ph-arrow-right-bold" class="size-4" aria-hidden="true" />
          </span>
        </DsCharacterCard>
      </RouterLink>

      <ul class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3" data-testid="subject-grid">
        <li v-for="s in subjects" :key="s.code" class="min-w-0">
          <RouterLink
            :to="`/practice/${s.code}`"
            class="block h-full"
            :data-testid="`subject-card-${s.code}`"
          >
            <UCard class="h-full" :ui="{ body: 'flex h-full flex-col gap-3 p-4' }">
              <div class="flex items-start justify-between gap-2">
                <DsIconChip :icon="subjectGlyph(s.icon)" size="lg" data-testid="subject-icon" />
                <UBadge
                  v-if="s.isCore"
                  color="warning"
                  variant="solid"
                  icon="i-ph-crown-bold"
                  data-testid="subject-core"
                  >Teras</UBadge
                >
              </div>
              <div class="flex min-w-0 flex-col gap-1">
                <h2 class="text-subheading break-words text-highlighted" data-testid="subject-name">
                  {{ s.name }}
                </h2>
                <p class="text-caption text-muted">{{ s.nameEn }}</p>
              </div>
              <p class="text-body text-default" data-testid="subject-count">
                <span class="tabular text-highlighted">{{ formatCount(s.approvedCount) }}</span>
                soalan
              </p>
              <UButton
                size="lg"
                block
                class="mt-auto min-h-14"
                icon="i-ph-play-circle-bold"
                data-testid="subject-start"
                >Mula Latihan</UButton
              >
            </UCard>
          </RouterLink>
        </li>
      </ul>
    </template>

    <LoadError
      v-else-if="error"
      :message="LOAD_ERROR"
      retry-testid="practice-retry"
      data-testid="practice-error"
      @retry="reload()"
    />
  </div>
</template>
