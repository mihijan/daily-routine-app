import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IpcDependencies } from '../../../src/main/ipc/handlers'

const ipc = vi.hoisted(() => ({
  handlers: new Map<
    string,
    (event: { senderFrame: { url: string } | null }, payload?: unknown) => unknown
  >()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (
      channel: string,
      handler: (event: { senderFrame: { url: string } | null }, payload?: unknown) => unknown
    ) => {
      ipc.handlers.set(channel, handler)
    }
  }
}))

import { registerIpcHandlers } from '../../../src/main/ipc/handlers'
import { IPC_CHANNELS } from '../../../src/shared/ipc-contracts'

const fileEvent = { senderFrame: { url: 'file:///app/index.html' } }
const evilEvent = { senderFrame: { url: 'https://evil.test/' } }

function dependencies(overrides: Partial<IpcDependencies> = {}): IpcDependencies {
  return {
    getViewState: vi.fn(),
    savePermanentSchedule: vi.fn(),
    saveDailyOverride: vi.fn(),
    resetDailyOverride: vi.fn(),
    pauseNotifications: vi.fn(),
    resumeNotifications: vi.fn(),
    quit: vi.fn(),
    ...overrides
  }
}

describe('registerIpcHandlers', () => {
  afterEach(() => {
    delete process.env['ELECTRON_RENDERER_URL']
    ipc.handlers.clear()
  })

  it('runs quit only for the app renderer', () => {
    const quit = vi.fn()
    registerIpcHandlers(dependencies({ quit }))
    const handler = ipc.handlers.get(IPC_CHANNELS.quit)

    expect(handler?.(fileEvent)).toBeUndefined()

    process.env['ELECTRON_RENDERER_URL'] = 'http://localhost:5173'
    expect(handler?.({ senderFrame: { url: 'http://localhost:5173/' } })).toBeUndefined()

    expect(() => handler?.(evilEvent)).toThrow(/sender/)
    expect(() => handler?.({ senderFrame: null })).toThrow(/sender/)
    expect(quit).toHaveBeenCalledTimes(2)
  })

  it('rejects an untrusted schedule save before it reaches the repository', () => {
    const savePermanentSchedule = vi.fn()
    registerIpcHandlers(dependencies({ savePermanentSchedule }))
    const handler = ipc.handlers.get(IPC_CHANNELS.savePermanentSchedule)

    expect(() => handler?.(evilEvent, [])).toThrow(/sender/)
    expect(savePermanentSchedule).not.toHaveBeenCalled()
  })

  it('rejects a schedule payload that is not an array', () => {
    const savePermanentSchedule = vi.fn()
    registerIpcHandlers(dependencies({ savePermanentSchedule }))
    const handler = ipc.handlers.get(IPC_CHANNELS.savePermanentSchedule)

    expect(handler?.(fileEvent, { broken: true })).toMatchObject({ ok: false })
    expect(savePermanentSchedule).not.toHaveBeenCalled()
  })
})
