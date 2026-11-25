import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

function firstExisting(candidates: string[]): string {
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

/** App icon for the window and the installer. Tray uses the same artwork, scaled down. */
export function resolveAppIcon(): string {
  return firstExisting([
    join(process.resourcesPath, 'icon.png'),
    join(app.getAppPath(), 'resources', 'icon.png'),
    join(__dirname, '../resources/icon.png'),
    join(__dirname, '../../resources/icon.png')
  ])
}
