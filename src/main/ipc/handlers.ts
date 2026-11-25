import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { PrepareScheduleResult, ScheduleBlock, ScheduleViewState } from '../../shared/types'
import { IPC_CHANNELS, type TestNotificationResult } from '../../shared/ipc-contracts'

export interface IpcDependencies {
  getViewState: () => ScheduleViewState
  savePermanentSchedule: (blocks: readonly ScheduleBlock[]) => PrepareScheduleResult
  saveDailyOverride: (blocks: readonly ScheduleBlock[]) => PrepareScheduleResult
  resetDailyOverride: () => void
  pauseNotifications: () => void
  resumeNotifications: () => void
  quit: () => void
  sendTestNotification: () => boolean
}

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url
  if (!url) return false

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl && url.startsWith(devServerUrl)) return true
  return url.startsWith('file://')
}

function assertTrusted(event: IpcMainInvokeEvent): void {
  if (!isTrustedSender(event)) {
    throw new Error('Rejected IPC message from an unexpected sender')
  }
}

function invalidSchedule(): PrepareScheduleResult {
  return {
    ok: false,
    errors: [{ code: 'invalid-schedule', message: 'Schedule must be an array of blocks' }]
  }
}

/**
 * Renderer entry points. Mutations are validated by AppStateRepository.
 * The caller reconciles the scheduler after a successful write.
 */
export function registerIpcHandlers(options: IpcDependencies): void {
  ipcMain.handle(IPC_CHANNELS.getState, (event): ScheduleViewState => {
    assertTrusted(event)
    return options.getViewState()
  })

  ipcMain.handle(
    IPC_CHANNELS.savePermanentSchedule,
    (event, blocks: unknown): PrepareScheduleResult => {
      assertTrusted(event)
      if (!Array.isArray(blocks)) return invalidSchedule()
      return options.savePermanentSchedule(blocks as ScheduleBlock[])
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.saveDailyOverride,
    (event, blocks: unknown): PrepareScheduleResult => {
      assertTrusted(event)
      if (!Array.isArray(blocks)) return invalidSchedule()
      return options.saveDailyOverride(blocks as ScheduleBlock[])
    }
  )

  ipcMain.handle(IPC_CHANNELS.resetDailyOverride, (event): void => {
    assertTrusted(event)
    options.resetDailyOverride()
  })

  ipcMain.handle(IPC_CHANNELS.pauseNotifications, (event): void => {
    assertTrusted(event)
    options.pauseNotifications()
  })

  ipcMain.handle(IPC_CHANNELS.resumeNotifications, (event): void => {
    assertTrusted(event)
    options.resumeNotifications()
  })

  ipcMain.handle(IPC_CHANNELS.quit, (event): void => {
    assertTrusted(event)
    options.quit()
  })

  ipcMain.handle(IPC_CHANNELS.testNotification, (event): TestNotificationResult => {
    assertTrusted(event)
    return { delivered: options.sendTestNotification() }
  })
}
