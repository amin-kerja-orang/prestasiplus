/**
 * SRS M09 v1.5 §7 #6 `GET /api/articles` (S15), #7 `GET /api/articles/hot`, #8
 * `GET /api/articles/:slug` (S16, counts a view) and #9 `GET /api/articles/latest`. All public (G).
 * Only published articles are ever returned (BR-M09-02); the order is BR-M09-03.
 */

import {
  notFound,
  ok,
  paged,
  pageParams,
  queryInt,
  queryString,
  route,
  unpaged,
  type RouteDef,
} from '@/mock/define'

import { articlesRepo } from '../repository'
import { READER_PAGE_SIZE } from '../repository/articles'
import { ARTICLE_CATEGORIES, type ArticleCategory } from '../types'

const MAX_LATEST = 50

export const articleRoutes: RouteDef[] = [
  route('GET', '/api/articles', (req) => {
    const page = pageParams(req.query, { pageSize: READER_PAGE_SIZE })
    const category = queryString(req.query, 'category')?.trim() ?? ''
    // INFERRED: an unknown category code matches nothing (live filters by the code).
    if (category !== '' && category !== 'all' && !ARTICLE_CATEGORIES.includes(category as never)) {
      return paged({ rows: [], total: 0 }, page)
    }
    const res = articlesRepo.readerList({
      search: queryString(req.query, 'search') ?? '',
      category: category as ArticleCategory | 'all' | '',
      page: page.page,
      pageSize: page.pageSize,
    })
    return paged(res, page)
  }),

  route('GET', '/api/articles/hot', (_req, ctx) =>
    unpaged(articlesRepo.hot(ctx.prng.stream('m09:articles:hot'))),
  ),

  route('GET', '/api/articles/latest', (req) => {
    const limit = Math.min(Math.max(queryInt(req.query, 'limit') ?? 5, 1), MAX_LATEST)
    return unpaged(articlesRepo.latest(limit))
  }),

  route('GET', '/api/articles/:slug', (req) => {
    const detail = articlesRepo.detail(String(req.params.slug), { countView: true })
    return detail ? ok(detail) : notFound()
  }),
]
