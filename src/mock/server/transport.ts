/**
 * `MockTransport` (overview §6.1, ADR-0004): the in-process `Transport` installed in `mock` mode.
 *
 * Per request:
 * 1. **request log** entry (before anything else, so aborted and faulted calls are visible);
 * 2. **latency** (global or per path; abortable: an abort rejects and the handler never runs);
 * 3. **fault injection**: a queued `failNext` fault answers instead of the handler, or rejects with
 *    `TransportNetworkError` for `'network'`;
 * 4. the **mock server** (routing, session, guards, handler, write-through `db.settled()`);
 * 5. if the signal was aborted meanwhile, reject with the abort reason (like `fetch`).
 *
 * Like any transport it never throws for an HTTP error status.
 */

import {
  TransportNetworkError,
  type Transport,
  type TransportRequest,
  type TransportResponse,
} from '@/api/transport'
import type { Clock } from '@/lib/time'

import type { FaultControl } from '../faults'
import { abortReason, type LatencyControl } from '../latency'
import { snapshotBody, type RequestLog } from '../request-log'
import { splitUrl } from './request'
import { cloneResponse } from './respond'
import type { MockServer } from './server'

export interface MockTransportOptions {
  server: MockServer
  latency: LatencyControl
  faults: FaultControl
  log: RequestLog
  clock: Clock
}

export class MockTransport implements Transport {
  private readonly options: MockTransportOptions

  constructor(options: MockTransportOptions) {
    this.options = options
  }

  async request(req: TransportRequest, signal?: AbortSignal): Promise<TransportResponse> {
    const { server, latency, faults, log, clock } = this.options
    const { path, query } = splitUrl(req.url, req.query)
    const entry = log.record({
      at: clock.now(),
      method: req.method,
      path,
      query,
      body: snapshotBody(req.body),
    })

    try {
      await latency.wait(req.method, path, signal)

      const fault = faults.take(req.method, path)
      if (fault?.kind === 'network') {
        entry.faulted = true
        entry.outcome = 'network-error'
        throw new TransportNetworkError('Network request failed (injected by failNext)')
      }

      const res = fault
        ? cloneResponse(fault.response)
        : await server.handle({ ...req, url: path, query })

      if (signal?.aborted) throw abortReason(signal)

      entry.faulted = fault !== null
      entry.outcome = 'response'
      entry.status = res.status
      return { status: res.status, headers: res.headers, body: res.body ?? null }
    } catch (err) {
      if (signal?.aborted && entry.outcome === 'pending') entry.outcome = 'aborted'
      throw err
    }
  }
}
