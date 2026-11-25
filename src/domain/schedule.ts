import type {
  AppState,
  DailyOverride,
  NotificationLogEntry,
  NotificationType,
  ScheduleBlock,
  ScheduleSnapshot,
  ScheduleViewState
} from '../shared/types'
import { isWeekend, parseTimeToMinutes, resolvePauseState, toDateKey } from './time'

/** Lead time for the warning that a block is about to end (F-01). */
export const WARNING_LEAD_MINUTES = 2

/**
 * Dedup id for the end-of-day notification.
 * The last block already uses its own id for the transition at its start, so the final
 * notification cannot reuse that pair of (blockId, 'transition').
 */
export const DAY_END_BLOCK_ID = 'day-end'

export const DAY_END_WARNING_TEXT = 'Учебный день заканчивается через 2 минуты'
export const DAY_END_TEXT = 'Учебный день завершён! Время отдыхать'

export interface PlannedNotification {
  date: string
  blockId: string
  type: NotificationType
  body: string
  /** Local timestamp in milliseconds. */
  at: number
}

function cloneBlocks(blocks: readonly ScheduleBlock[]): ScheduleBlock[] {
  return blocks.map((block) => ({ ...block }))
}

function orderedBlocks(blocks: readonly ScheduleBlock[]): ScheduleBlock[] {
  return [...blocks].sort((left, right) => {
    const leftStart = parseTimeToMinutes(left.startTime) ?? Number.MAX_SAFE_INTEGER
    const rightStart = parseTimeToMinutes(right.startTime) ?? Number.MAX_SAFE_INTEGER
    return leftStart - rightStart
  })
}

function atMinutes(day: Date, minutes: number): number {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0
  ).getTime()
}

/**
 * Daily override wins only when its date is the local date being resolved.
 * A missing override, or one stored for another date, leaves the permanent schedule in effect.
 * This function does not delete the stored override — the repository does that when it expires.
 */
export function resolveEffectiveSchedule(
  permanentSchedule: readonly ScheduleBlock[],
  dailyOverride: DailyOverride | null,
  today: string
): ScheduleBlock[] {
  if (dailyOverride && dailyOverride.date === today) {
    return cloneBlocks(dailyOverride.blocks)
  }
  return cloneBlocks(permanentSchedule)
}

/** Current block contains `now` (`start` inclusive, `end` exclusive). Next block is the first later start. */
export function locateSchedule(
  blocks: readonly ScheduleBlock[],
  now: Date
): { currentBlock: ScheduleBlock | null; nextBlock: ScheduleBlock | null } {
  const instant = now.getTime()
  let currentBlock: ScheduleBlock | null = null
  let nextBlock: ScheduleBlock | null = null

  for (const block of orderedBlocks(blocks)) {
    const startMinutes = parseTimeToMinutes(block.startTime)
    const endMinutes = parseTimeToMinutes(block.endTime)
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) continue

    const start = atMinutes(now, startMinutes)
    const end = atMinutes(now, endMinutes)
    if (instant >= start && instant < end) currentBlock = { ...block }
    if (!nextBlock && start > instant) nextBlock = { ...block }
  }

  return { currentBlock, nextBlock }
}

/** Before Start, Active, After End, or Weekend. Weekend does not expose a current block. */
export function computeScheduleSnapshot(
  blocks: readonly ScheduleBlock[],
  now: Date,
  paused: boolean
): ScheduleSnapshot {
  if (isWeekend(now)) {
    return { phase: 'weekend', currentBlock: null, nextBlock: null, paused }
  }

  const schedule = orderedBlocks(blocks)
  const located = locateSchedule(schedule, now)
  if (schedule.length === 0) {
    return { phase: 'before-start', currentBlock: null, nextBlock: null, paused }
  }

  const firstStart = parseTimeToMinutes(schedule[0].startTime)
  const lastEnd = parseTimeToMinutes(schedule[schedule.length - 1].endTime)
  if (firstStart === null || lastEnd === null) {
    return { phase: 'before-start', currentBlock: null, nextBlock: located.nextBlock, paused }
  }

  const instant = now.getTime()
  if (instant < atMinutes(now, firstStart)) {
    return { phase: 'before-start', currentBlock: null, nextBlock: located.nextBlock, paused }
  }
  if (instant >= atMinutes(now, lastEnd)) {
    return { phase: 'after-end', currentBlock: null, nextBlock: null, paused }
  }

  return {
    phase: 'active',
    currentBlock: located.currentBlock,
    nextBlock: located.nextBlock,
    paused
  }
}

function wholeSecondsUntil(targetMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((targetMs - nowMs) / 1000))
}

/** View model for the window. Countdown values come from `now`, not from the renderer clock. */
export function buildScheduleView(state: AppState, now: Date): ScheduleViewState {
  const pause = resolvePauseState(state.pauseState, now)
  const today = toDateKey(now)
  const activeOverride = state.dailyOverride?.date === today ? state.dailyOverride : null
  const effectiveSchedule = resolveEffectiveSchedule(state.permanentSchedule, activeOverride, today)
  const snapshot = computeScheduleSnapshot(effectiveSchedule, now, pause.paused)
  const schedule = orderedBlocks(effectiveSchedule)
  const first = schedule[0]
  const last = schedule[schedule.length - 1]
  const firstStart = first ? parseTimeToMinutes(first.startTime) : null
  const lastEnd = last ? parseTimeToMinutes(last.endTime) : null
  const nowMs = now.getTime()

  let remainingSeconds: number | null = null
  let progress: number | null = null
  if (snapshot.currentBlock) {
    const startMinutes = parseTimeToMinutes(snapshot.currentBlock.startTime)
    const endMinutes = parseTimeToMinutes(snapshot.currentBlock.endTime)
    if (startMinutes !== null && endMinutes !== null && endMinutes > startMinutes) {
      const start = atMinutes(now, startMinutes)
      const end = atMinutes(now, endMinutes)
      const duration = end - start
      remainingSeconds = wholeSecondsUntil(end, nowMs)
      progress = Math.min(1, Math.max(0, (nowMs - start) / duration))
    }
  }

  const secondsUntilStart =
    snapshot.phase === 'before-start' && firstStart !== null
      ? wholeSecondsUntil(atMinutes(now, firstStart), nowMs)
      : null
  const secondsUntilDayEnd =
    (snapshot.phase === 'before-start' || snapshot.phase === 'active') && lastEnd !== null
      ? wholeSecondsUntil(atMinutes(now, lastEnd), nowMs)
      : null

  return {
    phase: snapshot.phase,
    paused: pause.paused,
    pausedUntil: pause.pausedUntil,
    now: now.toISOString(),
    dateKey: today,
    permanentSchedule: state.permanentSchedule.map((block) => ({ ...block })),
    dailyOverride: activeOverride
      ? {
          date: activeOverride.date,
          blocks: activeOverride.blocks.map((block) => ({ ...block }))
        }
      : null,
    effectiveSchedule,
    currentBlock: snapshot.currentBlock,
    nextBlock: snapshot.nextBlock,
    remainingSeconds,
    progress,
    secondsUntilStart,
    secondsUntilDayEnd,
    dayStartTime: first?.startTime ?? null,
    dayEndTime: last?.endTime ?? null
  }
}

function formatTrayDuration(totalSeconds: number): string {
  const minutes = Math.max(0, Math.ceil(totalSeconds / 60))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours > 0 && rest > 0) return `${hours}ч ${rest}мин`
  if (hours > 0) return `${hours}ч`
  return `${minutes}мин`
}

/** Tray tooltip. Windows limits this to 128 characters; these phrases stay well under that. */
export function trayTooltip(view: ScheduleViewState): string {
  const withPause = (text: string): string => (view.paused ? `Пауза · ${text}` : text)

  if (view.phase === 'weekend') return withPause('Выходной')
  if (view.phase === 'after-end') return withPause('День завершён')
  if (view.phase === 'before-start') {
    return withPause(
      view.dayStartTime ? `День начнётся в ${view.dayStartTime}` : 'День ещё не начался'
    )
  }

  const name = view.currentBlock?.name ?? 'Daily Routine'
  const remaining =
    view.remainingSeconds === null ? '' : ` — ${formatTrayDuration(view.remainingSeconds)}`
  return withPause(`${name}${remaining}`)
}

/**
 * Every notification a weekday schedule would produce.
 * A block shorter than the warning lead has no warning: it would fall on or before the block start.
 * Weekends produce nothing.
 */
export function planNotifications(
  blocks: readonly ScheduleBlock[],
  day: Date
): PlannedNotification[] {
  if (isWeekend(day)) return []

  const schedule = orderedBlocks(blocks)
  const date = toDateKey(day)
  const planned: PlannedNotification[] = []

  for (let index = 0; index < schedule.length; index += 1) {
    const block = schedule[index]
    const start = parseTimeToMinutes(block.startTime)
    const end = parseTimeToMinutes(block.endTime)
    if (start === null || end === null || start >= end) continue

    planned.push({
      date,
      blockId: block.id,
      type: 'transition',
      body: block.name,
      at: atMinutes(day, start)
    })

    const warningAt = end - WARNING_LEAD_MINUTES
    if (warningAt > start) {
      const next = schedule[index + 1]
      planned.push({
        date,
        blockId: block.id,
        type: 'warning',
        body: next ? `→ ${next.name}` : DAY_END_WARNING_TEXT,
        at: atMinutes(day, warningAt)
      })
    }

    if (index === schedule.length - 1) {
      planned.push({
        date,
        blockId: DAY_END_BLOCK_ID,
        type: 'transition',
        body: DAY_END_TEXT,
        at: atMinutes(day, end)
      })
    }
  }

  planned.sort((left, right) => left.at - right.at)
  return planned
}

/**
 * Notifications whose local instant is inside `(windowStartMs, windowEndMs]`.
 * Callers keep the window about one second long. A restart or a clock jump moves the start
 * up to "now", so earlier instants are never selected.
 */
export function getNotificationsDue(
  blocks: readonly ScheduleBlock[],
  windowStartMs: number,
  windowEndMs: number
): PlannedNotification[] {
  if (windowEndMs <= windowStartMs) return []

  const startDay = new Date(windowStartMs)
  const endDay = new Date(windowEndMs)
  const planned =
    toDateKey(startDay) === toDateKey(endDay)
      ? planNotifications(blocks, endDay)
      : [...planNotifications(blocks, startDay), ...planNotifications(blocks, endDay)]

  return planned.filter(
    (notification) => notification.at > windowStartMs && notification.at <= windowEndMs
  )
}

export function notificationKey(entry: {
  date: string
  blockId: string
  type: NotificationType
}): string {
  return `${entry.date}|${entry.blockId}|${entry.type}`
}

export function hasNotificationFired(
  log: readonly NotificationLogEntry[],
  notification: { date: string; blockId: string; type: NotificationType }
): boolean {
  return log.some(
    (entry) =>
      entry.date === notification.date &&
      entry.blockId === notification.blockId &&
      entry.type === notification.type
  )
}
