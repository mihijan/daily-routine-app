// PowerMonitorAdapter — thin wrapper over Electron's powerMonitor.
// Subscribes to 'resume' event and triggers Scheduler.reconcile() immediately.
// Will be implemented during Bootstrap task.

export class PowerMonitorAdapter {
  init(_onResume: () => void): void {
    // TODO: powerMonitor.on('resume', onResume)
  }
}
