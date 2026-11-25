import { powerMonitor } from 'electron'

/**
 * Subscribes to wake-from-sleep and forwards it.
 * The callback must be `scheduler.reconcile()`: that moves the reference point to now
 * and does not replay notifications that were due while the machine was asleep.
 */
export class PowerMonitorAdapter {
  private attached = false

  init(onResume: () => void): void {
    if (this.attached) return
    powerMonitor.on('resume', onResume)
    this.attached = true
  }
}
