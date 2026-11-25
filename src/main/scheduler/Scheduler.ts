import {
  computeScheduleSnapshot,
  getNotificationsDue,
  hasNotificationFired,
  notificationKey,
  resolveEffectiveSchedule
} from '../../domain/schedule'
import { resolvePauseState, toDateKey } from '../../domain/time'
import type { AppState, NotificationLogEntry, ScheduleSnapshot } from '../../shared/types'

export const TICK_INTERVAL_MS = 1000

/**
 * A gap longer than this is a sleep, a stall, or a clock change.
 * Notifications inside that gap are missed and are not fired.
 * A normal 1-second tick, including a few seconds of timer drift, still delivers.
 */
export const CLOCK_DISCONTINUITY_MS = 5000

export interface SchedulerDependencies {
  /** In-memory state already resolved for `now` (override, pause, and log retention). */
  getState: (now: Date) => AppState
  sendNotification: (body: string) => void
  markFired: (entry: NotificationLogEntry) => void
  onStateChange?: (snapshot: ScheduleSnapshot) => void
  now?: () => Date
}

/**
 * Polls local time once a second and decides whether a notification is due.
 * `reconcile()` moves the reference point to now without firing anything. Call it on startup,
 * resume from sleep, a system-clock jump, and after a schedule or pause change.
 */
export class Scheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private isTickRunning = false
  private lastObservedAt: number | null = null
  private readonly now: () => Date

  constructor(private readonly dependencies: SchedulerDependencies) {
    this.now = dependencies.now ?? ((): Date => new Date())
  }

  start(): void {
    if (this.timer) return
    this.reconcile()
    this.timer = setInterval(() => {
      this.tick()
    }, TICK_INTERVAL_MS)
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  reconcile(): void {
    const now = this.now()
    this.lastObservedAt = now.getTime()
    this.publish(now)
  }

  tick(): void {
    if (this.isTickRunning) return
    this.isTickRunning = true
    try {
      const now = this.now()
      const nowMs = now.getTime()
      const previous = this.lastObservedAt
      const elapsed = previous === null ? Number.POSITIVE_INFINITY : nowMs - previous

      if (previous === null || elapsed < 0 || elapsed > CLOCK_DISCONTINUITY_MS) {
        this.reconcile()
        return
      }

      const state = this.dependencies.getState(now)
      const pause = resolvePauseState(state.pauseState, now)
      if (!pause.paused) {
        const blocks = resolveEffectiveSchedule(
          state.permanentSchedule,
          state.dailyOverride,
          toDateKey(now)
        )
        const due = getNotificationsDue(blocks, previous, nowMs)
        const firedThisTick = new Set<string>()
        for (const notification of due) {
          const key = notificationKey(notification)
          if (firedThisTick.has(key) || hasNotificationFired(state.notificationLog, notification)) {
            continue
          }
          this.dependencies.sendNotification(notification.body)
          this.dependencies.markFired({
            date: notification.date,
            blockId: notification.blockId,
            type: notification.type,
            firedAt: now.toISOString()
          })
          firedThisTick.add(key)
        }
      }

      this.lastObservedAt = nowMs
    } finally {
      this.isTickRunning = false
    }
  }

  private publish(now: Date): void {
    if (!this.dependencies.onStateChange) return
    const state = this.dependencies.getState(now)
    const pause = resolvePauseState(state.pauseState, now)
    const blocks = resolveEffectiveSchedule(
      state.permanentSchedule,
      state.dailyOverride,
      toDateKey(now)
    )
    this.dependencies.onStateChange(computeScheduleSnapshot(blocks, now, pause.paused))
  }
}
