<script setup lang="ts">
/**
 * S18 `/gamification/kad-kongsi` "Kad Kongsi" (M14-T2b; FR-M14-52..55, FN-M14-6.2.*). Four tabs
 * (default "Profil", one card set visible at a time): Profil, Kombo, Penguasaan (one card per M05
 * mastery subject) and Kedudukan. "Muat Turun" goes through a `downloading` guard; "WhatsApp" /
 * "Kongsi" open `wa.me` with the card text + "\n\n" + the viewer's profile URL (DV-M14-02, DV-M14-03).
 * The PNG is captured on screen with html2canvas (D25): `lib/student/studentb-capture.ts`.
 */
import { Brain, Flame, IdCard, Trophy } from '@lucide/vue'
import { computed, ref, type Component } from 'vue'

import { useApi } from '@/composables'

import { fetchShareCards } from '../../api'
import KadCardFrame from '../../components/student-b/KadCardFrame.vue'
import KadKomboCard from '../../components/student-b/KadKomboCard.vue'
import KadMasteryCard from '../../components/student-b/KadMasteryCard.vue'
import KadProfilCard from '../../components/student-b/KadProfilCard.vue'
import KadRankingCard from '../../components/student-b/KadRankingCard.vue'
import StudentBLoadState from '../../components/student-b/StudentBLoadState.vue'
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

const TAB_ICONS: Record<string, Component> = { IdCard, Flame, Brain, Trophy }
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
  <div class="space-y-5" data-testid="kad-page">
    <template v-if="data">
      <div class="flex flex-wrap gap-2" data-testid="kad-tabs">
        <button
          v-for="t in KAD_TABS"
          :key="t.id"
          type="button"
          :class="[
            'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
            tab === t.id ? [t.active, 'text-white'] : 'border-slate-800 bg-white text-slate-700',
          ]"
          :data-active="tab === t.id ? 'true' : 'false'"
          :data-testid="`kad-tab-${t.id}`"
          @click="tab = t.id"
        >
          <component :is="TAB_ICONS[t.icon]" class="h-4 w-4" aria-hidden="true" />
          {{ t.label }}
        </button>
      </div>

      <section
        class="rounded-2xl border border-slate-800 bg-white p-5 shadow-sm sm:p-6"
        data-testid="kad-panel"
      >
        <KadCardFrame
          v-if="tab === 'profil'"
          :title="KAD_COPY.profilTitle"
          download-class="bg-violet-600"
          test-key="profil"
          @download="(el) => download(el, 'profil')"
          @share="whatsapp(profilText(data.profile.accuracy, data.profile.answered))"
        >
          <KadProfilCard :data="data" />
        </KadCardFrame>

        <KadCardFrame
          v-else-if="tab === 'kombo'"
          :title="KAD_COPY.komboTitle"
          download-class="bg-orange-600"
          test-key="kombo"
          @download="(el) => download(el, 'kombo')"
          @share="whatsapp(komboText(data.kombo.current, data.kombo.best))"
        >
          <KadKomboCard :data="data" />
        </KadCardFrame>

        <div v-else-if="tab === 'penguasaan'" data-testid="kad-penguasaan">
          <h3 class="mb-4 text-base font-bold text-slate-800">{{ KAD_COPY.penguasaanTitle }}</h3>
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <KadCardFrame
              v-for="(m, i) in data.mastery"
              :key="m.subjectName"
              download-class="bg-emerald-600"
              :share-label="KAD_COPY.kongsi"
              compact
              :test-key="`penguasaan-${String(i)}`"
              @download="(el) => download(el, `penguasaan-${String(i)}`)"
              @share="whatsapp(masteryText(m.level, m.stage, m.subjectName, m.accuracy))"
            >
              <KadMasteryCard :item="m" :name="data.name" />
            </KadCardFrame>
          </div>
        </div>

        <KadCardFrame
          v-else
          :title="KAD_COPY.rankingTitle"
          download-class="bg-blue-600"
          test-key="kedudukan"
          @download="(el) => download(el, 'kedudukan')"
          @share="whatsapp(rankingText(data.ranking.accuracy))"
        >
          <KadRankingCard :data="data" />
        </KadCardFrame>
      </section>
    </template>
    <StudentBLoadState
      v-else
      :error="error !== null"
      :message="KAD_COPY.loadError"
      :retry-label="KAD_COPY.retry"
      test-key="kad"
      @retry="reload()"
    />
  </div>
</template>
