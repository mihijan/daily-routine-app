import { afterEach, describe, expect, it, vi } from 'vitest'
import { TICK_INTERVAL_MS, Scheduler } from '../../../src/main/scheduler/Scheduler'
import type { NotificationLogEntry, PauseState, ScheduleBlock } from '../../../src/shared/types'

function block(id: string, name: string, startTime: string, endTime: string): ScheduleBlock {
  return { id, name, startTime, endTime }
}

const BLOCKS = [block('one', 'Первый', '10:00', '11:00'), block('two', 'Второй', '11:00', '12:00')]

function at(hours: number, minutes: number, seconds = 0, day = 25): Date {
  return new Date(2026, 10, day, hours, minutes, seconds)
}

interface Harness {
  scheduler: Scheduler
  sent: string[]
  marked: NotificationLogEntry[]
  setNow: (value: Date) => void
  setBlocks: (value: ScheduleBlock[]) => void
  setPaused: (value: boolean, until: string | null) => void
  setOverride: (value: ScheduleBlock[] | null) => void
}

function harness(options?: { blocks?: ScheduleBlock[]; now?: Date }): Harness {
  let now = options?.now ?? at(9, 59, 59)
  let blocks = options?.blocks ?? BLOCKS
  const sent: string[] = []
  const marked: NotificationLogEntry[] = []
  let pauseState: PauseState = { paused: false, pausedUntil: null }
  let overrideBlocks: ScheduleBlock[] | null = null

  const scheduler = new Scheduler({
    now: () => now,
    getState: () => ({
      schemaVersion: 1,
      permanentSchedule: blocks,
      dailyOverride: overrideBlocks ? { date: '2026-11-25', blocks: overrideBlocks } : null,
      pauseState,
      notificationLog: marked.map((entry) => ({ ...entry }))
    }),
    sendNotification: (body) => {
      sent.push(body)
    },
    markFired: (entry) => {
      marked.push(entry)
    }
  })

  return {
    scheduler,
    sent,
    marked,
    setNow: (value: Date) => {
      now = value
    },
    setBlocks: (value: ScheduleBlock[]) => {
      blocks = value
    },
    setPaused: (value: boolean, until: string | null) => {
      pauseState = { paused: value, pausedUntil: until }
    },
    setOverride: (value: ScheduleBlock[] | null) => {
      overrideBlocks = value
    }
  }
}

describe('Scheduler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires the block start once the clock reaches it, and not again', () => {
    const { scheduler, sent, marked, setNow } = harness()
    scheduler.reconcile()
    setNow(at(10, 0, 0))
    scheduler.tick()

    expect(sent).toEqual(['Первый'])
    expect(marked).toHaveLength(1)
    expect(marked[0]).toMatchObject({ date: '2026-11-25', blockId: 'one', type: 'transition' })

    setNow(at(10, 0, 1))
    scheduler.tick()
    expect(sent).toEqual(['Первый'])
  })

  it('does not send a notification that is already in the log', () => {
    const { scheduler, sent, marked, setNow } = harness()
    marked.push({
      date: '2026-11-25',
      blockId: 'one',
      type: 'transition',
      firedAt: '2026-11-25T08:00:00.000Z'
    })
    scheduler.reconcile()
    setNow(at(10, 0, 0))
    scheduler.tick()
    expect(sent).toEqual([])
    expect(marked).toHaveLength(1)
  })

  it('does not replay a boundary that is already behind the reference point', () => {
    const { scheduler, sent, setNow } = harness({ now: at(10, 0, 0) })
    scheduler.reconcile()
    setNow(at(10, 0, 1))
    scheduler.tick()
    expect(sent).toEqual([])
  })

  it('does not replay notifications across a clock jump', () => {
    const { scheduler, sent, setNow } = harness()
    scheduler.reconcile()
    setNow(at(11, 0, 0))
    scheduler.tick()
    expect(sent).toEqual([])

    setNow(at(11, 0, 1))
    scheduler.tick()
    expect(sent).toEqual([])
  })

  it('still delivers a notification a few seconds late', () => {
    const { scheduler, sent, setNow } = harness({ now: at(9, 59, 58) })
    scheduler.reconcile()
    setNow(at(10, 0, 2))
    scheduler.tick()
    expect(sent).toEqual(['Первый'])
  })

  it('stays silent while pause is active and does not backfill after resume', () => {
    const { scheduler, sent, setNow, setPaused } = harness()
    setPaused(true, '2026-11-26')
    scheduler.reconcile()
    setNow(at(10, 0, 0))
    scheduler.tick()
    expect(sent).toEqual([])

    setPaused(false, null)
    setNow(at(10, 0, 1))
    scheduler.tick()
    expect(sent).toEqual([])

    setNow(at(10, 57, 59))
    scheduler.reconcile()
    setNow(at(10, 58, 0))
    scheduler.tick()
    expect(sent).toEqual(['→ Второй'])
  })

  it('allows notifications again on the working day stored in the pause', () => {
    const { scheduler, sent, setNow, setPaused } = harness({ now: at(9, 59, 59, 26) })
    setPaused(true, '2026-11-26')
    scheduler.reconcile()
    setNow(at(10, 0, 0, 26))
    scheduler.tick()
    expect(sent).toEqual(['Первый'])
  })

  it('sends nothing on Saturday', () => {
    const { scheduler, sent, setNow } = harness({ now: at(9, 59, 59, 28) })
    scheduler.reconcile()
    setNow(at(10, 0, 0, 28))
    scheduler.tick()
    expect(sent).toEqual([])
  })

  it('uses the daily override instead of the permanent schedule', () => {
    const { scheduler, sent, setNow, setOverride } = harness()
    setOverride([block('custom', 'Свой день', '10:00', '18:00')])
    scheduler.reconcile()
    setNow(at(10, 0, 0))
    scheduler.tick()
    expect(sent).toEqual(['Свой день'])
  })

  it('after reconcile, follows the new schedule from now forward', () => {
    const { scheduler, sent, setNow, setBlocks } = harness({ now: at(15, 0, 0) })
    scheduler.reconcile()
    setBlocks([block('later', 'Позже', '16:00', '17:00')])
    setNow(at(15, 59, 59))
    scheduler.reconcile()
    setNow(at(16, 0, 0))
    scheduler.tick()
    expect(sent).toEqual(['Позже'])
  })

  it('ignores a re-entrant tick', () => {
    const sent: string[] = []
    let now = at(9, 59, 59)
    const scheduler = new Scheduler({
      now: () => now,
      getState: () => ({
        schemaVersion: 1,
        permanentSchedule: BLOCKS,
        dailyOverride: null,
        pauseState: { paused: false, pausedUntil: null },
        notificationLog: []
      }),
      sendNotification: (body) => {
        sent.push(body)
        scheduler.tick()
      },
      markFired: () => undefined
    })

    scheduler.reconcile()
    now = at(10, 0, 0)
    scheduler.tick()
    expect(sent).toEqual(['Первый'])
  })

  it('publishes the phase when reconciling', () => {
    const phases: string[] = []
    let now = at(9, 0, 0)
    const scheduler = new Scheduler({
      now: () => now,
      getState: () => ({
        schemaVersion: 1,
        permanentSchedule: BLOCKS,
        dailyOverride: null,
        pauseState: { paused: false, pausedUntil: null },
        notificationLog: []
      }),
      sendNotification: () => undefined,
      markFired: () => undefined,
      onStateChange: (snapshot) => {
        phases.push(snapshot.phase)
      }
    })

    scheduler.reconcile()
    now = at(10, 30, 0)
    scheduler.reconcile()
    expect(phases).toEqual(['before-start', 'active'])
  })

  it('runs the check on a one-second interval after start', () => {
    vi.useFakeTimers()
    const { scheduler, sent, setNow } = harness()
    scheduler.start()
    expect(sent).toEqual([])

    setNow(at(10, 0, 0))
    vi.advanceTimersByTime(TICK_INTERVAL_MS)
    expect(sent).toEqual(['Первый'])
    scheduler.stop()

    setNow(at(10, 0, 2))
    vi.advanceTimersByTime(TICK_INTERVAL_MS)
    expect(sent).toEqual(['Первый'])
  })
})
