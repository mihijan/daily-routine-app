import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import { buildScheduleView } from '../domain/schedule'
import { registerIpcHandlers } from './ipc/handlers'
import { NotificationService } from './notifications/NotificationService'
import { PowerMonitorAdapter } from './power/PowerMonitorAdapter'
import { Scheduler } from './scheduler/Scheduler'
import { AppStateRepository } from './store/AppStateRepository'
import { IPC_CHANNELS } from '../shared/ipc-contracts'
import type { ScheduleViewState } from '../shared/types'

/** Matches electron-builder.yml appId. In dev the toolkit uses the Electron executable instead. */
const APP_USER_MODEL_ID = 'com.dailyroutine.app'

// isQuitting flag — prevents the 'close' handler from hiding the window during app.quit()
let isQuitting = false
let scheduler: Scheduler | null = null
let mainWindow: BrowserWindow | null = null

function publish(view: ScheduleViewState): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(IPC_CHANNELS.state, view)
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 460,
    height: 860,
    minWidth: 380,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b1120',
    title: 'Daily Routine',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Show window only after content is ready to avoid visual flash
  window.on('ready-to-show', () => window.show())

  // Hide to tray on close instead of quitting (unless app.quit() was called)
  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      window.hide()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

app.whenReady().then(() => {
  // Windows shows toasts only after an AppUserModelID is set. Tray and autostart come later.
  // The window stays eager until the tray task makes it lazy.
  electronApp.setAppUserModelId(APP_USER_MODEL_ID)

  const repository = new AppStateRepository()
  repository.init()

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
    onStateChange: publish
  })

  const power = new PowerMonitorAdapter()
  power.init(reconcile)

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
    quit: () => {
      app.quit()
    },
    sendTestNotification: () => notifications.sendTest()
  })

  scheduler.start()
  mainWindow = createWindow()
})

app.on('before-quit', () => {
  isQuitting = true
  scheduler?.stop()
})

// Prevent quitting when all windows are closed — app lives in tray
app.on('window-all-closed', () => {
  // Intentionally empty: the app continues running in the system tray.
  // It exits only via app.quit() triggered by the "Quit" action.
})
