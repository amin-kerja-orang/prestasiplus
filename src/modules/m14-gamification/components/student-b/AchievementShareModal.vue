<script setup lang="ts">
/**
 * S15 share modal `#shareModal` (FR-M14-48..50, FN-M14-6.1.5–6.1.8): the card `#shareCardCanvas` on
 * the rarity gradient (icon, name, description, rarity label, the user's name, "🎓 PRESTASIPLUS",
 * "{syiling} 🪙 Syiling", "{xp} ⭐ XP"), "Muat Turun", "WhatsApp" and "Tutup". A click on the
 * backdrop closes it. Full width on mobile, centred from 768 px.
 */
import { ref } from 'vue'

import type { AchievementItem } from '../../api'
import {
  ACHIEVEMENTS_COPY,
  achievementFileName,
  achievementShareText,
  rarityGradient,
} from '../../lib/student/achievements-lib'
import { downloadCard, openShare, waUrl } from '../../lib/student/studentb-share'
import BrandWhatsAppIcon from './BrandWhatsAppIcon.vue'

const props = defineProps<{ item: AchievementItem; userName: string; profileUrl: string }>()
const emit = defineEmits<{ close: [] }>()

const card = ref<HTMLElement | null>(null)

function download(): void {
  downloadCard(card.value, achievementFileName(props.item.name)).catch(() => {
    // A failed capture is ignored (live shows no message).
  })
}

function whatsapp(): void {
  openShare(waUrl(achievementShareText(props.item.name, props.profileUrl)))
}
</script>

<template>
  <div
    id="shareModal"
    class="fixed inset-0 z-50 flex overflow-y-auto bg-black/60 p-4"
    data-testid="share-modal"
    @click.self="emit('close')"
  >
    <div
      class="m-auto w-full max-w-sm rounded-sheet bg-default p-6 shadow-lift"
      data-testid="share-dialog"
    >
      <div
        id="shareCardCanvas"
        ref="card"
        :class="['rounded-2xl p-6 text-center text-white', rarityGradient(item.rarity)]"
        data-testid="share-card"
      >
        <div class="text-6xl" data-testid="share-icon">{{ item.icon }}</div>
        <div class="mt-3 text-xl font-bold wrap-anywhere" data-testid="share-name">
          {{ item.name }}
        </div>
        <div class="mt-1 text-sm wrap-anywhere text-white/90" data-testid="share-desc">
          {{ item.description }}
        </div>
        <span
          class="mt-3 inline-block rounded-full bg-white/25 px-3 py-1 text-xs font-bold uppercase"
          data-testid="share-rarity"
          >{{ item.rarityLabel }}</span
        >
        <div class="mt-4 border-t border-white/30 pt-4">
          <div class="text-base font-bold wrap-anywhere" data-testid="share-user">
            {{ userName }}
          </div>
          <div class="mt-0.5 text-xs text-white/80">{{ ACHIEVEMENTS_COPY.prestasiplus }}</div>
          <div class="mt-3 flex justify-center gap-6">
            <div data-testid="share-syiling">
              <div class="text-xl font-bold">{{ item.rewardSyiling }}</div>
              <div class="text-xs text-white/80">🪙 Syiling</div>
            </div>
            <div data-testid="share-xp">
              <div class="text-xl font-bold">{{ item.rewardXp }}</div>
              <div class="text-xs text-white/80">⭐ XP</div>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <UButton
          type="button"
          size="xl"
          icon="i-ph-download-simple-duotone"
          block
          data-testid="share-download"
          @click="download"
        >
          {{ ACHIEVEMENTS_COPY.download }}
        </UButton>
        <UButton
          type="button"
          size="xl"
          color="success"
          block
          data-testid="share-whatsapp"
          @click="whatsapp"
        >
          <BrandWhatsAppIcon class="size-4" />
          {{ ACHIEVEMENTS_COPY.whatsapp }}
        </UButton>
      </div>
      <UButton
        type="button"
        size="xl"
        color="neutral"
        variant="soft"
        block
        class="mt-3"
        data-testid="share-close"
        @click="emit('close')"
      >
        {{ ACHIEVEMENTS_COPY.close }}
      </UButton>
    </div>
  </div>
</template>
