<script setup lang="ts">
/**
 * S16 `/gamification/referral` "Rujuk Kawan, Dapat Syiling!" (M14-T2b; FR-M14-56..59, BR-M14-18/19;
 * FN-M14-7.1.*). Reward tiles (50 / 25), the viewer's code with "Salin Kod" ("✓ Disalin!"),
 * WhatsApp and Telegram links (new tab), "Salin Link" ("✓ Link Disalin!") and the three statistics.
 * A copied label stays until the page is reloaded (as live).
 */
import { ref } from 'vue'

import { useApi } from '@/composables'
import {
  DsCharacterCard,
  DsPage,
  DsStatTile,
  DsLoadError,
  DsStack,
  DsGrid,
  DsHeading,
  DsText,
} from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchReferral } from '../../api'
import BrandTelegramIcon from '../../components/student-b/BrandTelegramIcon.vue'
import BrandWhatsAppIcon from '../../components/student-b/BrandWhatsAppIcon.vue'
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
        <DsStack gap="2xs">
          <DsHeading :level="1">
            {{ REFERRAL_COPY.title }}
          </DsHeading>
          <DsText variant="body" tone="muted">{{ REFERRAL_COPY.subtitle }}</DsText>
        </DsStack>
      </UCard>

      <div class="grid grid-cols-2 gap-3 sm:gap-4" data-testid="referral-tiles">
        <UCard>
          <DsStack gap="2xs" align="center" class="text-center">
            <span class="text-title" aria-hidden="true">🎁</span>
            <DsText variant="display" as="span" tabular data-testid="reward-you">{{
              data.rewardReferrer
            }}</DsText>
            <DsText variant="label" tone="muted">{{ REFERRAL_COPY.forYou }}</DsText>
          </DsStack>
        </UCard>
        <UCard>
          <DsStack gap="2xs" align="center" class="text-center">
            <span class="text-title" aria-hidden="true">👋</span>
            <DsText variant="display" as="span" tabular data-testid="reward-friend">{{
              data.rewardReferee
            }}</DsText>
            <DsText variant="label" tone="muted">{{ REFERRAL_COPY.forFriend }}</DsText>
          </DsStack>
        </UCard>
      </div>

      <DsCharacterCard
        accent="action"
        icon="i-ph-users-three-duotone"
        :title="REFERRAL_COPY.codeLabel"
        data-testid="referral-code-box"
      >
        <DsStack gap="sm">
          <DsText variant="display" as="div" wrap="anywhere" tabular data-testid="referral-code">
            {{ data.code }}
          </DsText>
          <DsGrid :cols="{ base: 1, sm: 2 }" gap="xs">
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
          </DsGrid>
        </DsStack>
      </DsCharacterCard>

      <DsStack as="section" gap="sm" data-testid="referral-stats">
        <DsHeading :level="2" variant="subheading">
          {{ REFERRAL_COPY.statsTitle }}
        </DsHeading>
        <DsGrid :cols="3" gap="sm">
          <div data-testid="stat-referrals">
            <DsStatTile
              icon="users"
              :value="formatNumber(data.stats.referrals)"
              :unit="REFERRAL_COPY.referrals"
            />
          </div>
          <div data-testid="stat-rewarded">
            <DsStatTile
              icon="gift"
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
        </DsGrid>
      </DsStack>
    </template>
    <DsLoadError
      v-else-if="error !== null"
      :message="REFERRAL_COPY.loadError"
      :retry-label="REFERRAL_COPY.retry"
      testid="referral-error"
      retry-testid="referral-retry"
      @retry="reload()"
    />
    <DsStack v-else gap="sm" aria-busy="true" data-testid="referral-loading">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-64 w-full" />
    </DsStack>
  </DsPage>
</template>
