// TrayManager — system tray icon, tooltip, and context menu.
// Receives computed state via callback from Scheduler's onStateChange.
// Will be implemented during Bootstrap task.

export class TrayManager {
  init(): void {
    // TODO: create Tray icon, set up context menu (Open / Quit)
  }

  updateState(_label: string): void {
    // TODO: update tray tooltip with current block name + remaining time
  }
}
