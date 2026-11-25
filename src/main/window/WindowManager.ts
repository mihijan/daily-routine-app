import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { resolveAppIcon } from '../icons'
import { IPC_CHANNELS } from '../../shared/ipc-contracts'
import type { ScheduleViewState } from '../../shared/types'

/**
 * The window is created the first time the user asks for it.
 * Closing it with × hides it. The process and the scheduler keep running.
 */
export class WindowManager {
  private window: BrowserWindow | null = null
  private isQuitting = false
  private pendingShow = false

  /** Call from `before-quit` before Electron delivers close events. */
  prepareToQuit(): void {
    this.isQuitting = true
  }

  show(): void {
    this.pendingShow = true
    const window = this.ensure()
    if (window.isDestroyed()) return
    if (window.isVisible()) {
      window.focus()
      return
    }
    if (!window.webContents.isLoading()) {
      window.show()
      window.focus()
    }
  }

  pushState(state: ScheduleViewState): void {
    if (!this.window || this.window.isDestroyed()) return
    this.window.webContents.send(IPC_CHANNELS.state, state)
  }

  private ensure(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) return this.window

    const window = new BrowserWindow({
      width: 460,
      height: 860,
      minWidth: 380,
      minHeight: 640,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#0b1120',
      title: 'Daily Routine',
      icon: resolveAppIcon(),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    window.on('close', (event) => {
      if (this.isQuitting) return
      event.preventDefault()
      window.hide()
    })

    window.once('ready-to-show', () => {
      if (!this.pendingShow || window.isDestroyed()) return
      window.show()
      window.focus()
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      window.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      window.loadFile(join(__dirname, '../renderer/index.html'))
    }

    this.window = window
    return window
  }
}
