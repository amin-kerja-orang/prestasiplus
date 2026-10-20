import { statfs } from 'node:fs/promises'
import os from 'node:os'

import { Injectable } from '@nestjs/common'
import type { ServerStatus } from '@pp/contract'

const GB = 1024 ** 3

export interface CpuTimes {
  idle: number
  total: number
}

/** The host readings, injectable so a test asserts the shape without a real machine. */
export interface OsProbe {
  cpuTimes(): CpuTimes
  cores(): number
  load1(): number
  totalMem(): number
  freeMem(): number
  uptimeSec(): number
  /** Bytes of the root volume; zeros when it cannot be read. */
  disk(): Promise<{ total: number; free: number }>
}

export const nodeProbe: OsProbe = {
  cpuTimes() {
    let idle = 0
    let total = 0
    for (const c of os.cpus()) {
      idle += c.times.idle
      total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq
    }
    return { idle, total }
  },
  cores: () => Math.max(1, os.cpus().length),
  load1: () => os.loadavg()[0] ?? 0,
  totalMem: () => os.totalmem(),
  freeMem: () => os.freemem(),
  uptimeSec: () => os.uptime(),
  async disk() {
    try {
      const st = await statfs('/')
      return { total: st.blocks * st.bsize, free: st.bavail * st.bsize }
    } catch {
      return { total: 0, free: 0 }
    }
  },
}

const pct = (value: number): number => Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)))
const gb = (bytes: number): number => Math.round((bytes / GB) * 10) / 10
const ratio = (part: number, whole: number): number => (whole > 0 ? (part / whole) * 100 : 0)

/**
 * Host readings for the header pill. Readings only: no hostname, path, version, environment value or connection string.
 * `cpuPct` is the busy share of CPU time since the previous call (kept in `previous`); the first call falls back to
 * load average / cores. Pure apart from the probe and `previous`.
 */
export async function readServerStatus(probe: OsProbe, previous: CpuTimes | null): Promise<{ status: ServerStatus; cpu: CpuTimes }> {
  const cpu = probe.cpuTimes()
  const cores = probe.cores()
  const load = probe.load1()
  const dTotal = previous ? cpu.total - previous.total : 0
  const cpuPct = previous && dTotal > 0 ? (1 - (cpu.idle - previous.idle) / dTotal) * 100 : ratio(load, cores)
  const totalMem = probe.totalMem()
  const usedMem = Math.max(0, totalMem - probe.freeMem())
  const disk = await probe.disk()
  const usedDisk = Math.max(0, disk.total - disk.free)
  const up = Math.max(0, Math.floor(probe.uptimeSec()))
  return {
    cpu,
    status: {
      cpuPct: pct(cpuPct),
      ramPct: pct(ratio(usedMem, totalMem)),
      diskPct: pct(ratio(usedDisk, disk.total)),
      uptime: `${Math.floor(up / 86_400)}d ${Math.floor((up % 86_400) / 3_600)}h`,
      load: Math.round(Math.max(0, load) * 100) / 100,
      cores,
      ramUsedGb: gb(usedMem),
      ramTotalGb: gb(totalMem),
      diskUsedGb: gb(usedDisk),
      diskTotalGb: gb(disk.total),
    },
  }
}

@Injectable()
export class ServerStatusService {
  private previous: CpuTimes | null = null

  async status(probe: OsProbe = nodeProbe): Promise<ServerStatus> {
    const { status, cpu } = await readServerStatus(probe, this.previous)
    this.previous = cpu
    return status
  }
}
