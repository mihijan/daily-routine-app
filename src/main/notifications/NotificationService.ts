// NotificationService — platform-level Windows toast dispatch.
// Single responsibility: send a notification. No scheduling, dedup, or pause logic.
// Will be implemented during Scheduler Design.

export class NotificationService {
  send(_title: string, _body: string): void {
    // TODO: dispatch Windows toast notification via Electron Notification API
  }
}
