import { describe, expect, it } from 'vitest'
import {
  isWeekend,
  nextWorkingDay,
  pruneNotificationLog,
  resolvePauseState
} from '../../src/domain/time'
import type { NotificationLogEntry } from '../../src/shared/types'

describe('working days and pause', () => {
  it('treats Saturday and Sunday as weekend', () => {
    expect(isWeekend(new Date(2026, 10, 28, 10, 0, 0))).toBe(true)
    expect(isWeekend(new Date(2026, 10, 29, 10, 0, 0))).toBe(true)
    expect(isWeekend(new Date(2026, 10, 25, 10, 0, 0))).toBe(false)
  })

  it('picks the next Monday when the next calendar day is a weekend', () => {
    expect(nextWorkingDay(new Date(2026, 10, 25, 21, 0, 0))).toBe('2026-11-26')
    expect(nextWorkingDay(new Date(2026, 10, 27, 12, 0, 0))).toBe('2026-11-30')
    expect(nextWorkingDay(new Date(2026, 10, 28, 12, 0, 0))).toBe('2026-11-30')
    expect(nextWorkingDay(new Date(2026, 10, 29, 12, 0, 0))).toBe('2026-11-30')
  })

  it('keeps a pause active only before the stored working day', () => {
    const pause = { paused: true, pausedUntil: '2026-11-26' }
    expect(resolvePauseState(pause, new Date(2026, 10, 25, 23, 59, 0)).paused).toBe(true)
    expect(resolvePauseState(pause, new Date(2026, 10, 26, 0, 0, 0))).toEqual({
      paused: false,
      pausedUntil: null
    })
  })
})

describe('pruneNotificationLog', () => {
  it('keeps yesterday and today', () => {
    const entries: NotificationLogEntry[] = [
      {
        date: '2026-11-23',
        blockId: 'old',
        type: 'warning',
        firedAt: '2026-11-23T08:00:00.000Z'
      },
      {
        date: '2026-11-24',
        blockId: 'yesterday',
        type: 'transition',
        firedAt: '2026-11-24T08:00:00.000Z'
      }
    ]

    expect(
      pruneNotificationLog(entries, new Date(2026, 10, 25, 10, 0, 0)).map((entry) => entry.blockId)
    ).toEqual(['yesterday'])
  })
})
