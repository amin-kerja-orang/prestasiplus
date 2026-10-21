import { Injectable } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

export const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] as const
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
export const UNMATCHED_ROUTE = 'unmatched'

interface Histogram {
  buckets: number[] // cumulative counts are computed on render; this holds per-bucket (non-cumulative) hits
  sum: number
  count: number
}

/** Escapes a Prometheus label value. */
export function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')
}

/**
 * The route TEMPLATE of a finished request (`/api/users/:id`), never the raw URL: the label set must not carry ids,
 * query strings or user data. Requests that matched no route are `unmatched`.
 */
export function routeLabel(req: Pick<Request, 'route' | 'baseUrl'>): string {
  const path = (req.route as { path?: unknown } | undefined)?.path
  // Nest registers a catch-all (`/api{/*splat}`) for its own middleware; a request that only reached it matched no handler.
  if (typeof path !== 'string' || path.includes('*')) return UNMATCHED_ROUTE
  return `${req.baseUrl ?? ''}${path}` || UNMATCHED_ROUTE
}

/** Hand-rolled in-memory Prometheus registry (no dependency). */
@Injectable()
export class MetricsService {
  private readonly requests = new Map<string, number>()
  private readonly durations = new Map<string, Histogram>()
  private inFlight = 0

  /** Express middleware: counts every request that reaches the Express stack, including 4xx from guards and 404s. */
  readonly middleware = (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint()
    this.inFlight++
    let done = false
    const finish = (): void => {
      if (done) return
      done = true
      this.inFlight--
      const seconds = Number(process.hrtime.bigint() - start) / 1e9
      this.observe(req.method, routeLabel(req), res.statusCode, seconds)
    }
    res.once('finish', finish)
    res.once('close', finish)
    next()
  }

  observe(method: string, route: string, status: number, seconds: number): void {
    const m = METHODS.has(method) ? method : 'OTHER'
    const counterKey = `${m}\u0000${route}\u0000${status}`
    this.requests.set(counterKey, (this.requests.get(counterKey) ?? 0) + 1)
    const histKey = `${m}\u0000${route}`
    let h = this.durations.get(histKey)
    if (!h) {
      h = { buckets: new Array<number>(DURATION_BUCKETS.length + 1).fill(0), sum: 0, count: 0 }
      this.durations.set(histKey, h)
    }
    const idx = DURATION_BUCKETS.findIndex((b) => seconds <= b)
    h.buckets[idx === -1 ? DURATION_BUCKETS.length : idx]!++
    h.sum += seconds
    h.count++
  }

  /** Prometheus text exposition format 0.0.4. */
  render(): string {
    const out: string[] = []
    out.push('# HELP http_requests_total Total HTTP requests by method, route template and status.', '# TYPE http_requests_total counter')
    for (const [key, value] of this.requests) {
      const [method, route, status] = key.split('\u0000')
      out.push(`http_requests_total{method="${method}",route="${escapeLabel(route!)}",status="${status}"} ${value}`)
    }
    out.push('# HELP http_request_duration_seconds HTTP request duration in seconds.', '# TYPE http_request_duration_seconds histogram')
    for (const [key, h] of this.durations) {
      const [method, route] = key.split('\u0000')
      const base = `method="${method}",route="${escapeLabel(route!)}"`
      let cumulative = 0
      DURATION_BUCKETS.forEach((b, i) => {
        cumulative += h.buckets[i]!
        out.push(`http_request_duration_seconds_bucket{${base},le="${b}"} ${cumulative}`)
      })
      out.push(`http_request_duration_seconds_bucket{${base},le="+Inf"} ${h.count}`)
      out.push(`http_request_duration_seconds_sum{${base}} ${h.sum}`, `http_request_duration_seconds_count{${base}} ${h.count}`)
    }
    out.push('# HELP http_requests_in_flight HTTP requests currently being handled.', '# TYPE http_requests_in_flight gauge', `http_requests_in_flight ${this.inFlight}`)
    const mem = process.memoryUsage()
    out.push(
      '# HELP process_uptime_seconds Seconds since the process started.',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${process.uptime()}`,
      '# HELP process_resident_memory_bytes Resident set size in bytes.',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${mem.rss}`,
      '# HELP nodejs_heap_used_bytes V8 heap used in bytes.',
      '# TYPE nodejs_heap_used_bytes gauge',
      `nodejs_heap_used_bytes ${mem.heapUsed}`,
    )
    return `${out.join('\n')}\n`
  }
}
