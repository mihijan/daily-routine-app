import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type TestNotificationResult } from '../shared/ipc-contracts'

const api = {
  testNotification: (): Promise<TestNotificationResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.testNotification)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (err) {
    console.error('[preload] contextBridge error:', err)
  }
}
