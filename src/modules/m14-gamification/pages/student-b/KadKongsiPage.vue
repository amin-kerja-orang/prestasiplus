<script setup lang="ts">
/**
 * S18 `/gamification/kad-kongsi` "Kad Kongsi" (M14-T2b; FR-M14-52..55, FN-M14-6.2.*). Four tabs
 * (default "Profil", one card set visible at a time): Profil, Kombo, Penguasaan (one card per M05
 * mastery subject) and Kedudukan. "Muat Turun" goes through a `downloading` guard; "WhatsApp" /
 * "Kongsi" open `wa.me` with the card text + "\n\n" + the viewer's profile URL (DV-M14-02, DV-M14-03).
 * The PNG is captured on screen with html2canvas (D25): `lib/student/studentb-capture.ts`.
 */
import { computed, ref } from 'vue'

import { useApi } from '@/composables'
import { DsPage, DsLoadError, DsCluster, DsStack, DsGrid, DsHeading } from '@/ds'

import { fetchShareCards } from '../../api'
import KadCardFrame from '../../components/student-b/KadCardFrame.vue'
import KadKomboCard from '../../components/student-b/KadKomboCard.vue'
import KadMasteryCard from '../../components/student-b/KadMasteryCard.vue'
import KadProfilCard from '../../components/student-b/KadProfilCard.vue'
import KadRankingCard from '../../components/student-b/KadRankingCard.vue'
import {
  KAD_COPY,
  KAD_TABS,
  kadFileName,
  komboText,
  masteryText,
  profilText,
  rankingText,
  type KadTab,
} from '../../lib/student/kadkongsi-lib'
import { downloadCard, openShare, waUrl, withProfileLink } from '../../lib/student/studentb-share'

const { data, error, reload } = useApi((signal) => fetchShareCards({ signal }))

const tab = ref<KadTab>('profil')
const downloading = ref(false)

const TAB_ICONS: Record<string, string> = {
  IdCard: 'i-ph-identification-card-duotone',
  Flame: 'i-ph-fire-duotone',
  Brain: 'i-ph-brain-duotone',
  Trophy: 'i-ph-trophy-duotone',
}
const profileUrl = computed(() => data.value?.profileUrl ?? '')

async function download(el: HTMLElement | null, card: string): Promise<void> {
  if (downloading.value) return
  downloading.value = true
  try {
    await downloadCard(el, kadFileName(card))
  } catch {
    // A failed export is ignored (no message on live).
  } finally {
    downloading.value = false
  }
}

function whatsapp(text: string): void {
  openShare(waUrl(withProfileLink(text, profileUrl.value)))
}
</script>

<template>
  <DsPage data-testid="kad-page">
    <template v-if="data">
      <DsCluster
        gap="xs"
        align="stretch"
        :wrap="false"
        class="overflow-x-auto"
        data-testid="kad-tabs"
      >
        <UButton
          v-for="t in KAD_TABS"
          :key="t.id"
          type="button"
          size="lg"
          class="shrink-0"
          :icon="TAB_ICONS[t.icon]"
          :color="tab === t.id ? 'primary' : 'neutral'"
          :variant="tab === t.id ? 'solid' : 'soft'"
          :data-active="tab === t.id ? 'true' : 'false'"
          :data-testid="`kad-tab-${t.id}`"
          @click="tab = t.id"
        >
          {{ t.label }}
        </UButton>
      </DsCluster>

      <UCard data-testid="kad-panel">
        <KadCardFrame
          v-if="tab === 'profil'"
          :title="KAD_COPY.profilTitle"
          download-color="secondary"
          test-key="profil"
          @download="(el) => download(el, 'profil')"
          @share="whatsapp(profilText(data.profile.accuracy, data.profile.answered))"
        >
          <KadProfilCard :data="data" />
        </KadCardFrame>

        <KadCardFrame
          v-else-if="tab === 'kombo'"
          :title="KAD_COPY.komboTitle"
          download-color="warning"
          test-key="kombo"
          @download="(el) => download(el, 'kombo')"
          @share="whatsapp(komboText(data.kombo.current, data.kombo.best))"
        >
          <KadKomboCard :data="data" />
        </KadCardFrame>

        <DsStack v-else-if="tab === 'penguasaan'" data-testid="kad-penguasaan">
          <DsHeading :level="3">
            {{ KAD_COPY.penguasaanTitle }}
          </DsHeading>
          <DsGrid :cols="{ base: 1, md: 2 }" gap="lg">
            <KadCardFrame
              v-for="(m, i) in data.mastery"
              :key="m.subjectName"
              download-color="success"
              :share-label="KAD_COPY.kongsi"
              compact
              :test-key="`penguasaan-${String(i)}`"
              @download="(el) => download(el, `penguasaan-${String(i)}`)"
              @share="whatsapp(masteryText(m.level, m.stage, m.subjectName, m.accuracy))"
            >
              <KadMasteryCard :item="m" :name="data.name" />
            </KadCardFrame>
          </DsGrid>
        </DsStack>

        <KadCardFrame
          v-else
          :title="KAD_COPY.rankingTitle"
          download-color="primary"
          test-key="kedudukan"
          @download="(el) => download(el, 'kedudukan')"
          @share="whatsapp(rankingText(data.ranking.accuracy))"
        >
          <KadRankingCard :data="data" />
        </KadCardFrame>
      </UCard>
    </template>
    <DsLoadError
      v-else-if="error !== null"
      :message="KAD_COPY.loadError"
      :retry-label="KAD_COPY.retry"
      testid="kad-error"
      retry-testid="kad-retry"
      @retry="reload()"
    />
    <DsStack v-else gap="sm" aria-busy="true" data-testid="kad-loading">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-64 w-full" />
    </DsStack>
  </DsPage>
</template>
