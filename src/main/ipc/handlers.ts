import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS, type TestNotificationResult } from '../../shared/ipc-contracts'

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url
  if (!url) return false

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl && url.startsWith(devServerUrl)) return true
  return url.startsWith('file://')
}

/**
 * Registers the manual notification check.
 * Schedule save handlers are added with the editor. After each successful save they must call
 * `scheduler.reconcile()` so notifications already in the past are not replayed.
 */
export function registerIpcHandlers(options: { sendTestNotification: () => boolean }): void {
  ipcMain.handle(IPC_CHANNELS.testNotification, (event): TestNotificationResult => {
    if (!isTrustedSender(event)) {
      throw new Error('Rejected notification test from an unexpected sender')
    }
    return { delivered: options.sendTestNotification() }
  })
}
