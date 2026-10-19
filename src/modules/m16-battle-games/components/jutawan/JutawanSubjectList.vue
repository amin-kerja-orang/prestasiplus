<script setup lang="ts">
/**
 * The subject links of S19 (URS FN-M16-7.2.2; live jutawan-subjects): one raised row per subject with
 * an emoji avatar, the subject name, a "{count} soalan" line and a chevron, one column below `md`,
 * two from `md`. Each links to `/permainan/jutawan/main?subject={id}&darjah={n}`. The server's
 * subject colour is not painted (tokens only); the avatar is neutral.
 */
import type { JutawanPage } from '../../api'
import { questionCountLabel } from '../solo/solo-lib'
import { DsGrid, DsStack, DsHeading, DsText } from '@/ds'

defineProps<{ heading: string; subjects: NonNullable<JutawanPage['subjects']>; darjah: number }>()
</script>

<template>
  <DsStack as="section" gap="sm" data-testid="jutawan-subjects">
    <DsHeading :level="2" variant="overline" tone="muted"
      >📚 PILIH SUBJEK ({{ heading }})</DsHeading
    >
    <DsGrid :cols="{ base: 1, md: 2 }" gap="sm">
      <UButton
        v-for="s in subjects"
        :key="s.id"
        :to="{
          path: '/permainan/jutawan/main',
          query: { subject: String(s.id), darjah: String(darjah) },
        }"
        color="neutral"
        variant="soft"
        class="h-auto min-h-20 min-w-0 justify-start gap-3 p-3 text-start"
        data-testid="jutawan-subject"
      >
        <UAvatar :text="s.emoji" size="xl" />
        <span class="flex min-w-0 flex-1 flex-col gap-1">
          <DsText variant="label" tone="highlighted" truncate>{{ s.name }}</DsText>
          <DsText variant="caption" as="span">{{ questionCountLabel(s.count) }}</DsText>
        </span>
        <UIcon
          name="i-ph-caret-right-bold"
          class="size-5 shrink-0 text-primary-t"
          aria-hidden="true"
        />
      </UButton>
    </DsGrid>
  </DsStack>
</template>
