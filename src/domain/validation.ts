import type { ScheduleBlock } from '../shared/types'
import { formatMinutes, parseTimeToMinutes } from './time'

export type ScheduleValidationCode =
  | 'invalid-schedule'
  | 'empty-schedule'
  | 'invalid-block'
  | 'empty-id'
  | 'duplicate-id'
  | 'empty-name'
  | 'invalid-time'
  | 'invalid-interval'
  | 'gap'
  | 'overlap'

export interface ScheduleValidationError {
  code: ScheduleValidationCode
  message: string
  /** Index of the offending block in the schedule that was submitted. */
  blockIndex?: number
}

export type PrepareScheduleResult =
  { ok: true; blocks: ScheduleBlock[] } | { ok: false; errors: ScheduleValidationError[] }

interface ParsedBlock {
  index: number
  id: string
  name: string
  start: number
  end: number
}

function isScheduleBlock(value: unknown): value is ScheduleBlock {
  if (typeof value !== 'object' || value === null) return false
  const block = value as ScheduleBlock
  return (
    typeof block.id === 'string' &&
    typeof block.name === 'string' &&
    typeof block.startTime === 'string' &&
    typeof block.endTime === 'string'
  )
}

/**
 * Validate a schedule and return it in canonical form.
 * Blocks must be contiguous, non-overlapping, and use a real `HH:mm` interval.
 * Input order does not matter: a valid schedule is returned sorted by start time.
 * The input array is not mutated. Nothing is persisted here.
 */
export function prepareSchedule(blocks: readonly ScheduleBlock[]): PrepareScheduleResult {
  if (!Array.isArray(blocks)) {
    return {
      ok: false,
      errors: [{ code: 'invalid-schedule', message: 'Schedule must be an array of blocks' }]
    }
  }

  if (blocks.length === 0) {
    return {
      ok: false,
      errors: [{ code: 'empty-schedule', message: 'Schedule must contain at least one block' }]
    }
  }

  const errors: ScheduleValidationError[] = []
  const parsed: ParsedBlock[] = []
  const seenIds = new Set<string>()

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    if (!isScheduleBlock(block)) {
      errors.push({
        code: 'invalid-block',
        message: 'Block must have string id, name, startTime, and endTime',
        blockIndex: index
      })
      continue
    }

    const id = block.id.trim()
    const name = block.name.trim()

    if (id.length === 0) {
      errors.push({ code: 'empty-id', message: 'Block id must not be empty', blockIndex: index })
    } else if (seenIds.has(id)) {
      errors.push({
        code: 'duplicate-id',
        message: `Duplicate block id "${id}"`,
        blockIndex: index
      })
    } else {
      seenIds.add(id)
    }

    if (name.length === 0) {
      errors.push({
        code: 'empty-name',
        message: 'Block name must not be empty',
        blockIndex: index
      })
    }

    const start = parseTimeToMinutes(block.startTime)
    const end = parseTimeToMinutes(block.endTime)
    if (start === null || end === null) {
      errors.push({
        code: 'invalid-time',
        message: 'Block times must use HH:mm in the range 00:00–23:59',
        blockIndex: index
      })
      continue
    }

    if (start >= end) {
      errors.push({
        code: 'invalid-interval',
        message: 'Block end time must be later than start time',
        blockIndex: index
      })
      continue
    }

    parsed.push({ index, id, name, start, end })
  }

  // Continuity is only meaningful once every block has a real positive interval.
  const ordered =
    parsed.length === blocks.length
      ? [...parsed].sort((left, right) => left.start - right.start || left.end - right.end)
      : null

  if (ordered) {
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1]
      const current = ordered[index]

      if (current.start > previous.end) {
        errors.push({
          code: 'gap',
          message: `Gap between ${formatMinutes(previous.end)} and ${formatMinutes(current.start)}`,
          blockIndex: current.index
        })
      } else if (current.start < previous.end) {
        errors.push({
          code: 'overlap',
          message: `Overlap between ${formatMinutes(previous.end)} and ${formatMinutes(current.start)}`,
          blockIndex: current.index
        })
      }
    }
  }

  if (errors.length > 0 || !ordered) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    blocks: ordered.map((block) => ({
      id: block.id,
      name: block.name,
      startTime: formatMinutes(block.start),
      endTime: formatMinutes(block.end)
    }))
  }
}
