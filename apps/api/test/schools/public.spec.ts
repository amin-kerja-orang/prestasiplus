import { JpnSchema, PpdSchema, SchoolSummarySchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { bootSchoolsApp, expectError, insertFillerSchools, schoolIdOf, type SchoolsTestApp } from './helpers'

const Schools = z.object({ data: z.array(SchoolSummarySchema) })
const Jpns = z.object({ data: z.array(JpnSchema) })
const Ppds = z.object({ data: z.array(PpdSchema) })

describe('public pickers (AC 1, AC 11)', () => {
  let t: SchoolsTestApp

  beforeAll(async () => {
    // A high ceiling: the throttle has its own spec.
    t = await bootSchoolsApp({ env: { THROTTLE_PUBLIC_PER_MINUTE: '10000' } })
    await insertFillerSchools(t.db, 150, 'SMK')
  })
  afterAll(async () => {
    await t.close()
  })

  const search = (q = '') => t.http().get(`/api/schools/search${q}`)

  describe('GET /api/schools/search', () => {
    it('answers a guest: active schools only, default limit 20, name A to Z, never the join code', async () => {
      const res = await search()
      expect(res.status).toBe(200)
      const body = Schools.parse(res.body)
      expect(body.data).toHaveLength(20)
      const names = body.data.map((s) => s.name)
      expect(names).toEqual([...names].sort())
      for (const s of body.data) {
        expect(Object.keys(s).sort()).toEqual(['city', 'code', 'district', 'id', 'name', 'state', 'type'])
      }
      expect(JSON.stringify(res.body)).not.toContain('DEMO0001')
    })

    it('limit: a positive integer is used, above 100 is clamped to 100, an invalid value falls back to 20', async () => {
      expect(Schools.parse((await search('?limit=5')).body).data).toHaveLength(5)
      expect(Schools.parse((await search('?limit=100')).body).data).toHaveLength(100)
      expect(Schools.parse((await search('?limit=100000')).body).data).toHaveLength(100)
      expect(Schools.parse((await search('?limit=99999999999999999999999')).body).data).toHaveLength(20)
      for (const bad of ['abc', '0', '-3', '1.5', '']) {
        expect(Schools.parse((await search(`?limit=${bad}`)).body).data, bad).toHaveLength(20)
      }
    })

    it('q matches name or code (case-insensitive) and state is an exact filter; blank values are ignored', async () => {
      // Secondary-only (2026-10-29): primary schools (SK, SJK) are hidden from the public search.
      expect(Schools.parse((await search('?q=demo%20tiga')).body).data).toEqual([])
      expect(Schools.parse((await search('?q=cth149')).body).data.map((s) => s.code)).toEqual(['CTH149'])
      expect(Schools.parse((await search('?state=Johor&limit=100')).body).data).toEqual([])
      expect(Schools.parse((await search('?state=Selangor&q=Satu')).body).data.map((s) => s.code)).toEqual(['DEMO001'])
      expect(Schools.parse((await search('?q=&state=%20')).body).data).toHaveLength(20)
      expect(Schools.parse((await search('?q=zzz-none')).body).data).toEqual([])
      // LIKE wildcards are literal
      expect(Schools.parse((await search('?q=%25')).body).data).toEqual([])
    })

    it('inactive schools are never listed; a repeated query parameter is ignored, not an error', async () => {
      // CTH010, CTH020, ... are inactive (i % 10 = 0).
      expect(Schools.parse((await search('?q=cth010')).body).data).toEqual([])
      expect((await search('?q=a&q=b&limit=3&limit=4')).status).toBe(200)
    })

    it('id returns that one active school and ignores the other filters; unknown, inactive or malformed ids give []', async () => {
      const id = await schoolIdOf(t.db, 'DEMO001')
      const one = Schools.parse((await search(`?id=${id}&q=nothing&state=Johor`)).body)
      expect(one.data.map((s) => s.code)).toEqual(['DEMO001'])
      const inactive = await schoolIdOf(t.db, 'CTH010')
      expect(Schools.parse((await search(`?id=${inactive}`)).body).data).toEqual([])
      expect(Schools.parse((await search(`?id=${await schoolIdOf(t.db, 'DEMO002')}`)).body).data).toEqual([]) // a primary school is hidden by id too
      expect(Schools.parse((await search('?id=99999999')).body).data).toEqual([])
      expect(Schools.parse((await search('?id=abc')).body).data).toEqual([])
    })

    it('ids are opaque strings and a database error is never leaked for a huge id', async () => {
      const res = await search('?id=99999999999999999999999999')
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    })
  })

  describe('GET /api/jpn and /api/jpn/:id/ppd (AC 11)', () => {
    it('lists the JPNs from the table, by id, in the mock shape', async () => {
      const res = await t.http().get('/api/jpn')
      expect(res.status).toBe(200)
      const body = Jpns.parse(res.body)
      const rows = await t.db.query<{ id: string; code: string; name: string }>(`select id::text, code, name from jpns order by id`)
      expect(body.data).toEqual(rows)
      expect(body.data.map((j) => j.code)).toEqual(expect.arrayContaining(['JHR', 'SGR']))
    })

    it('lists the PPDs of one JPN by code, each stored exactly as the school district value', async () => {
      const jpns = Jpns.parse((await t.http().get('/api/jpn')).body).data
      const selangor = jpns.find((j) => j.code === 'SGR')
      const res = await t.http().get(`/api/jpn/${selangor?.id}/ppd`)
      expect(res.status).toBe(200)
      const body = Ppds.parse(res.body)
      const rows = await t.db.query<{ code: string }>(
        `select code from ppds where jpn_id = $1 order by code`,
        [selangor?.id],
      )
      expect(body.data.map((p) => p.code)).toEqual(rows.map((r) => r.code))
      expect(body.data.every((p) => p.jpnId === selangor?.id)).toBe(true)
      const districts = await t.db.query<{ district: string }>(`select distinct district from schools where state = 'Selangor' order by 1`)
      expect(body.data.map((p) => p.code)).toEqual(districts.map((d) => d.district))
    })

    it('404 for an unknown or malformed JPN', async () => {
      expectError(await t.http().get('/api/jpn/99999/ppd'), 'NOT_FOUND', 'Not Found.')
      expectError(await t.http().get('/api/jpn/abc/ppd'), 'NOT_FOUND')
      expectError(await t.http().get('/api/jpn/99999999999999999999999/ppd'), 'NOT_FOUND')
    })
  })
})
