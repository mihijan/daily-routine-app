// WindowManager — lazy BrowserWindow lifecycle.
// Creates the window on first open, hides it on × (not destroys),
// shows it again on tray click. Respects isQuitting flag.
// Will be implemented during Bootstrap task.

export class WindowManager {
  show(): void {
    // TODO: create BrowserWindow lazily if null, then show + focus
  }

  hide(): void {
    // TODO: hide window (window.hide())
  }

  pushState(_state: unknown): void {
    // TODO: webContents.send(channel, state) if window is open
  }
}
