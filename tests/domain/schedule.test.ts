import { describe, expect, it } from 'vitest'
import { DEFAULT_SCHEDULE } from '../../src/domain/defaultSchedule'
import { resolveEffectiveSchedule } from '../../src/domain/schedule'
import { toDateKey } from '../../src/domain/time'
import { prepareSchedule } from '../../src/domain/validation'
import type { ScheduleBlock } from '../../src/shared/types'

const EXPECTED_BLOCKS: ReadonlyArray<readonly [string, string, string]> = [
  ['10:00', '10:10', 'Слепая печать №1'],
  ['10:10', '12:10', 'Проект — разработка и архитектура'],
  ['12:10', '12:25', 'Перерыв — 15 минут'],
  ['12:25', '14:25', 'Проект — реализация, тестирование'],
  ['14:25', '15:10', 'Обед — 45 минут'],
  ['15:10', '15:20', 'Слепая печать №2'],
  ['15:20', '16:50', 'Алгоритмы'],
  ['16:50', '17:10', 'Прогулка / отдых'],
  ['17:10', '18:40', 'Технические компетенции'],
  ['18:40', '19:10', 'Ужин / отдых'],
  ['19:10', '20:40', 'Английский'],
  ['20:40', '20:50', 'Слепая печать №3'],
  ['20:50', '21:00', 'Итоги дня, план на завтра']
]

function block(id: string, name: string, startTime: string, endTime: string): ScheduleBlock {
  return { id, name, startTime, endTime }
}

describe('default schedule', () => {
  it('matches the agreed 13-block study day and is itself valid', () => {
    expect(DEFAULT_SCHEDULE).toHaveLength(13)
    expect(DEFAULT_SCHEDULE.map((item) => [item.startTime, item.endTime, item.name])).toEqual(
      EXPECTED_BLOCKS
    )

    const prepared = prepareSchedule(DEFAULT_SCHEDULE)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.blocks).toEqual(DEFAULT_SCHEDULE.map((item) => ({ ...item })))
  })
})

describe('resolveEffectiveSchedule', () => {
  const permanent = [block('base', 'Базовый', '10:00', '11:00')]
  const overrideBlocks = [block('today', 'Сегодня', '12:00', '13:00')]

  it('returns the permanent schedule when there is no override', () => {
    expect(resolveEffectiveSchedule(permanent, null, '2026-11-25')).toEqual(permanent)
  })

  it('returns the override only for its own date', () => {
    const override = { date: '2026-11-25', blocks: overrideBlocks }
    expect(resolveEffectiveSchedule(permanent, override, '2026-11-25')).toEqual(overrideBlocks)
    expect(resolveEffectiveSchedule(permanent, override, '2026-11-26')).toEqual(permanent)
  })

  it('does not share the returned array with the stored schedule', () => {
    const result = resolveEffectiveSchedule(permanent, null, '2026-11-25')
    result[0].name = 'Изменено'
    expect(permanent[0].name).toBe('Базовый')
  })
})

describe('toDateKey', () => {
  it('uses local calendar fields', () => {
    expect(toDateKey(new Date(2026, 10, 25, 23, 30))).toBe('2026-11-25')
  })
})
