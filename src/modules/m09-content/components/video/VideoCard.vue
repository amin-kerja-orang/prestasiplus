<script setup lang="ts">
/**
 * S17 grid card (URS FN-M09-6.1.6; FR-M09-79): a `DsMediaCard` with the thumbnail, the platform
 * chip, the title and one meta line (uploader + role, "{n} tontonan", relative date). The title
 * links to the detail page and the link covers the card.
 */
import { computed } from 'vue'

import { DsMediaCard } from '@/ds'
import { diffForHumans } from '@/lib/time'

import type { VideoCard } from '../../api/types'
import { COPY, videoPath } from '../../lib/video'

const props = defineProps<{ video: VideoCard }>()

const meta = computed(
  () =>
    `${props.video.uploader.name} (${props.video.uploader.roleLabel}) · ${COPY.views(props.video.views)} · ${diffForHumans(props.video.createdAt)}`,
)
</script>

<template>
  <DsMediaCard
    kind="video"
    :title="video.title"
    :thumb="video.thumbnailUrl ?? undefined"
    :category="video.platformLabel"
    :meta="meta"
    :to="videoPath(video.id)"
    data-testid="video-card"
    :data-video-id="video.id"
  />
</template>
