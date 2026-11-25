import { Notification } from 'electron'

export const NOTIFICATION_TITLE = 'Daily Routine'
export const TEST_NOTIFICATION_BODY = 'Проверка уведомлений'

/**
 * Platform dispatch only. Scheduling, deduplication, and pause live in the Scheduler.
 * `silent: false` keeps the operating system's default notification sound (F-04).
 * `timeoutType: 'default'` lets the OS dismiss the toast (F-05).
 */
export class NotificationService {
  constructor(private readonly isSupported: () => boolean = () => Notification.isSupported()) {}

  send(body: string): boolean {
    if (!this.isSupported()) {
      console.error('[notifications] System notifications are not supported in this session')
      return false
    }

    const notification = new Notification({
      title: NOTIFICATION_TITLE,
      body,
      silent: false,
      timeoutType: 'default'
    })
    notification.show()
    return true
  }

  /** Fires one toast immediately, outside the schedule. Used to verify OS delivery. */
  sendTest(): boolean {
    return this.send(TEST_NOTIFICATION_BODY)
  }
}
