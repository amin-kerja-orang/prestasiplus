// @vitest-environment jsdom
import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { useBattleSearch } from '../../composables/useBattleSearch'

const api = vi.hoisted(() => ({
  startBattle: vi.fn(),
  pollMatch: vi.fn(),
  acceptChallenger: vi.fn(),
  rejectChallenger: vi.fn(),
  joinQueue: vi.fn(),
  pollChallenger: vi.fn(),
}))
vi.mock('../../api/battle', () => api)

const res = (status: number, body: unknown) => ({ status, headers: {}, body })
const PARAMS = { question_type: 'biasa', open_to_all: false, subject_id: 3 } as const

let onMatched: Mock<(battleUuid: string) => void>
let scope: ReturnType<typeof effectScope>
let s: ReturnType<typeof useBattleSearch>

function setup() {
  onMatched = vi.fn<(battleUuid: string) => void>()
  scope = effectScope()
  s = scope.run(() => useBattleSearch({ onMatched }))!
}

async function started() {
  api.startBattle.mockResolvedValueOnce(res(200, { queue_id: 41 }))
  await s.start('quick-match', PARAMS)
}

const tick = (ms = 3000) => vi.advanceTimersByTimeAsync(ms)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-25T08:00:00Z'))
  for (const fn of Object.values(api)) fn.mockReset()
  setup()
})
afterEach(() => {
  scope.stop()
  vi.useRealTimers()
})

describe('start (#2 / #3)', () => {
  it('posts the mode and starts searching with the timer at 0:00', async () => {
    await started()
    expect(api.startBattle).toHaveBeenCalledWith('quick-match', PARAMS, expect.anything())
    expect(s.phase.value).toBe('searching')
    expect(s.elapsedText.value).toBe('0:00')
    expect(api.pollMatch).not.toHaveBeenCalled()
  })

  it('a matched answer goes straight to the arena', async () => {
    api.startBattle.mockResolvedValueOnce(res(200, { matched: true, battle_uuid: 'b-1' }))
    await s.start('school-battle', PARAMS)
    expect(onMatched).toHaveBeenCalledWith('b-1')
    expect(s.phase.value).toBe('idle')
  })

  it.each([
    [422, {}, 'Ralat dari server. Sila cuba lagi.'],
    [403, { error: 'Tidak dibenarkan.' }, 'Tidak dibenarkan.'],
    [500, { message: 'Gagal.' }, 'Gagal.'],
  ])('status %i %j shows %s', async (status, body, text) => {
    api.startBattle.mockResolvedValueOnce(res(status, body))
    await s.start('quick-match', PARAMS)
    expect(s.errorMsg.value).toBe(text)
    expect(s.phase.value).toBe('idle')
    expect(s.loading.value).toBe(false)
  })

  it('a non-object body is "Respon tidak dijangka."', async () => {
    api.startBattle.mockResolvedValueOnce(res(200, 'x'))
    await s.start('quick-match', PARAMS)
    expect(s.errorMsg.value).toBe('Respon tidak dijangka. Sila cuba lagi.')
  })

  it('a missing queue id is the system error', async () => {
    api.startBattle.mockResolvedValueOnce(res(200, {}))
    await s.start('quick-match', PARAMS)
    expect(s.errorMsg.value).toBe('Ralat sistem: ID giliran tidak sah. Sila cuba lagi.')
  })

  it('a network failure shows the network message', async () => {
    api.startBattle.mockRejectedValueOnce(new Error('net'))
    await s.start('quick-match', PARAMS)
    expect(s.errorMsg.value).toBe('Ralat rangkaian. Sila semak internet anda.')
  })

  it('ignores a second start while searching', async () => {
    await started()
    await s.start('quick-match', PARAMS)
    expect(api.startBattle).toHaveBeenCalledTimes(1)
  })
})

describe('polling #4 (3 s, stop rules)', () => {
  it('polls every 3 s, sets the timer text on each poll and goes to the arena when matched', async () => {
    await started()
    api.pollMatch.mockResolvedValue(res(200, { status: 'waiting' }))
    await tick(2999)
    expect(api.pollMatch).not.toHaveBeenCalled()
    await tick(1)
    expect(api.pollMatch).toHaveBeenCalledTimes(1)
    expect(api.pollMatch.mock.calls[0]![0]).toBe(41)
    expect(s.elapsedText.value).toBe('0:03')
    await tick()
    expect(s.elapsedText.value).toBe('0:06')
    api.pollMatch.mockResolvedValueOnce(res(200, { status: 'matched', battle_uuid: 'b-9' }))
    await tick()
    expect(onMatched).toHaveBeenCalledWith('b-9')
    expect(s.phase.value).toBe('idle')
    await tick(30_000)
    expect(api.pollMatch).toHaveBeenCalledTimes(3)
  })

  it('never overlaps: a slow poll delays the next one', async () => {
    await started()
    let release!: (v: unknown) => void
    api.pollMatch.mockReturnValueOnce(new Promise((r) => (release = r)))
    await tick(3000)
    await tick(9000)
    expect(api.pollMatch).toHaveBeenCalledTimes(1)
    api.pollMatch.mockResolvedValue(res(200, { status: 'waiting' }))
    release(res(200, { status: 'waiting' }))
    await tick(0)
    // the missed slots are skipped: one poll now, the next a full interval later
    expect(api.pollMatch).toHaveBeenCalledTimes(2)
    await tick(2999)
    expect(api.pollMatch).toHaveBeenCalledTimes(2)
    await tick(1)
    expect(api.pollMatch).toHaveBeenCalledTimes(3)
  })

  it.each(['expired', 'not_found'])('%s stops with "Tiada lawan dijumpai."', async (status) => {
    await started()
    api.pollMatch.mockResolvedValueOnce(res(200, { status }))
    await tick()
    expect(s.phase.value).toBe('idle')
    expect(s.errorMsg.value).toBe('Tiada lawan dijumpai. Sila cuba lagi.')
    await tick(9000)
    expect(api.pollMatch).toHaveBeenCalledTimes(1)
  })

  it('stops at 120 s without another request', async () => {
    await started()
    api.pollMatch.mockResolvedValue(res(200, { status: 'waiting' }))
    await tick(117_000)
    expect(api.pollMatch).toHaveBeenCalledTimes(39)
    expect(s.phase.value).toBe('searching')
    await tick(3000)
    expect(api.pollMatch).toHaveBeenCalledTimes(39)
    expect(s.phase.value).toBe('idle')
    expect(s.elapsedText.value).toBe('2:00')
    expect(s.errorMsg.value).toBe('Tiada lawan dijumpai dalam masa 2 minit. Sila cuba lagi.')
  })

  it('5 consecutive non-OK polls stop; a success resets the counter', async () => {
    await started()
    api.pollMatch.mockResolvedValue(res(500, {}))
    await tick(12_000)
    expect(s.phase.value).toBe('searching')
    api.pollMatch.mockResolvedValueOnce(res(200, { status: 'waiting' }))
    await tick(3000)
    api.pollMatch.mockResolvedValue(res(500, {}))
    await tick(12_000)
    expect(s.phase.value).toBe('searching')
    await tick(3000)
    expect(s.phase.value).toBe('idle')
    expect(s.errorMsg.value).toBe('Ralat berulang semasa mencari lawan. Sila cuba lagi.')
  })

  it('5 consecutive network failures stop with the network message', async () => {
    await started()
    api.pollMatch.mockRejectedValue(new Error('net'))
    await tick(15_000)
    expect(api.pollMatch).toHaveBeenCalledTimes(5)
    expect(s.phase.value).toBe('idle')
    expect(s.errorMsg.value).toBe('Ralat rangkaian berulang. Sila semak internet anda.')
  })

  it('"Batal" stops the polling and sends no request', async () => {
    await started()
    api.pollMatch.mockResolvedValue(res(200, { status: 'waiting' }))
    await tick(3000)
    s.cancel()
    expect(s.phase.value).toBe('idle')
    await tick(30_000)
    expect(api.pollMatch).toHaveBeenCalledTimes(1)
    expect(api.rejectChallenger).not.toHaveBeenCalled()
    expect(s.errorMsg.value).toBe('')
  })

  it('disposing the scope clears the timer', async () => {
    await started()
    scope.stop()
    await tick(30_000)
    expect(api.pollMatch).not.toHaveBeenCalled()
  })

  it('a poll that answers after "Batal" is ignored', async () => {
    await started()
    let release!: (v: unknown) => void
    api.pollMatch.mockReturnValueOnce(new Promise((r) => (release = r)))
    await tick(3000)
    s.cancel()
    release(res(200, { status: 'matched', battle_uuid: 'late' }))
    await tick(0)
    expect(onMatched).not.toHaveBeenCalled()
  })
})

describe('incoming challenger (#5, #6)', () => {
  const challenger = { name: 'Murid A', grade_label: 'Darjah 4', school: 'SK Satu' }

  async function incoming() {
    await started()
    api.pollMatch.mockResolvedValue(res(200, { status: 'incoming_challenge', challenger }))
    await tick(3000)
  }

  it('shows the card and keeps polling', async () => {
    await incoming()
    expect(s.phase.value).toBe('incoming')
    expect(s.challenger.value).toEqual(challenger)
    await tick(3000)
    expect(api.pollMatch).toHaveBeenCalledTimes(2)
  })

  it('"Terima" goes to the arena', async () => {
    await incoming()
    api.acceptChallenger.mockResolvedValueOnce(res(200, { matched: true, battle_uuid: 'b-5' }))
    await s.respond(true)
    expect(api.acceptChallenger).toHaveBeenCalledWith(41)
    expect(onMatched).toHaveBeenCalledWith('b-5')
  })

  it('"Tolak" returns to searching and polling continues', async () => {
    await incoming()
    api.rejectChallenger.mockResolvedValueOnce(res(200, { success: true }))
    api.pollMatch.mockResolvedValue(res(200, { status: 'waiting' }))
    await s.respond(false)
    expect(api.rejectChallenger).toHaveBeenCalledWith(41)
    expect(s.phase.value).toBe('searching')
    expect(s.challenger.value).toBeNull()
    await tick(3000)
    expect(api.pollMatch).toHaveBeenCalledTimes(2)
  })

  it('a data.error clears the card and shows the banner', async () => {
    await incoming()
    api.acceptChallenger.mockResolvedValueOnce(res(404, { error: 'Antrian tidak dijumpai.' }))
    await s.respond(true)
    expect(s.challenger.value).toBeNull()
    expect(s.errorMsg.value).toBe('Antrian tidak dijumpai.')
  })

  it('a network failure shows "Ralat rangkaian."', async () => {
    await incoming()
    api.acceptChallenger.mockRejectedValueOnce(new Error('net'))
    await s.respond(true)
    expect(s.errorMsg.value).toBe('Ralat rangkaian.')
  })
})

describe('waiting for approval (#12, #13; DV-M16-06)', () => {
  it('requestJoin posts #12 once then polls #13 every 3 s', async () => {
    api.joinQueue.mockResolvedValueOnce(res(200, { success: true }))
    api.pollChallenger.mockResolvedValue(res(200, { status: 'waiting' }))
    await s.requestJoin(7, 'Murid B', 'Darjah 4')
    expect(api.joinQueue).toHaveBeenCalledWith(7)
    expect(s.phase.value).toBe('waiting')
    expect(s.waitingName.value).toBe('Murid B')
    await tick(3000)
    await tick(3000)
    expect(api.pollChallenger).toHaveBeenCalledTimes(2)
    api.pollChallenger.mockResolvedValueOnce(res(200, { status: 'matched', battle_uuid: 'w-1' }))
    await tick(3000)
    expect(onMatched).toHaveBeenCalledWith('w-1')
  })

  it('a failed join shows "Ralat menghantar permohonan."', async () => {
    api.joinQueue.mockResolvedValueOnce(res(404, { error: 'Ralat menghantar permohonan.' }))
    await s.requestJoin(7, 'Murid B')
    expect(s.phase.value).toBe('idle')
    expect(s.errorMsg.value).toBe('Ralat menghantar permohonan.')
    expect(api.pollChallenger).not.toHaveBeenCalled()
  })

  it.each([
    ['rejected', 'Murid B menolak permohonan anda.'],
    ['expired', 'Pemain sudah keluar dari barisan.'],
    ['not_found', 'Pemain sudah keluar dari barisan.'],
  ])('%s stops with its message', async (status, text) => {
    api.pollChallenger.mockResolvedValueOnce(res(200, { status }))
    s.watchWaiting(7, 'Murid B')
    await tick(3000)
    expect(s.phase.value).toBe('idle')
    expect(s.errorMsg.value).toBe(text)
  })

  it('a network failure stops with "Ralat rangkaian. Sila cuba lagi."', async () => {
    api.pollChallenger.mockRejectedValueOnce(new Error('net'))
    s.watchWaiting(7, 'Murid B')
    await tick(3000)
    expect(s.errorMsg.value).toBe('Ralat rangkaian. Sila cuba lagi.')
  })
})
