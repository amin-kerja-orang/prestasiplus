/**
 * M20 buyer endpoints (SRS M20 v1.2 §7 #13–#17; any signed-in role: guest 401).
 *
 * | # | Route |
 * |---|---|
 * | 13 | `GET /api/marketplace/categories` |
 * | 14 | `GET /api/marketplace/products` (`?q=&category=&condition=&sort=&page=`, 20 per page) |
 * | 15 | `GET /api/marketplace/products/:slug` (`views` + 1 on every call, BR-M20-12) |
 * | 16 | `POST /api/marketplace/products/:slug/whatsapp` (`{url}`, `whatsappClicks` + 1, D14) |
 * | 17 | `GET /api/marketplace/sellers/:id` (active sellers only, BR-M20-08) |
 *
 * Paging uses the project envelope (`meta.page`, `pageSize`, `totalItems`, `totalPages`), which
 * carries the SRS `{page, perPage, total, lastPage}` figures under their project names.
 */

import {
  int,
  notFound,
  ok,
  pageParams,
  paginate,
  queryString,
  requireAuth,
  route,
  str,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'

import {
  PAGE_SIZE,
  mpCategoriesRepository,
  mpProductsRepository,
  mpSellersRepository,
} from '../repository/marketplace'
import { recordWhatsapp } from '../whatsapp-log'

const signedIn = requireAuth()

/** V-M20-03: `q` trimmed, at most 100 characters; every other value is taken as it is. */
const text = (req: MockRequest, key: string, max = 1000): string =>
  (queryString(req.query, key) ?? '').trim().slice(0, max)

// #13
function categories(): MockResponse {
  return ok(mpCategoriesRepository.all())
}

// #14
function search(req: MockRequest): MockResponse {
  const rows = mpProductsRepository.buyerList({
    q: text(req, 'q', 100),
    category: text(req, 'category'),
    condition: text(req, 'condition'),
    sort: text(req, 'sort'),
  })
  return paginate(
    rows.map((p) => mpProductsRepository.card(p)),
    pageParams(req.query, { pageSize: PAGE_SIZE }),
  )
}

// #15
function product(req: MockRequest): MockResponse {
  const detail = mpProductsRepository.view(String(req.params.slug))
  return detail ? ok(detail) : notFound()
}

// #16
function whatsapp(req: MockRequest): MockResponse {
  const result = mpSellersRepository.click(String(req.params.slug))
  if (!result) return notFound()
  recordWhatsapp(result.url)
  return ok({ url: result.url })
}

// #17
function shop(req: MockRequest): MockResponse {
  const view = mpSellersRepository.shop(Number(req.params.id))
  return view ? ok(view) : notFound()
}

export const buyerRoutes: RouteDef[] = [
  route('GET', '/api/marketplace/categories', [signedIn], categories),
  route('GET', '/api/marketplace/products', [signedIn], search),
  route('GET', '/api/marketplace/products/:slug', [signedIn], product, { params: { slug: str() } }),
  route('POST', '/api/marketplace/products/:slug/whatsapp', [signedIn], whatsapp, {
    params: { slug: str() },
  }),
  route('GET', '/api/marketplace/sellers/:id', [signedIn], shop, { params: { id: int() } }),
]
