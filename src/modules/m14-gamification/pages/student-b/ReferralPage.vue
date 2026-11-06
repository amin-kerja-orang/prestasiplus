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
import { DsCharacterCard, DsLoadError, DsPage, DsStatTile } from '@/ds'
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
        <div class="flex flex-col gap-1">
          <h1 class="text-title text-highlighted">
            {{ REFERRAL_COPY.title }}
          </h1>
          <p class="text-body text-muted">{{ REFERRAL_COPY.subtitle }}</p>
        </div>
      </UCard>

      <div
        class="grid gap-3 sm:gap-4"
        :class="data.rewardReferee > 0 ? 'grid-cols-2' : 'grid-cols-1'"
        data-testid="referral-tiles"
      >
        <UCard>
          <div class="flex flex-col items-center gap-1 text-center">
            <span class="text-title" aria-hidden="true">🎁</span>
            <span class="tabular text-display text-highlighted" data-testid="reward-you">{{
              data.rewardReferrer
            }}</span>
            <span class="text-label text-muted">{{ REFERRAL_COPY.forYou }}</span>
          </div>
        </UCard>
        <UCard v-if="data.rewardReferee > 0" data-testid="reward-friend-tile">
          <div class="flex flex-col items-center gap-1 text-center">
            <span class="text-title" aria-hidden="true">👋</span>
            <span class="tabular text-display text-highlighted" data-testid="reward-friend">{{
              data.rewardReferee
            }}</span>
            <span class="text-label text-muted">{{ REFERRAL_COPY.forFriend }}</span>
          </div>
        </UCard>
      </div>
      <p class="text-body text-muted" data-testid="referral-explain">
        {{ referralRewardSentence(data.rewardReferrer) }}
      </p>

      <DsCharacterCard
        accent="action"
        icon="i-ph-users-three-duotone"
        :title="REFERRAL_COPY.codeLabel"
        data-testid="referral-code-box"
      >
        <div class="flex flex-col gap-4">
          <div class="tabular text-display break-all text-highlighted" data-testid="referral-code">
            {{ data.code }}
          </div>
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

          <section
            class="flex flex-col gap-2"
            aria-labelledby="referral-link-label"
            data-testid="referral-link-region"
          >
            <h2 id="referral-link-label" class="text-label text-muted">
              {{ REFERRAL_COPY.linkLabel }}
            </h2>
            <p class="min-w-0 text-body break-all text-highlighted" data-testid="referral-link">
              {{ data.registerUrl }}
            </p>
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
          </section>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="referral-share">
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
          </div>
        </div>
      </DsCharacterCard>

      <section class="flex flex-col gap-3" data-testid="referral-stats">
        <div class="grid grid-cols-2 gap-3">
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
        </div>
        <p v-if="capReached" class="text-body text-muted" role="status" data-testid="referral-cap">
          {{ REFERRAL_COPY.capReached }}
        </p>
      </section>

      <section class="flex flex-col gap-2" data-testid="referral-joined">
        <h2 class="text-subheading text-highlighted">{{ REFERRAL_COPY.joinedTitle }}</h2>
        <p
          v-if="data.stats.referrals === 0"
          class="text-body text-muted"
          data-testid="referral-joined-empty"
        >
          {{ REFERRAL_COPY.joinedEmpty }}
        </p>
        <!-- [PROPOSED] counts only (FR-MUR-36-4: no friend names); the doc gives no copy for >0. -->
        <p v-else class="text-body text-muted" data-testid="referral-joined-count">
          {{ formatNumber(data.stats.referrals) }} kawan
        </p>
      </section>
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
