import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

// isQuitting flag — prevents the 'close' handler from hiding the window during app.quit()
let isQuitting = false

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
  // TODO (Bootstrap): initialize AppStateRepository, TrayManager, Scheduler,
  //                   PowerMonitorAdapter, IPC handlers, autostart registration.
  //                   Window creation is currently eager for development purposes;
  //                   it will be made lazy (tray-triggered) in the Bootstrap task.
  createWindow()
})

app.on('before-quit', () => {
  isQuitting = true
})

// Prevent quitting when all windows are closed — app lives in tray
app.on('window-all-closed', () => {
  // Intentionally empty: the app continues running in the system tray.
  // It exits only via app.quit() triggered by the "Quit" action.
})
