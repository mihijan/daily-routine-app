import { describe, expect, it } from 'vitest'
import { prepareSchedule } from '../../src/domain/validation'
import type { ScheduleBlock } from '../../src/shared/types'

function block(id: string, name: string, startTime: string, endTime: string): ScheduleBlock {
  return { id, name, startTime, endTime }
}

function codes(blocks: readonly ScheduleBlock[]): string[] {
  const result = prepareSchedule(blocks)
  return result.ok ? [] : result.errors.map((error) => error.code)
}

describe('prepareSchedule', () => {
  it('accepts a single block and a contiguous sequence in any order', () => {
    const single = prepareSchedule([block('only', 'Один', '09:00', '10:00')])
    expect(single).toEqual({
      ok: true,
      blocks: [block('only', 'Один', '09:00', '10:00')]
    })

    const unsorted = prepareSchedule([
      block('second', 'Второй', '11:00', '12:00'),
      block('first', 'Первый', '10:00', '11:00')
    ])
    expect(unsorted.ok).toBe(true)
    if (!unsorted.ok) return
    expect(unsorted.blocks.map((item) => item.id)).toEqual(['first', 'second'])
  })

  it('trims the name and leaves the submitted array unchanged', () => {
    const input = [block('only', '  Алгоритмы  ', '10:00', '11:00')]
    const result = prepareSchedule(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.blocks[0].name).toBe('Алгоритмы')
    expect(input[0].name).toBe('  Алгоритмы  ')
  })

  it('rejects an empty schedule', () => {
    expect(codes([])).toEqual(['empty-schedule'])
  })

  it('rejects an empty or whitespace-only name', () => {
    expect(codes([block('only', '   ', '10:00', '11:00')])).toEqual(['empty-name'])
  })

  it('rejects an empty id and a duplicated id', () => {
    expect(codes([block('  ', 'Блок', '10:00', '11:00')])).toEqual(['empty-id'])
    expect(
      codes([block('same', 'Первый', '10:00', '11:00'), block('same', 'Второй', '11:00', '12:00')])
    ).toEqual(['duplicate-id'])
  })

  it('rejects a time that is not HH:mm and an interval that does not move forward', () => {
    expect(codes([block('only', 'Блок', '10:60', '11:00')])).toEqual(['invalid-time'])
    expect(codes([block('only', 'Блок', '24:00', '25:00')])).toEqual(['invalid-time'])
    expect(codes([block('only', 'Блок', '11:00', '10:00')])).toEqual(['invalid-interval'])
    expect(codes([block('only', 'Блок', '10:00', '10:00')])).toEqual(['invalid-interval'])
  })

  it('rejects a gap and an overlap, pointing at the later submitted block', () => {
    const gap = prepareSchedule([
      block('first', 'Первый', '10:00', '11:00'),
      block('second', 'Второй', '11:30', '12:00')
    ])
    expect(gap.ok).toBe(false)
    if (gap.ok) return
    expect(gap.errors).toEqual([expect.objectContaining({ code: 'gap', blockIndex: 1 })])

    const overlap = prepareSchedule([
      block('first', 'Первый', '10:00', '12:00'),
      block('second', 'Второй', '11:00', '13:00')
    ])
    expect(overlap.ok).toBe(false)
    if (overlap.ok) return
    expect(overlap.errors).toEqual([expect.objectContaining({ code: 'overlap', blockIndex: 1 })])
  })

  it('reports a name error and a gap together when every interval is real', () => {
    expect(
      codes([block('first', '   ', '10:00', '11:00'), block('second', 'Второй', '11:30', '12:00')])
    ).toEqual(['empty-name', 'gap'])
  })

  it('does not invent a gap when a block time is already invalid', () => {
    expect(
      codes([
        block('first', 'Первый', '10:00', '11:00'),
        block('second', 'Второй', 'nope', '12:00')
      ])
    ).toEqual(['invalid-time'])
  })
})
