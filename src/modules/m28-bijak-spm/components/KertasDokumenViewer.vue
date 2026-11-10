<script setup lang="ts">
/**
 * Kertas Subjektif page-image viewer (V2 `kertas.show`): the question paper one image per page, then the marking scheme revealed on demand.
 * The pupil reads the paper on screen, answers on paper as in the real exam, and only then opens the scheme to check. Shared by the pupil
 * page and the admin preview. Every page image is full width of the column (no horizontal page scroll at 375 / 768 / 1280) and lazy loaded,
 * so a 30-page paper stays cheap to open.
 */
import { computed, nextTick, ref } from 'vue'

import { DsCluster, DsEmptyState, DsHeading, DsStack, DsText } from '@/ds'

import type { KertasDokumen } from '../server/documents-types'

const props = defineProps<{ doc: KertasDokumen }>()

const showScheme = ref(false)
const schemeAnchor = ref<HTMLElement | null>(null)
const hasScheme = computed(() => props.doc.schemePages.length > 0)

async function reveal(): Promise<void> {
  showScheme.value = true
  await nextTick()
  schemeAnchor.value?.scrollIntoView?.({ behavior: 'smooth' })
}
</script>

<template>
  <DsStack gap="lg" data-testid="dokumen-viewer">
    <DsCluster v-if="doc.marks || doc.durationMinutes" gap="md" data-testid="dokumen-meta">
      <DsText v-if="doc.marks" variant="caption" tone="muted" tabular data-testid="dokumen-marks">{{ doc.marks }} markah</DsText>
      <DsText v-if="doc.durationMinutes" variant="caption" tone="muted" tabular data-testid="dokumen-minutes">{{ doc.durationMinutes }} min</DsText>
    </DsCluster>

    <DsStack gap="sm" data-testid="dokumen-pages">
      <img
        v-for="p in doc.paperPages"
        :key="p.position"
        :src="p.url"
        :alt="`Muka surat ${p.position}`"
        loading="lazy"
        class="w-full rounded-lg bg-default shadow-sm"
        :data-testid="`dokumen-page-${p.position}`"
      />
      <DsEmptyState v-if="!doc.paperPages.length" title="Imej kertas belum tersedia." icon="i-ph-file-x" data-testid="dokumen-no-pages" />
    </DsStack>

    <template v-if="hasScheme">
      <UButton
        v-if="!showScheme"
        color="primary"
        variant="soft"
        size="lg"
        icon="i-ph-eye"
        block
        data-testid="dokumen-scheme-show"
        @click="reveal"
      >
        Tunjuk Skema Pemarkahan
        <span class="font-normal text-muted">(cuba jawab dahulu)</span>
      </UButton>
      <DsStack v-else gap="sm" data-testid="dokumen-scheme">
        <div ref="schemeAnchor" />
        <DsCluster justify="between">
          <DsHeading :level="2" variant="label">Skema Pemarkahan</DsHeading>
          <UButton color="neutral" variant="ghost" size="sm" icon="i-ph-eye-slash" data-testid="dokumen-scheme-hide" @click="showScheme = false">
            Sembunyi
          </UButton>
        </DsCluster>
        <img
          v-for="p in doc.schemePages"
          :key="p.position"
          :src="p.url"
          :alt="`Skema muka surat ${p.position}`"
          loading="lazy"
          class="w-full rounded-lg bg-default shadow-sm"
          :data-testid="`dokumen-scheme-page-${p.position}`"
        />
      </DsStack>
    </template>
    <DsText v-else variant="caption" tone="muted" align="center" data-testid="dokumen-no-scheme">
      Skema pemarkahan tidak tersedia untuk kertas ini.
    </DsText>
  </DsStack>
</template>
