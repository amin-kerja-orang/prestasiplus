<script setup lang="ts">
/**
 * S16 `/gamification/referral` "Rujuk Kawan, Dapat Syiling!" (M14-T2b; S7-T07 P6; FR-MUR-36-1..5,
 * FR-GM-24.3). Reward tiles (the friend tile only when rewardReferee > 0), the viewer's code, the
 * "Pautan jemputan" region ("Salin" / "Disalin"), WhatsApp and Telegram links (new tab, server
 * share text), the two counters, the cap line and the "Kawan yang telah sertai" block (counts only,
 * no names). A copied label stays until the page is reloaded (as live).
 */
import { computed, ref } from 'vue'

import { useApi } from '@/composables'
import {
  DsCharacterCard,
  DsGrid,
  DsHeading,
  DsLoadError,
  DsPage,
  DsStack,
  DsStatTile,
  DsText,
} from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchReferral } from '../../api'
import BrandTelegramIcon from '../../components/student-b/BrandTelegramIcon.vue'
import BrandWhatsAppIcon from '../../components/student-b/BrandWhatsAppIcon.vue'
import { REFERRAL_COPY, referralRewardSentence } from '../../lib/student/referral-lib'
import { copyText } from '../../lib/student/studentb-share'

const { data, error, reload } = useApi((signal) => fetchReferral({ signal }))

const capReached = computed(
  () => data.value !== null && data.value.stats.rewarded >= data.value.maxRewarded,
)

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
    <h1 v-if="!data" class="sr-only">Rujuk Kawan, Dapat Syiling!</h1>
    <template v-if="data">
      <UCard data-testid="referral-hero">
        <DsStack gap="2xs">
          <DsHeading :level="1" variant="title">{{ REFERRAL_COPY.title }}</DsHeading>
          <DsText variant="body" tone="muted">{{ REFERRAL_COPY.subtitle }}</DsText>
        </DsStack>
      </UCard>

      <DsGrid
        gap="sm"
        :cols="{ base: data.rewardReferee > 0 ? 2 : 1 }"
        data-testid="referral-tiles"
      >
        <UCard>
          <DsStack gap="2xs" align="center">
            <DsText variant="title" as="span" aria-hidden="true">🎁</DsText>
            <DsText variant="kpi-lg" data-testid="reward-you">{{ data.rewardReferrer }}</DsText>
            <DsText variant="label" tone="muted">{{ REFERRAL_COPY.forYou }}</DsText>
          </DsStack>
        </UCard>
        <UCard v-if="data.rewardReferee > 0" data-testid="reward-friend-tile">
          <DsStack gap="2xs" align="center">
            <DsText variant="title" as="span" aria-hidden="true">👋</DsText>
            <DsText variant="kpi-lg" data-testid="reward-friend">{{ data.rewardReferee }}</DsText>
            <DsText variant="label" tone="muted">{{ REFERRAL_COPY.forFriend }}</DsText>
          </DsStack>
        </UCard>
      </DsGrid>
      <DsText variant="body" tone="muted" data-testid="referral-explain">
        {{ referralRewardSentence(data.rewardReferrer) }}
      </DsText>

      <DsCharacterCard
        accent="action"
        icon="i-ph-users-three-duotone"
        :title="REFERRAL_COPY.codeLabel"
        data-testid="referral-code-box"
      >
        <DsStack gap="md">
          <DsText variant="kpi-lg" as="div" class="break-all" data-testid="referral-code">
            {{ data.code }}
          </DsText>
          <UButton
            type="button"
            size="lg"
            color="neutral"
            variant="soft"
            icon="i-ph-copy-duotone"
            block
            class="min-h-11"
            data-testid="referral-copy-code"
            @click="copyCode"
          >
            {{ codeCopied ? REFERRAL_COPY.copiedCode : REFERRAL_COPY.copyCode }}
          </UButton>

          <DsStack
            as="section"
            gap="xs"
            aria-labelledby="referral-link-label"
            data-testid="referral-link-region"
          >
            <DsHeading id="referral-link-label" :level="2" variant="label" tone="muted">
              {{ REFERRAL_COPY.linkLabel }}
            </DsHeading>
            <DsText
              variant="body"
              tone="highlighted"
              class="min-w-0 break-all"
              data-testid="referral-link"
            >
              {{ data.registerUrl }}
            </DsText>
            <UButton
              type="button"
              size="lg"
              color="neutral"
              variant="soft"
              icon="i-ph-link-duotone"
              block
              class="min-h-11"
              data-testid="referral-copy-link"
              @click="copyLink"
            >
              {{ linkCopied ? REFERRAL_COPY.copiedLink : REFERRAL_COPY.copyLink }}
            </UButton>
          </DsStack>

          <DsGrid gap="xs" :cols="{ base: 1, sm: 2 }" data-testid="referral-share">
            <UButton
              :href="data.whatsappUrl"
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
              color="success"
              block
              class="min-h-11"
              data-testid="referral-whatsapp"
            >
              <BrandWhatsAppIcon class="size-4" />
              {{ REFERRAL_COPY.whatsapp }}
            </UButton>
            <UButton
              :href="data.telegramUrl"
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
              color="info"
              block
              class="min-h-11"
              data-testid="referral-telegram"
            >
              <BrandTelegramIcon class="size-4" />
              {{ REFERRAL_COPY.telegram }}
            </UButton>
          </DsGrid>
        </DsStack>
      </DsCharacterCard>

      <DsStack as="section" gap="sm" data-testid="referral-stats">
        <DsGrid gap="sm" :cols="{ base: 2 }">
          <div>
            <DsStatTile
              icon="users"
              :value="formatNumber(data.stats.referrals)"
              :unit="REFERRAL_COPY.referrals"
              value-testid="stat-referrals"
            />
          </div>
          <div>
            <DsStatTile
              art="coin"
              :value="formatNumber(data.stats.syilingEarned)"
              :unit="REFERRAL_COPY.earned"
              value-testid="stat-earned"
            />
          </div>
        </DsGrid>
        <p v-if="capReached" class="text-body text-muted" role="status" data-testid="referral-cap">
          {{ REFERRAL_COPY.capReached }}
        </p>
      </DsStack>

      <DsStack as="section" gap="xs" data-testid="referral-joined">
        <DsHeading :level="2" variant="subheading">{{ REFERRAL_COPY.joinedTitle }}</DsHeading>
        <DsText
          v-if="data.stats.referrals === 0"
          variant="body"
          tone="muted"
          data-testid="referral-joined-empty"
        >
          {{ REFERRAL_COPY.joinedEmpty }}
        </DsText>
        <!-- [PROPOSED] counts only (FR-MUR-36-4: no friend names); the doc gives no copy for >0. -->
        <DsText v-else variant="body" tone="muted" data-testid="referral-joined-count">
          {{ formatNumber(data.stats.referrals) }} kawan
        </DsText>
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
    <div v-else class="flex flex-col gap-3" aria-busy="true" data-testid="referral-loading">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
