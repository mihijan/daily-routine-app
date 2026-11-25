// Shared data models used by Main, domain logic, and Renderer.

/** Local time of day, 24-hour `HH:mm`. */
export type TimeOfDay = string

/** Local calendar date, `YYYY-MM-DD`. No timezone suffix — the value is a local date. */
export type DateKey = string

/**
 * One contiguous block of the day.
 * `id` is stable for the lifetime of the block and will be part of the notification dedup key.
 */
export interface ScheduleBlock {
  id: string
  name: string
  startTime: TimeOfDay
  endTime: TimeOfDay
}

/**
 * Replacement schedule for a single local date.
 * It takes priority over the permanent schedule and is meaningless on any other date.
 */
export interface DailyOverride {
  date: DateKey
  blocks: ScheduleBlock[]
}

/**
 * Persisted pause flag.
 * When `paused` is true, notifications stay silent until the local date in `pausedUntil`.
 * That date is the next working day, chosen by domain logic when the pause is created.
 */
export interface PauseState {
  paused: boolean
  pausedUntil: DateKey | null
}

/** Matches the notification kinds from F-24: warning and transition. */
export type NotificationType = 'warning' | 'transition'

/**
 * One fired notification.
 * The dedup key is (date, blockId, type). Storage records entries; Scheduler decides when to append.
 */
export interface NotificationLogEntry {
  date: DateKey
  blockId: string
  type: NotificationType
  /** ISO-8601 timestamp of the moment the notification was recorded. */
  firedAt: string
}

/** Full persisted application state. `schemaVersion` is reserved for future migrations. */
export interface AppState {
  schemaVersion: number
  permanentSchedule: ScheduleBlock[]
  dailyOverride: DailyOverride | null
  pauseState: PauseState
  notificationLog: NotificationLogEntry[]
}

/** Where the user is relative to today's schedule. Weekend wins over the clock. */
export type SchedulePhase = 'before-start' | 'active' | 'after-end' | 'weekend'

/** Clock reading derived from the effective schedule. Tray and the main window can render this later. */
export interface ScheduleSnapshot {
  phase: SchedulePhase
  currentBlock: ScheduleBlock | null
  nextBlock: ScheduleBlock | null
  paused: boolean
}

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

/**
 * Everything the window renders. Built in the main process from the repository and the clock.
 * The renderer does not derive the phase, the active block, or the countdown on its own.
 */
export interface ScheduleViewState {
  phase: SchedulePhase
  paused: boolean
  pausedUntil: DateKey | null
  /** ISO timestamp of the clock reading this view was built from. */
  now: string
  dateKey: DateKey
  permanentSchedule: ScheduleBlock[]
  dailyOverride: DailyOverride | null
  effectiveSchedule: ScheduleBlock[]
  currentBlock: ScheduleBlock | null
  nextBlock: ScheduleBlock | null
  /** Whole seconds left in the current block. Null when no block is active. */
  remainingSeconds: number | null
  /** 0 at the block start, 1 at the block end. Null when no block is active. */
  progress: number | null
  secondsUntilStart: number | null
  secondsUntilDayEnd: number | null
  dayStartTime: TimeOfDay | null
  dayEndTime: TimeOfDay | null
}
