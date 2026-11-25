// Local date and time-of-day helpers. No timezone conversion: the schedule follows the system clock.
import type { NotificationLogEntry, PauseState } from '../shared/types'

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parse `HH:mm` into minutes from midnight. Returns null when the text is not a real time of day. */
export function parseTimeToMinutes(value: string): number | null {
  const match = TIME_OF_DAY_PATTERN.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/** Format minutes from midnight as `HH:mm`. */
export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** Local calendar date of `date` as `YYYY-MM-DD`. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** True only for a real local calendar date written as `YYYY-MM-DD`. */
export function isDateKey(value: string): boolean {
  const match = DATE_KEY_PATTERN.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** Saturday or Sunday in the local calendar. */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

/** Local date key shifted by a number of calendar days. Does not use UTC. */
export function shiftDateKey(date: Date, days: number): string {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  shifted.setDate(shifted.getDate() + days)
  return toDateKey(shifted)
}

/**
 * The next Mon–Fri after `from`.
 * Pause always lasts at least until tomorrow, then skips Saturday and Sunday.
 */
export function nextWorkingDay(from: Date): string {
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  do {
    cursor.setDate(cursor.getDate() + 1)
  } while (isWeekend(cursor))
  return toDateKey(cursor)
}

/** Pause flag that stays silent until the start of the next working day. */
export function pauseUntilNextWorkingDay(from: Date): PauseState {
  return { paused: true, pausedUntil: nextWorkingDay(from) }
}

/**
 * Pause is active only before `pausedUntil`.
 * On that local date, from 00:00, notifications are allowed again.
 */
export function resolvePauseState(pause: PauseState, now: Date): PauseState {
  if (!pause.paused || pause.pausedUntil === null) {
    return { paused: false, pausedUntil: null }
  }
  if (toDateKey(now) >= pause.pausedUntil) {
    return { paused: false, pausedUntil: null }
  }
  return { paused: true, pausedUntil: pause.pausedUntil }
}

/** Drop dedup entries older than yesterday. Today's key cannot collide with those dates. */
export function pruneNotificationLog(
  entries: readonly NotificationLogEntry[],
  now: Date
): NotificationLogEntry[] {
  const earliest = shiftDateKey(now, -1)
  return entries.filter((entry) => entry.date >= earliest).map((entry) => ({ ...entry }))
}
