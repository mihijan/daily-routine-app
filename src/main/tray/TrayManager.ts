import { Menu, Tray, nativeImage } from 'electron'
import { trayTooltip } from '../../domain/schedule'
import { resolveAppIcon } from '../icons'
import { supportsAutostart } from '../startup/Autostart'
import type { ScheduleViewState } from '../../shared/types'

export interface TrayActions {
  onOpen: () => void
  onPause: () => void
  onResume: () => void
  onToggleAutostart: (enabled: boolean) => void
  onQuit: () => void
  isAutostartEnabled: () => boolean
}

/**
 * Tray icon, tooltip, and context menu.
 * The menu is rebuilt only when the pause or autostart label changes, so an open menu is not dismissed
 * on every one-second tooltip update.
 */
export class TrayManager {
  private tray: Tray | null = null
  private actions: TrayActions | null = null
  private paused = false
  private autostart = false

  init(actions: TrayActions): void {
    this.actions = actions
    this.autostart = actions.isAutostartEnabled()
    const image = nativeImage.createFromPath(resolveAppIcon()).resize({ width: 16, height: 16 })
    this.tray = new Tray(image)
    this.tray.setToolTip('Daily Routine')
    this.tray.on('click', () => actions.onOpen())
    this.renderMenu()
  }

  updateState(view: ScheduleViewState): void {
    if (!this.tray) return
    this.tray.setToolTip(trayTooltip(view))
    if (this.paused === view.paused) return
    this.paused = view.paused
    this.renderMenu()
  }

  refreshAutostart(): void {
    if (!this.actions) return
    this.autostart = this.actions.isAutostartEnabled()
    this.renderMenu()
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }

  private renderMenu(): void {
    if (!this.tray || !this.actions) return
    const actions = this.actions
    const paused = this.paused

    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Открыть расписание', click: () => actions.onOpen() },
        { type: 'separator' },
        {
          label: paused ? 'Возобновить' : 'Пауза до завтра',
          click: () => (paused ? actions.onResume() : actions.onPause())
        },
        {
          label: 'Автозапуск с Windows',
          type: 'checkbox',
          checked: this.autostart,
          enabled: supportsAutostart(),
          click: (item) => actions.onToggleAutostart(item.checked)
        },
        { type: 'separator' },
        { label: 'Выход', click: () => actions.onQuit() }
      ])
    )
  }
}
