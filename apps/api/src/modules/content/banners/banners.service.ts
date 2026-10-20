import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  AdminBannerCreateRequestSchema,
  AdminBannerUpdateRequestSchema,
  BANNER_AUDIENCES,
  BANNER_LINK_TYPES,
  BANNER_TYPES,
  CONTENT_FLASH,
  CONTENT_MESSAGES,
} from '@pp/contract'
import type { z } from 'zod'

import type { Env } from '../../../common/config/env.schema'
import type { Prisma } from '../../../db/generated/client'
import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import { toMytTimestamp } from '../../../common/time/myt'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { CLOCK, type Clock } from '../../../db/clock'
import { PrismaService } from '../../../db/prisma.service'
import { cmsImageFileId } from '../shared/cms-image'
import {
  type Actor,
  allowedOrigins,
  auditBase,
  dateFromKey,
  dateKeyOf,
  fileUrlOf,
  idOrNotFound,
  mytDateKey,
  normaliseCodes,
  notFound,
  unpagedMeta,
  writeTx,
} from '../shared/content-support'
import { BannersRepository, type BannerRow, type BannerWrite } from './banners.repository'

export const BANNER_AUDIT = { CREATED: 'content.banner.created', UPDATED: 'content.banner.updated', DELETED: 'content.banner.deleted' } as const

const CODE_KEYS = ['bannerType', 'linkType', 'targetAudience'] as const
const NOT_FOUND = CONTENT_MESSAGES.bannerNotFound
const AUDIENCE_OF_ROLE: Readonly<Record<string, string>> = { student: 'STUDENT', teacher: 'TEACHER' }

type CreateBody = z.infer<typeof AdminBannerCreateRequestSchema>
type UpdateBody = z.infer<typeof AdminBannerUpdateRequestSchema>

const invalid = (field: string, message: string = CONTENT_MESSAGES.fieldInvalid): ApiError =>
  ApiError.of('VALIDATION_ERROR', { fields: { [field]: message } })

function bannerOf(b: BannerRow) {
  return {
    id: b.id.toString(),
    title: b.title,
    description: b.description,
    imageUrl: b.imageFile ? fileUrlOf(b.imageFile.publicId) : null,
    bannerType: b.bannerType,
    linkType: b.linkType,
    externalUrl: b.externalUrl,
    targetAudience: b.targetAudience,
    displayOrder: b.displayOrder,
    startDate: b.startDate ? dateKeyOf(b.startDate) : null,
    endDate: b.endDate ? dateKeyOf(b.endDate) : null,
    isActive: b.isActive,
    createdAt: toMytTimestamp(b.createdAt),
    updatedAt: toMytTimestamp(b.updatedAt),
  }
}

@Injectable()
export class BannersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BannersRepository) private readonly repo: BannersRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  /** `GET /banners/active`: the caller's role decides the audience; admin sees every audience, other roles `ALL` only. */
  async active(role: string) {
    const own = AUDIENCE_OF_ROLE[role]
    const audiences = role === 'admin' ? null : own ? ['ALL', own] : ['ALL']
    const rows = await this.repo.active(dateFromKey(mytDateKey(this.clock.now())), audiences)
    const data = rows.map((b) => ({ type: b.bannerType, title: b.title, description: b.description }))
    return { data, meta: unpagedMeta(data.length) }
  }

  async list() {
    const data = (await this.repo.all()).map(bannerOf)
    return { data, meta: unpagedMeta(data.length) }
  }

  async get(rawId: string) {
    const row = await this.repo.get(idOrNotFound(rawId, NOT_FOUND))
    if (!row) throw notFound(NOT_FOUND)
    return bannerOf(row)
  }

  private origins(who: Actor): string[] {
    return allowedOrigins(who.origin, this.config.get('PUBLIC_ORIGINS', { infer: true }))
  }

  async create(who: Actor, rawBody: unknown) {
    const body: CreateBody = new ZodValidationPipe(AdminBannerCreateRequestSchema).transform(normaliseCodes(rawBody ?? {}, CODE_KEYS))
    const linkType = body.linkType ?? 'NONE'
    const data: BannerWrite = {
      title: body.title,
      description: body.description || null,
      imageFileId: body.imageUrl ? await cmsImageFileId(this.prisma, body.imageUrl, this.origins(who), 'imageUrl', CONTENT_MESSAGES.fieldInvalid) : null,
      bannerType: body.bannerType,
      linkType,
      externalUrl: linkType === 'EXTERNAL' ? (body.externalUrl ?? null) : null,
      targetAudience: body.targetAudience ?? 'ALL',
      displayOrder: body.displayOrder ?? 0,
      startDate: body.startDate ? dateFromKey(body.startDate) : null,
      endDate: body.endDate ? dateFromKey(body.endDate) : null,
      isActive: body.isActive ?? true,
    }
    const detail = await writeTx(this.prisma, async (tx) => {
      const created = await this.repo.create(data)
      await this.audit.record({ tx, ...auditBase(who, BANNER_AUDIT.CREATED), targetType: 'banner', targetId: created, details: { bannerType: data.bannerType, isActive: data.isActive } })
      return this.get(created)
    })
    return { data: detail, status: CONTENT_FLASH.banner.created }
  }

  /** Absent fields keep their value; a code may also be the banner's own stored code. */
  async update(who: Actor, rawId: string, rawBody: unknown) {
    const id = idOrNotFound(rawId, NOT_FOUND)
    const current = await this.repo.get(id)
    if (!current) throw notFound(NOT_FOUND)
    const body: UpdateBody = new ZodValidationPipe(AdminBannerUpdateRequestSchema).transform(normaliseCodes(rawBody ?? {}, CODE_KEYS))

    const code = (key: (typeof CODE_KEYS)[number], allowed: readonly string[]): string => {
      const stored = current[key]
      const v = body[key]
      if (v === undefined) return stored
      if (!allowed.includes(v) && v !== stored) throw invalid(key)
      return v
    }
    const bannerType = code('bannerType', BANNER_TYPES)
    const linkType = code('linkType', BANNER_LINK_TYPES)
    const targetAudience = code('targetAudience', BANNER_AUDIENCES)

    let externalUrl: string | null = null
    if (linkType === 'EXTERNAL') {
      externalUrl = 'externalUrl' in body ? (body.externalUrl ?? null) : current.externalUrl
      if (!externalUrl) throw invalid('externalUrl', CONTENT_MESSAGES.fieldRequired)
    }
    const startDate = 'startDate' in body ? (body.startDate ? dateFromKey(body.startDate) : null) : current.startDate
    const endDate = 'endDate' in body ? (body.endDate ? dateFromKey(body.endDate) : null) : current.endDate
    if (startDate && endDate && endDate < startDate) throw invalid('endDate')

    // Only the sent fields are written, so a concurrent change to another field is not overwritten.
    const patch: Prisma.BannerUncheckedUpdateManyInput = {}
    if (body.title !== undefined) patch.title = body.title
    if ('description' in body) patch.description = body.description || null
    if ('imageUrl' in body) patch.imageFileId = body.imageUrl ? await cmsImageFileId(this.prisma, body.imageUrl, this.origins(who), 'imageUrl', CONTENT_MESSAGES.fieldInvalid) : null
    if (body.bannerType !== undefined) patch.bannerType = bannerType
    if (body.linkType !== undefined || 'externalUrl' in body) {
      patch.linkType = linkType
      patch.externalUrl = externalUrl
    }
    if (body.targetAudience !== undefined) patch.targetAudience = targetAudience
    if ('displayOrder' in body) patch.displayOrder = body.displayOrder ?? 0
    if ('startDate' in body) patch.startDate = startDate
    if ('endDate' in body) patch.endDate = endDate
    if (body.isActive !== undefined) patch.isActive = body.isActive
    const detail = await writeTx(this.prisma, async (tx) => {
      if (!(await this.repo.update(id, patch))) throw notFound(NOT_FOUND)
      await this.audit.record({ tx, ...auditBase(who, BANNER_AUDIT.UPDATED), targetType: 'banner', targetId: id, details: { fields: Object.keys(patch) } })
      return this.get(id)
    })
    return { data: detail, status: CONTENT_FLASH.banner.updated }
  }

  async remove(who: Actor, rawId: string) {
    const id = idOrNotFound(rawId, NOT_FOUND)
    await writeTx(this.prisma, async (tx) => {
      if (!(await this.repo.remove(id))) throw notFound(NOT_FOUND)
      await this.audit.record({ tx, ...auditBase(who, BANNER_AUDIT.DELETED), targetType: 'banner', targetId: id })
    })
    return { data: { deleted: 1 as const }, status: CONTENT_FLASH.banner.deleted }
  }
}
