import { app } from 'electron'
import { electronApp } from '@electron-toolkit/utils'
import { buildScheduleView } from '../domain/schedule'
import { registerIpcHandlers } from './ipc/handlers'
import { NotificationService } from './notifications/NotificationService'
import { PowerMonitorAdapter } from './power/PowerMonitorAdapter'
import { Scheduler } from './scheduler/Scheduler'
import { applyAutostart } from './startup/Autostart'
import { AppStateRepository } from './store/AppStateRepository'
import { TrayManager } from './tray/TrayManager'
import { WindowManager } from './window/WindowManager'

/** Matches electron-builder.yml appId. In dev the toolkit uses the Electron executable instead. */
const APP_USER_MODEL_ID = 'com.dailyroutine.app'

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  const windowManager = new WindowManager()
  const tray = new TrayManager()
  let scheduler: Scheduler | null = null

  app.on('second-instance', () => {
    windowManager.show()
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId(APP_USER_MODEL_ID)

    const repository = new AppStateRepository()
    repository.init()
    applyAutostart(repository.isOpenAtLogin())

    const notifications = new NotificationService()
    const reconcile = (): void => {
      scheduler?.reconcile()
    }

    scheduler = new Scheduler({
      getState: (now) => repository.getInMemoryState(now),
      sendNotification: (body) => {
        notifications.send(body)
      },
      markFired: (entry) => repository.appendNotification(entry),
      onStateChange: (view) => {
        windowManager.pushState(view)
        tray.updateState(view)
      }
    })

    const power = new PowerMonitorAdapter()
    power.init(reconcile)

    const quit = (): void => {
      app.quit()
    }

    registerIpcHandlers({
      getViewState: () => buildScheduleView(repository.getInMemoryState(), new Date()),
      savePermanentSchedule: (blocks) => {
        const result = repository.savePermanentSchedule(blocks)
        if (result.ok) reconcile()
        return result
      },
      saveDailyOverride: (blocks) => {
        const result = repository.saveDailyOverride(blocks)
        if (result.ok) reconcile()
        return result
      },
      resetDailyOverride: () => {
        repository.resetDailyOverride()
        reconcile()
      },
      pauseNotifications: () => {
        repository.pauseNotifications()
        reconcile()
      },
      resumeNotifications: () => {
        repository.resumeNotifications()
        reconcile()
      },
      quit,
      sendTestNotification: () => notifications.sendTest()
    })

    let trayReady = false
    try {
      tray.init({
        onOpen: () => windowManager.show(),
        onPause: () => {
          repository.pauseNotifications()
          reconcile()
        },
        onResume: () => {
          repository.resumeNotifications()
          reconcile()
        },
        onToggleAutostart: (enabled) => {
          repository.setOpenAtLogin(enabled)
          applyAutostart(enabled)
          tray.refreshAutostart()
        },
        onQuit: quit,
        isAutostartEnabled: () => repository.isOpenAtLogin()
      })
      trayReady = true
    } catch (error) {
      console.error('[tray] System tray is unavailable in this session', error)
    }

    scheduler.start()

    // A session without a tray has no other way to reach the window.
    if (!trayReady) windowManager.show()
  })

  app.on('before-quit', () => {
    windowManager.prepareToQuit()
    scheduler?.stop()
    tray.destroy()
  })

  // The hidden window is not the app. Exit only through the Quit action.
  app.on('window-all-closed', () => undefined)
}
