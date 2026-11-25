import { app } from 'electron'

/** Windows is the only platform that should register a login item. */
export function supportsAutostart(): boolean {
  return process.platform === 'win32'
}

/**
 * Align the OS login item with the stored preference.
 * A packaged build launches the installed executable. An unpackaged build must pass the app path,
 * otherwise Windows would start a bare Electron process.
 */
export function applyAutostart(enabled: boolean): void {
  if (!supportsAutostart()) return

  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: enabled })
    return
  }

  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: [app.getAppPath()]
  })
}
