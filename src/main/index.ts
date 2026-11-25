import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc/handlers'
import { NotificationService } from './notifications/NotificationService'
import { PowerMonitorAdapter } from './power/PowerMonitorAdapter'
import { Scheduler } from './scheduler/Scheduler'
import { AppStateRepository } from './store/AppStateRepository'

/** Matches electron-builder.yml appId. In dev the toolkit uses the Electron executable instead. */
const APP_USER_MODEL_ID = 'com.dailyroutine.app'

// isQuitting flag — prevents the 'close' handler from hiding the window during app.quit()
let isQuitting = false
let scheduler: Scheduler | null = null

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 640,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    title: 'Daily Routine',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Show window only after content is ready to avoid visual flash
  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Hide to tray on close instead of quitting (unless app.quit() was called)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  // Windows shows toasts only after an AppUserModelID is set. Tray and autostart come later.
  // The window stays eager until the tray task makes it lazy.
  electronApp.setAppUserModelId(APP_USER_MODEL_ID)

  const repository = new AppStateRepository()
  repository.init()

  const notifications = new NotificationService()
  scheduler = new Scheduler({
    getState: (now) => repository.getInMemoryState(now),
    sendNotification: (body) => {
      notifications.send(body)
    },
    markFired: (entry) => repository.appendNotification(entry)
  })

  const power = new PowerMonitorAdapter()
  power.init(() => scheduler?.reconcile())

  registerIpcHandlers({
    sendTestNotification: () => notifications.sendTest()
  })

  scheduler.start()
  createWindow()
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
