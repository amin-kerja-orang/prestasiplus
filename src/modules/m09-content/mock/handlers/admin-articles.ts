/**
 * SRS M09 v1.6 §7 #1 `GET /api/admin/articles` (S1), #2 `GET /api/admin/articles/:id` (S3, S4),
 * #3 `POST /api/admin/articles` (S2), #4 `PUT /api/admin/articles/:id` (S3) and #5
 * `DELETE /api/admin/articles/:id`. All admin only (guest 401, other roles 403).
 *
 * A mutation writes the M09 `articles` store, so the reader endpoints (#6–#9, M05 latest) reflect it
 * at once: only published articles are readable (BR-M09-02), `publishedAt` is set on first publish,
 * the slug is `Str::slug(title)` made unique (BR-M09-08) and never changes on edit.
 */

import {
  created,
  int,
  notFound,
  ok,
  paged,
  pageParams,
  queryString,
  route,
  validationError,
  type RouteDef,
} from '@/mock/define'

import { CATEGORY_LABELS, GRADE_LABELS } from '../data/labels'
import { articlesRepo, M09Error } from '../repository'
import { ADMIN_PAGE_SIZE } from '../repository/articles'
import { authorRef } from '../repository/common'
import {
  ARTICLE_CATEGORIES,
  GRADE_LEVELS,
  type ArticleCategory,
  type ArticleRow,
  type GradeLevel,
} from '../types'
import {
  ADMIN_FLASH,
  adminOnly,
  asBool,
  bodyOf,
  clean,
  has,
  isUrl,
  MAX_LEN,
  NOT_FOUND,
} from './admin-common'
import { FIELD_INVALID, FIELD_REQUIRED, refusal, requireViewer } from './common'

type ArticleInput = Parameters<typeof articlesRepo.create>[1]

/** `AdminArticleDetail` (§6.1, §7 note): every stored field plus the labels and the attachments. */
function detailBody(id: number) {
  const row = articlesRepo.adminGet(id)
  if (!row) return undefined
  const { attachments, ...rest } = row
  return {
    ...rest,
    categoryLabel: CATEGORY_LABELS[row.category],
    gradeLabel: GRADE_LABELS[row.gradeLevel],
    author: { id: row.authorId, name: authorRef(row.authorId).name },
    attachments: attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      label: a.label,
      size: a.size,
    })),
  }
}

/**
 * Validates the S2/S3 body (§5). For a PUT, a field absent from the request keeps its stored
 * value (INFERRED: the contract says absent fields are left unchanged); a blank text field that
 * is sent clears it.
 */
function parse(
  raw: unknown,
  current?: ArticleRow,
): { fields: Record<string, string> } | { input: ArticleInput } {
  const body = bodyOf(raw)
  const fields: Record<string, string> = {}

  const text = (key: string, max: number, required: boolean): string | null => {
    if (current && !has(body, key))
      return (current[key as keyof ArticleRow] as string | null) ?? null
    const v = clean(body[key])
    if (v === null || v === undefined) {
      if (required) fields[key] = FIELD_REQUIRED
      return null
    }
    if (typeof v !== 'string' || v.length > max) {
      fields[key] = FIELD_INVALID
      return null
    }
    return v
  }

  const title = text('title', 255, true)
  const excerpt = text('excerpt', 500, false)
  const content = text('content', MAX_LEN.content, true)
  const featuredImage = text('featuredImage', 2048, false)
  if (featuredImage !== null && !isUrl(featuredImage)) fields.featuredImage = FIELD_INVALID

  let category: ArticleCategory | undefined = current?.category
  if (!current || has(body, 'category')) {
    const v = clean(body.category)
    if (v === null || v === undefined) fields.category = FIELD_REQUIRED
    else if (typeof v !== 'string' || !ARTICLE_CATEGORIES.includes(v as ArticleCategory)) {
      fields.category = FIELD_INVALID
    } else category = v as ArticleCategory
  }

  let gradeLevel: GradeLevel = current?.gradeLevel ?? 'SEMUA'
  if (has(body, 'gradeLevel')) {
    const v = clean(body.gradeLevel)
    if (v === null || v === undefined) gradeLevel = 'SEMUA'
    else if (typeof v !== 'string' || !GRADE_LEVELS.includes(v as GradeLevel)) {
      fields.gradeLevel = FIELD_INVALID
    } else gradeLevel = v as GradeLevel
  }

  const flag = (key: 'isPublished' | 'isFeatured'): boolean => {
    if (!has(body, key)) return current ? current[key] : false
    const b = asBool(body[key])
    if (b === undefined) {
      fields[key] = FIELD_INVALID
      return false
    }
    return b
  }
  const isPublished = flag('isPublished')
  const isFeatured = flag('isFeatured')

  if (Object.keys(fields).length > 0) return { fields }
  return {
    input: {
      title: title as string,
      excerpt,
      content: content as string,
      featuredImage,
      category: category as ArticleCategory,
      gradeLevel,
      isPublished,
      isFeatured,
    },
  }
}

export const adminArticleRoutes: RouteDef[] = [
  route('GET', '/api/admin/articles', [adminOnly], (req) => {
    const page = pageParams(req.query, { pageSize: ADMIN_PAGE_SIZE })
    const category = queryString(req.query, 'category')?.trim() ?? ''
    // INFERRED (as the reader list): an unknown category code matches nothing.
    if (category !== '' && category !== 'all' && !ARTICLE_CATEGORIES.includes(category as never)) {
      return paged({ rows: [], total: 0 }, page)
    }
    const published = queryString(req.query, 'published')?.trim() ?? ''
    const res = articlesRepo.adminList({
      search: queryString(req.query, 'search') ?? '',
      category: category as ArticleCategory | 'all' | '',
      published: published === '1' ? true : published === '0' ? false : '',
      page: page.page,
      pageSize: page.pageSize,
    })
    return paged(res, page)
  }),

  route(
    'GET',
    '/api/admin/articles/:id',
    [adminOnly],
    (req) => {
      const body = detailBody(Number(req.params.id))
      return body ? ok(body) : notFound(NOT_FOUND.article)
    },
    { params: { id: int() } },
  ),

  route('POST', '/api/admin/articles', [adminOnly], (req) => {
    const parsed = parse(req.body)
    if ('fields' in parsed) return validationError(parsed.fields)
    const row = articlesRepo.create(requireViewer(req).id, parsed.input)
    return created(detailBody(row.id), { status: ADMIN_FLASH.article.created })
  }),

  route(
    'PUT',
    '/api/admin/articles/:id',
    [adminOnly],
    (req) => {
      const id = Number(req.params.id)
      const current = articlesRepo.getVisible(id)
      if (!current) return notFound(NOT_FOUND.article)
      const parsed = parse(req.body, current)
      if ('fields' in parsed) return validationError(parsed.fields)
      try {
        articlesRepo.update(id, parsed.input)
      } catch (error) {
        if (error instanceof M09Error) return refusal(error)
        throw error
      }
      return ok(detailBody(id), { status: ADMIN_FLASH.article.updated })
    },
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/admin/articles/:id',
    [adminOnly],
    (req) => {
      const id = Number(req.params.id)
      if (!articlesRepo.getVisible(id)) return notFound(NOT_FOUND.article)
      articlesRepo.remove(id)
      return ok({ deleted: 1 }, { status: ADMIN_FLASH.article.deleted })
    },
    { params: { id: int() } },
  ),
]
