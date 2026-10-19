/**
 * Materialised M09 tables (SRS M09 v1.2 §6.11). Runtime ids continue after the highest seeded id
 * (`maxPlusOne`): articles from 73, notes from 11, banners from 6, audio sets, perutusan (from 5),
 * reactions, comments, reads, screenshots, attachments and video schools from 1.
 */

import { defineTable, maxPlusOne } from '@/mock/define'

import type {
  ArticleAttachmentRow,
  ArticleRow,
  AudioKbatAttemptRow,
  AudioKbatSetRow,
  BannerRow,
  NoteRow,
  PerutusanCommentRow,
  PerutusanReactionRow,
  PerutusanReadRow,
  PerutusanRow,
  ScreenshotRow,
  SupportConfigRow,
  VideoSchoolRow,
} from '../types'

export const articlesTable = defineTable<ArticleRow>({
  name: 'content.articles',
  ids: maxPlusOne(),
  indexes: ['slug', 'category', 'authorId'],
})
export const articleAttachmentsTable = defineTable<ArticleAttachmentRow>({
  name: 'content.articleAttachments',
  ids: maxPlusOne(),
  indexes: ['articleId'],
})
export const notesTable = defineTable<NoteRow>({ name: 'content.notes', ids: maxPlusOne() })
export const bannersTable = defineTable<BannerRow>({ name: 'content.banners', ids: maxPlusOne() })
export const audioKbatSetsTable = defineTable<AudioKbatSetRow>({
  name: 'content.audioKbatSets',
  ids: maxPlusOne(),
})
export const audioKbatAttemptsTable = defineTable<AudioKbatAttemptRow>({
  name: 'content.audioKbatAttempts',
  ids: maxPlusOne(),
  indexes: ['setId', 'userId'],
})
export const perutusanTable = defineTable<PerutusanRow>({
  name: 'content.perutusan',
  ids: maxPlusOne(),
})
export const perutusanReactionsTable = defineTable<PerutusanReactionRow>({
  name: 'content.perutusanReactions',
  ids: maxPlusOne(),
  indexes: ['perutusanId', 'userId'],
})
export const perutusanCommentsTable = defineTable<PerutusanCommentRow>({
  name: 'content.perutusanComments',
  ids: maxPlusOne(),
  indexes: ['perutusanId'],
})
export const perutusanReadsTable = defineTable<PerutusanReadRow>({
  name: 'content.perutusanReads',
  ids: maxPlusOne(),
  indexes: ['perutusanId', 'userId'],
})
export const screenshotsTable = defineTable<ScreenshotRow>({
  name: 'content.screenshots',
  ids: maxPlusOne(),
})
export const videoSchoolsTable = defineTable<VideoSchoolRow>({
  name: 'content.videoSchools',
  ids: maxPlusOne(),
  indexes: ['userId'],
})
export const supportConfigTable = defineTable<SupportConfigRow>({
  name: 'content.supportConfig',
  ids: maxPlusOne(),
})

/** Every M09 table, for the plugin's `tables`. */
export const M09_TABLES = {
  articles: articlesTable,
  articleAttachments: articleAttachmentsTable,
  notes: notesTable,
  banners: bannersTable,
  audioKbatSets: audioKbatSetsTable,
  audioKbatAttempts: audioKbatAttemptsTable,
  perutusan: perutusanTable,
  perutusanReactions: perutusanReactionsTable,
  perutusanComments: perutusanCommentsTable,
  perutusanReads: perutusanReadsTable,
  screenshots: screenshotsTable,
  videoSchools: videoSchoolsTable,
  supportConfig: supportConfigTable,
} as const
