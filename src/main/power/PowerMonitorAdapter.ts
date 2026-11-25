import { powerMonitor } from 'electron'

/** Subscribes to wake-from-sleep and forwards it. Contains no scheduling logic. */
export class PowerMonitorAdapter {
  private attached = false

  init(onResume: () => void): void {
    if (this.attached) return
    powerMonitor.on('resume', onResume)
    this.attached = true
  }
}
