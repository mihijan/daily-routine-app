import { describe, expect, it, vi } from 'vitest'

const power = vi.hoisted(() => ({
  listener: null as null | (() => void)
}))

vi.mock('electron', () => ({
  powerMonitor: {
    on: (_event: string, listener: () => void) => {
      power.listener = listener
    }
  }
}))

import { PowerMonitorAdapter } from '../../../src/main/power/PowerMonitorAdapter'

describe('PowerMonitorAdapter', () => {
  it('forwards the resume event', () => {
    const onResume = vi.fn()
    const adapter = new PowerMonitorAdapter()
    adapter.init(onResume)
    power.listener?.()
    expect(onResume).toHaveBeenCalledOnce()
  })
})
