/** BR-M09-17: video URL parsing (platform, external id, thumbnail, embed URL). */

import type { VideoPlatform } from '../types'

export interface ParsedVideoUrl {
  platform: VideoPlatform
  externalId: string | null
  thumbnailUrl: string | null
  embedUrl: string | null
}

const YOUTUBE = [
  /(?:^|\/\/)(?:www\.|m\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})/,
  /(?:^|\/\/)(?:www\.|m\.)?youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
  /(?:^|\/\/)(?:www\.|m\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  /(?:^|\/\/)youtu\.be\/([A-Za-z0-9_-]{11})/,
]

export function parseVideoUrl(url: string): ParsedVideoUrl {
  const text = url.trim()
  for (const re of YOUTUBE) {
    const id = re.exec(text)?.[1]
    if (id) {
      return {
        platform: 'Youtube',
        externalId: id,
        thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        embedUrl: `https://www.youtube.com/embed/${id}`,
      }
    }
  }
  const vimeo = /vimeo\.com\/(\d+)/.exec(text)?.[1]
  if (vimeo) {
    return {
      platform: 'Vimeo',
      externalId: vimeo,
      thumbnailUrl: null,
      embedUrl: `https://player.vimeo.com/video/${vimeo}`,
    }
  }
  const daily = /(?:dailymotion\.com\/video\/|dai\.ly\/)([A-Za-z0-9]+)/.exec(text)?.[1]
  if (daily) {
    return {
      platform: 'Dailymotion',
      externalId: daily,
      thumbnailUrl: `https://www.dailymotion.com/thumbnail/video/${daily}`,
      embedUrl: `https://www.dailymotion.com/embed/video/${daily}`,
    }
  }
  if (/tiktok\.com/.test(text)) {
    return { platform: 'TikTok', externalId: null, thumbnailUrl: null, embedUrl: null }
  }
  if (/facebook\.com/.test(text) && /video/.test(text)) {
    return { platform: 'Facebook', externalId: null, thumbnailUrl: null, embedUrl: null }
  }
  return { platform: 'Other', externalId: null, thumbnailUrl: null, embedUrl: null }
}
