<script setup lang="ts">
/**
 * The subject links of S19 (URS FN-M16-7.2.2; live jutawan-subjects): one raised row per subject with
 * an emoji avatar, the subject name, a "{count} soalan" line and a chevron, one column below `md`,
 * two from `md`. Each links to `/permainan/jutawan/main?subject={id}&darjah={n}`. The server's
 * subject colour is not painted (tokens only); the avatar is neutral.
 */
import type { JutawanPage } from '../../api'
import { questionCountLabel } from '../solo/solo-lib'

defineProps<{ heading: string; subjects: NonNullable<JutawanPage['subjects']>; darjah: number }>()
</script>

<template>
  <section class="flex flex-col gap-3" data-testid="jutawan-subjects">
    <h2 class="text-overline text-muted">📚 PILIH SUBJEK ({{ heading }})</h2>
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
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
          <span class="truncate text-label text-highlighted">{{ s.name }}</span>
          <span class="text-caption text-muted">{{ questionCountLabel(s.count) }}</span>
        </span>
        <UIcon name="i-ph-caret-right-bold" class="size-5 shrink-0 text-primary-t" aria-hidden="true" />
      </UButton>
    </div>
  </section>
</template>
