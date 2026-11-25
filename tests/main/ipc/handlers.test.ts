import { afterEach, describe, expect, it, vi } from 'vitest'

const ipc = vi.hoisted(() => ({
  handler: null as
    null | ((event: { senderFrame: { url: string } | null }) => { delivered: boolean })
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (
      _channel: string,
      handler: (event: { senderFrame: { url: string } | null }) => { delivered: boolean }
    ) => {
      ipc.handler = handler
    }
  }
}))

import { registerIpcHandlers } from '../../../src/main/ipc/handlers'

describe('registerIpcHandlers', () => {
  afterEach(() => {
    delete process.env['ELECTRON_RENDERER_URL']
    ipc.handler = null
  })

  it('delivers the test notification only for the app renderer', () => {
    const sendTestNotification = vi.fn(() => true)
    registerIpcHandlers({ sendTestNotification })

    expect(ipc.handler?.({ senderFrame: { url: 'file:///app/index.html' } })).toEqual({
      delivered: true
    })

    process.env['ELECTRON_RENDERER_URL'] = 'http://localhost:5173'
    expect(ipc.handler?.({ senderFrame: { url: 'http://localhost:5173/' } })).toEqual({
      delivered: true
    })

    expect(() => ipc.handler?.({ senderFrame: { url: 'https://evil.test/' } })).toThrow(/sender/)
    expect(() => ipc.handler?.({ senderFrame: null })).toThrow(/sender/)
    expect(sendTestNotification).toHaveBeenCalledTimes(2)
  })
})
