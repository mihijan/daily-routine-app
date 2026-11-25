import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-contracts'
import type { DailyRoutineApi } from '../shared/ipc-contracts'
import type { ScheduleViewState } from '../shared/types'

const api: DailyRoutineApi = {
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.getState),
  onState: (listener) => {
    const wrapped = (_event: IpcRendererEvent, state: ScheduleViewState): void => {
      listener(state)
    }
    ipcRenderer.on(IPC_CHANNELS.state, wrapped)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.state, wrapped)
    }
  },
  savePermanentSchedule: (blocks) => ipcRenderer.invoke(IPC_CHANNELS.savePermanentSchedule, blocks),
  saveDailyOverride: (blocks) => ipcRenderer.invoke(IPC_CHANNELS.saveDailyOverride, blocks),
  resetDailyOverride: () => ipcRenderer.invoke(IPC_CHANNELS.resetDailyOverride),
  pauseNotifications: () => ipcRenderer.invoke(IPC_CHANNELS.pauseNotifications),
  resumeNotifications: () => ipcRenderer.invoke(IPC_CHANNELS.resumeNotifications),
  quit: () => ipcRenderer.invoke(IPC_CHANNELS.quit),
  testNotification: () => ipcRenderer.invoke(IPC_CHANNELS.testNotification)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (err) {
    console.error('[preload] contextBridge error:', err)
  }
}

window.addEventListener('unload', () => {
  ipcRenderer.removeAllListeners(IPC_CHANNELS.state)
})
