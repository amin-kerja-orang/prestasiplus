<script setup lang="ts">
/**
 * S16 `/gamification/referral` "Rujuk Kawan, Dapat Syiling!" (M14-T2b; FR-M14-56..59, BR-M14-18/19;
 * FN-M14-7.1.*). Reward tiles (50 / 25), the viewer's code with "Salin Kod" ("✓ Disalin!"),
 * WhatsApp and Telegram links (new tab), "Salin Link" ("✓ Link Disalin!") and the three statistics.
 * A copied label stays until the page is reloaded (as live).
 */
import { ref } from 'vue'

import { useApi } from '@/composables'
import { DsCharacterCard, DsPage, DsStatTile } from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchReferral } from '../../api'
import BrandTelegramIcon from '../../components/student-b/BrandTelegramIcon.vue'
import BrandWhatsAppIcon from '../../components/student-b/BrandWhatsAppIcon.vue'
import StudentBLoadState from '../../components/student-b/StudentBLoadState.vue'
import { REFERRAL_COPY } from '../../lib/student/referral-lib'
import { copyText } from '../../lib/student/studentb-share'

const { data, error, reload } = useApi((signal) => fetchReferral({ signal }))

const codeCopied = ref(false)
const linkCopied = ref(false)

async function copyCode(): Promise<void> {
  if (!data.value) return
  await copyText(data.value.code)
  codeCopied.value = true
}

async function copyLink(): Promise<void> {
  if (!data.value) return
  await copyText(data.value.registerUrl)
  linkCopied.value = true
}
</script>

<template>
  <DsPage data-testid="referral-page">
    <template v-if="data">
      <UCard data-testid="referral-hero">
        <div class="flex flex-col gap-1">
          <h1 class="text-title text-highlighted">
            {{ REFERRAL_COPY.title }}
          </h1>
          <p class="text-body text-muted">{{ REFERRAL_COPY.subtitle }}</p>
        </div>
      </UCard>

      <div class="grid grid-cols-2 gap-3 sm:gap-4" data-testid="referral-tiles">
        <UCard>
          <div class="flex flex-col items-center gap-1 text-center">
            <span class="text-title" aria-hidden="true">🎁</span>
            <span
              class="tabular text-display text-highlighted"
              data-testid="reward-you"
              >{{ data.rewardReferrer }}</span
            >
            <span class="text-label text-muted">{{ REFERRAL_COPY.forYou }}</span>
          </div>
        </UCard>
        <UCard>
          <div class="flex flex-col items-center gap-1 text-center">
            <span class="text-title" aria-hidden="true">👋</span>
            <span
              class="tabular text-display text-highlighted"
              data-testid="reward-friend"
              >{{ data.rewardReferee }}</span
            >
            <span class="text-label text-muted">{{ REFERRAL_COPY.forFriend }}</span>
          </div>
        </UCard>
      </div>

      <DsCharacterCard
        variant="action"
        icon="i-ph-users-three-duotone"
        :title="REFERRAL_COPY.codeLabel"
        data-testid="referral-code-box"
      >
        <div class="flex flex-col gap-3">
          <div
            class="tabular text-display break-words text-highlighted"
            data-testid="referral-code"
          >
            {{ data.code }}
          </div>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <UButton
              type="button"
              size="xl"
              color="neutral"
              variant="soft"
              icon="i-ph-copy-duotone"
              block
              data-testid="referral-copy-code"
              @click="copyCode"
            >
              {{ codeCopied ? REFERRAL_COPY.copiedCode : REFERRAL_COPY.copyCode }}
            </UButton>
            <UButton
              type="button"
              size="xl"
              color="neutral"
              variant="soft"
              icon="i-ph-link-duotone"
              block
              data-testid="referral-copy-link"
              @click="copyLink"
            >
              {{ linkCopied ? REFERRAL_COPY.copiedLink : REFERRAL_COPY.copyLink }}
            </UButton>
            <UButton
              :href="data.whatsappUrl"
              target="_blank"
              rel="noopener noreferrer"
              size="xl"
              color="success"
              block
              data-testid="referral-whatsapp"
            >
              <BrandWhatsAppIcon class="size-4" />
              {{ REFERRAL_COPY.whatsapp }}
            </UButton>
            <UButton
              :href="data.telegramUrl"
              target="_blank"
              rel="noopener noreferrer"
              size="xl"
              color="info"
              block
              data-testid="referral-telegram"
            >
              <BrandTelegramIcon class="size-4" />
              {{ REFERRAL_COPY.telegram }}
            </UButton>
          </div>
        </div>
      </DsCharacterCard>

      <section class="flex flex-col gap-3" data-testid="referral-stats">
        <h2 class="text-subheading text-highlighted">
          {{ REFERRAL_COPY.statsTitle }}
        </h2>
        <div class="grid grid-cols-3 gap-3">
          <div data-testid="stat-referrals">
            <DsStatTile
              icon="i-ph-users-duotone"
              :value="formatNumber(data.stats.referrals)"
              :unit="REFERRAL_COPY.referrals"
            />
          </div>
          <div data-testid="stat-rewarded">
            <DsStatTile
              icon="i-ph-gift-duotone"
              accent="win"
              :value="formatNumber(data.stats.rewarded)"
              :unit="REFERRAL_COPY.rewarded"
            />
          </div>
          <div data-testid="stat-earned">
            <DsStatTile
              art="coin"
              :value="formatNumber(data.stats.syilingEarned)"
              :unit="REFERRAL_COPY.earned"
            />
          </div>
        </div>
      </section>
    </template>
    <StudentBLoadState
      v-else
      :error="error !== null"
      :message="REFERRAL_COPY.loadError"
      :retry-label="REFERRAL_COPY.retry"
      test-key="referral"
      @retry="reload()"
    />
  </DsPage>
</template>
