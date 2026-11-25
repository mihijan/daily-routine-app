import { describe, expect, it } from 'vitest'
import { DEFAULT_SCHEDULE } from '../../src/domain/defaultSchedule'
import {
  DAY_END_BLOCK_ID,
  DAY_END_TEXT,
  DAY_END_WARNING_TEXT,
  buildScheduleView,
  computeScheduleSnapshot,
  trayTooltip,
  getNotificationsDue,
  planNotifications
} from '../../src/domain/schedule'
import type { AppState, ScheduleBlock } from '../../src/shared/types'

function block(id: string, name: string, startTime: string, endTime: string): ScheduleBlock {
  return { id, name, startTime, endTime }
}

const TWO_BLOCKS = [
  block('one', 'Первый', '10:00', '11:00'),
  block('two', 'Второй', '11:00', '12:00')
]

const WEDNESDAY = new Date(2026, 10, 25, 12, 0, 0)
const SATURDAY = new Date(2026, 10, 28, 10, 30, 0)

describe('computeScheduleSnapshot', () => {
  it('reports before start, the active block, after end, and weekend', () => {
    expect(computeScheduleSnapshot(TWO_BLOCKS, new Date(2026, 10, 25, 9, 59, 59), false)).toEqual({
      phase: 'before-start',
      currentBlock: null,
      nextBlock: TWO_BLOCKS[0],
      paused: false
    })

    expect(
      computeScheduleSnapshot(TWO_BLOCKS, new Date(2026, 10, 25, 10, 0, 0), false)
    ).toMatchObject({
      phase: 'active',
      currentBlock: TWO_BLOCKS[0],
      nextBlock: TWO_BLOCKS[1]
    })

    expect(
      computeScheduleSnapshot(TWO_BLOCKS, new Date(2026, 10, 25, 11, 30, 0), true)
    ).toMatchObject({
      phase: 'active',
      currentBlock: TWO_BLOCKS[1],
      nextBlock: null,
      paused: true
    })

    expect(computeScheduleSnapshot(TWO_BLOCKS, new Date(2026, 10, 25, 12, 0, 0), false).phase).toBe(
      'after-end'
    )

    expect(computeScheduleSnapshot(TWO_BLOCKS, SATURDAY, false)).toEqual({
      phase: 'weekend',
      currentBlock: null,
      nextBlock: null,
      paused: false
    })
  })
})

describe('planNotifications', () => {
  it('plans the start, the two-minute warning, the next block, the closing warning, and the end', () => {
    const planned = planNotifications(TWO_BLOCKS, WEDNESDAY)

    expect(
      planned.map((notification) => [notification.body, notification.type, notification.blockId])
    ).toEqual([
      ['Первый', 'transition', 'one'],
      ['→ Второй', 'warning', 'one'],
      ['Второй', 'transition', 'two'],
      [DAY_END_WARNING_TEXT, 'warning', 'two'],
      [DAY_END_TEXT, 'transition', DAY_END_BLOCK_ID]
    ])

    expect(new Date(planned[1].at).getHours()).toBe(10)
    expect(new Date(planned[1].at).getMinutes()).toBe(58)
    expect(new Date(planned[4].at).getHours()).toBe(12)
    expect(new Date(planned[4].at).getMinutes()).toBe(0)
  })

  it('skips the warning when the block is shorter than two minutes', () => {
    const planned = planNotifications([block('short', 'Короткий', '10:00', '10:01')], WEDNESDAY)
    expect(planned.map((notification) => notification.type)).toEqual(['transition', 'transition'])
    expect(planned.map((notification) => notification.body)).toEqual(['Короткий', DAY_END_TEXT])
  })

  it('plans nothing on Saturday', () => {
    expect(planNotifications(TWO_BLOCKS, SATURDAY)).toEqual([])
    expect(planNotifications(DEFAULT_SCHEDULE, SATURDAY)).toEqual([])
  })

  it('covers every default block with a warning, a start, and one end-of-day signal', () => {
    const planned = planNotifications(DEFAULT_SCHEDULE, WEDNESDAY)
    expect(planned).toHaveLength(27)
    expect(planned[0]).toMatchObject({
      body: 'Слепая печать №1',
      type: 'transition',
      blockId: 'typing-1'
    })
    expect(planned[1]).toMatchObject({
      body: '→ Проект — разработка и архитектура',
      type: 'warning',
      blockId: 'typing-1'
    })
    expect(planned.at(-2)?.body).toBe(DAY_END_WARNING_TEXT)
    expect(planned.at(-1)?.body).toBe(DAY_END_TEXT)
  })
})

function appState(blocks: ScheduleBlock[], overrideBlocks?: ScheduleBlock[]): AppState {
  return {
    schemaVersion: 1,
    permanentSchedule: blocks,
    dailyOverride: overrideBlocks ? { date: '2026-11-25', blocks: overrideBlocks } : null,
    pauseState: { paused: false, pausedUntil: null },
    notificationLog: []
  }
}

describe('buildScheduleView', () => {
  it('counts down the active block and the rest of the day', () => {
    const view = buildScheduleView(appState(TWO_BLOCKS), new Date(2026, 10, 25, 10, 30, 0))
    expect(view.phase).toBe('active')
    expect(view.currentBlock?.id).toBe('one')
    expect(view.nextBlock?.id).toBe('two')
    expect(view.remainingSeconds).toBe(30 * 60)
    expect(view.progress).toBeCloseTo(0.5)
    expect(view.secondsUntilDayEnd).toBe(90 * 60)
    expect(view.dayStartTime).toBe('10:00')
    expect(view.dayEndTime).toBe('12:00')
  })

  it('counts down until the day starts and clears the timer after it ends', () => {
    const before = buildScheduleView(appState(TWO_BLOCKS), new Date(2026, 10, 25, 9, 0, 0))
    expect(before.phase).toBe('before-start')
    expect(before.remainingSeconds).toBeNull()
    expect(before.secondsUntilStart).toBe(60 * 60)

    const after = buildScheduleView(appState(TWO_BLOCKS), new Date(2026, 10, 25, 12, 0, 0))
    expect(after.phase).toBe('after-end')
    expect(after.remainingSeconds).toBeNull()
    expect(after.secondsUntilDayEnd).toBeNull()
  })

  it('uses the daily override and stays quiet on Saturday', () => {
    const override = [block('custom', 'Свой день', '12:00', '13:00')]
    const view = buildScheduleView(
      appState(TWO_BLOCKS, override),
      new Date(2026, 10, 25, 12, 15, 0)
    )
    expect(view.currentBlock?.name).toBe('Свой день')
    expect(view.effectiveSchedule).toEqual(override)

    const stale = buildScheduleView(
      {
        ...appState(TWO_BLOCKS),
        dailyOverride: { date: '2026-11-24', blocks: override }
      },
      new Date(2026, 10, 25, 11, 30, 0)
    )
    expect(stale.dailyOverride).toBeNull()
    expect(stale.currentBlock?.id).toBe('two')

    const weekend = buildScheduleView(appState(TWO_BLOCKS), SATURDAY)
    expect(weekend.phase).toBe('weekend')
    expect(weekend.currentBlock).toBeNull()
    expect(weekend.remainingSeconds).toBeNull()
  })
})

describe('trayTooltip', () => {
  it('names the active block and the time left, and the off-schedule states', () => {
    const active = buildScheduleView(appState(TWO_BLOCKS), new Date(2026, 10, 25, 10, 30, 0))
    expect(trayTooltip(active)).toBe('Первый — 30мин')

    const before = buildScheduleView(appState(TWO_BLOCKS), new Date(2026, 10, 25, 9, 0, 0))
    expect(trayTooltip(before)).toBe('День начнётся в 10:00')

    const after = buildScheduleView(appState(TWO_BLOCKS), new Date(2026, 10, 25, 12, 0, 0))
    expect(trayTooltip(after)).toBe('День завершён')

    const weekend = buildScheduleView(appState(TWO_BLOCKS), SATURDAY)
    expect(trayTooltip(weekend)).toBe('Выходной')

    expect(trayTooltip({ ...active, paused: true })).toBe('Пауза · Первый — 30мин')
  })
})

describe('getNotificationsDue', () => {
  it('includes an instant at the end of the window and excludes one at the start', () => {
    const warning = planNotifications(TWO_BLOCKS, WEDNESDAY)[1]
    expect(
      getNotificationsDue(TWO_BLOCKS, warning.at - 1000, warning.at).map((item) => item.body)
    ).toEqual(['→ Второй'])
    expect(getNotificationsDue(TWO_BLOCKS, warning.at, warning.at + 1000)).toEqual([])
  })

  it('returns both events when the window covers the warning and the next start', () => {
    const start = new Date(2026, 10, 25, 10, 57, 0).getTime()
    const end = new Date(2026, 10, 25, 11, 0, 0).getTime()
    expect(getNotificationsDue(TWO_BLOCKS, start, end).map((item) => item.body)).toEqual([
      '→ Второй',
      'Второй'
    ])
  })
})
