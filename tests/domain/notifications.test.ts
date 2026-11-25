import { describe, expect, it } from 'vitest'
import { DEFAULT_SCHEDULE } from '../../src/domain/defaultSchedule'
import {
  DAY_END_BLOCK_ID,
  DAY_END_TEXT,
  DAY_END_WARNING_TEXT,
  computeScheduleSnapshot,
  getNotificationsDue,
  planNotifications
} from '../../src/domain/schedule'
import type { ScheduleBlock } from '../../src/shared/types'

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
