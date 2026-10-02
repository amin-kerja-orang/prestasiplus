/**
 * M09 routes: the reader routes (SRS M09 v1.6 §7 #6–#9, #20, #24–#40, #43; M09-T1) and the admin
 * routes (#1–#5, #10–#19, #21–#23, #41–#42; admin content handlers).
 */

import type { RouteDef } from '@/mock/define'

import { adminArticleRoutes } from './admin-articles'
import { adminAudioRoutes } from './admin-audio'
import { adminBannerRoutes } from './admin-banners'
import { adminNoteRoutes } from './admin-notes'
import { adminToolRoutes } from './admin-tools'
import { articleRoutes } from './articles'
import { audioRoutes } from './audio'
import { perutusanRoutes } from './perutusan'
import { supportRoutes } from './support'
import { videoRoutes } from './videos'

export const readerRoutes: RouteDef[] = [
  ...articleRoutes,
  ...supportRoutes,
  ...audioRoutes,
  ...videoRoutes,
  ...perutusanRoutes,
]

export const adminRoutes: RouteDef[] = [
  ...adminArticleRoutes,
  ...adminNoteRoutes,
  ...adminBannerRoutes,
  ...adminAudioRoutes,
  ...adminToolRoutes,
]
