import { SessionSchema, type FileRef, FileRefSchema } from '@pp/contract'
import type request from 'supertest'
import { expect } from 'vitest'

import { makePng } from '../files/fixtures'
import { bootMarketplaceApp, DEMO_PASSWORD, type MarketplaceTestApp } from './helpers'

export { ACCOUNTS, count, expectError } from './helpers'
export type { MarketplaceTestApp } from './helpers'

/** A signed-in client with every verb; writes carry the CSRF token like the browser. */
export interface AdminClient {
  csrf: string
  get(url: string): request.Test
  post(url: string): request.Test
  put(url: string): request.Test
  del(url: string): request.Test
  /** A write without the CSRF header. */
  postNoCsrf(url: string): request.Test
  putNoCsrf(url: string): request.Test
  delNoCsrf(url: string): request.Test
  upload(purpose: string, bytes?: Buffer, contentType?: string): Promise<FileRef>
}

export async function bootAdminApp(): Promise<MarketplaceTestApp> {
  return bootMarketplaceApp({ UPLOAD_RATE_PER_MINUTE: '1000', FILE_READS_PER_MINUTE: '10000', THROTTLE_ADMIN_WRITE_PER_MINUTE: '1000' })
}

export async function clientAs(t: MarketplaceTestApp, identifier: string): Promise<AdminClient> {
  const agent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const csrf = SessionSchema.parse(res.body.data).csrf
  return {
    csrf,
    get: (url) => agent.get(url),
    post: (url) => agent.post(url).set('X-CSRF-Token', csrf),
    put: (url) => agent.put(url).set('X-CSRF-Token', csrf),
    del: (url) => agent.delete(url).set('X-CSRF-Token', csrf),
    postNoCsrf: (url) => agent.post(url),
    putNoCsrf: (url) => agent.put(url),
    delNoCsrf: (url) => agent.delete(url),
    async upload(purpose, bytes = makePng(), contentType = 'image/png') {
      const up = await agent.post(`/api/files?purpose=${purpose}`).set('X-CSRF-Token', csrf).attach('file', bytes, { filename: 'gambar.png', contentType })
      expect(up.status, JSON.stringify(up.body)).toBe(201)
      return FileRefSchema.parse(up.body.data)
    },
  }
}

export const VALID_PRODUCT = {
  sellerId: null,
  name: 'Beg Ujian Admin',
  categoryId: '1',
  price: '50.00',
  originalPrice: '70.00',
  description: 'Beg ujian.',
  condition: 'new',
  stockStatus: 'available',
  shippingMethod: 'postage',
  shippingFee: '8.00',
  location: 'Kuala Lumpur',
} as const

/** Inserts a seller owned by a seeded demo user (other than the one that owns the seed shop). Returns the seller id. */
export async function insertSeller(t: MarketplaceTestApp, email: string, status: string, shopName: string, verified = false): Promise<string> {
  const rows = await t.db.query<{ id: string }>(
    `insert into marketplace_sellers (user_id, shop_name, description, phone, whatsapp, status, verified_at)
     select u.id, $2, 'Penerangan ujian', '0111111111', '60111111111', $3, case when $4 then now() else null end from users u where lower(u.email) = $1 returning id::text`,
    [email, shopName, status, verified],
  )
  return rows[0]!.id
}

export const auditRows = (t: MarketplaceTestApp, action: string) =>
  t.db.query<{ actor_user_id: string; target_type: string; target_id: string; detail: Record<string, unknown> | null }>(
    `select actor_user_id::text, target_type, target_id, detail from audit_events where action = $1 order by id`,
    [action],
  )
