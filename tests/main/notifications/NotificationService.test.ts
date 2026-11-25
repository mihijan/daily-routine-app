import { beforeEach, describe, expect, it, vi } from 'vitest'

const notificationMock = vi.hoisted(() => {
  const show = vi.fn()
  const Notification = vi.fn(function (this: { show: () => void }) {
    this.show = show
  })
  Notification.isSupported = vi.fn(() => true)
  return { Notification, show }
})

vi.mock('electron', () => ({
  Notification: notificationMock.Notification
}))

import { NotificationService } from '../../../src/main/notifications/NotificationService'

describe('NotificationService', () => {
  beforeEach(() => {
    notificationMock.Notification.mockClear()
    notificationMock.show.mockClear()
    notificationMock.Notification.isSupported.mockReturnValue(true)
  })

  it('shows a toast with the system sound and the default timeout', () => {
    const service = new NotificationService()
    expect(service.send('Слепая печать №1')).toBe(true)
    expect(notificationMock.Notification).toHaveBeenCalledWith({
      title: 'Daily Routine',
      body: 'Слепая печать №1',
      silent: false,
      timeoutType: 'default'
    })
    expect(notificationMock.show).toHaveBeenCalledOnce()
  })

  it('sends the manual check with a fixed body', () => {
    const service = new NotificationService()
    expect(service.sendTest()).toBe(true)
    expect(notificationMock.Notification).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Проверка уведомлений', silent: false })
    )
  })

  it('does not construct a toast when the platform cannot show one', () => {
    notificationMock.Notification.isSupported.mockReturnValue(false)
    const service = new NotificationService()
    expect(service.send('Привет')).toBe(false)
    expect(notificationMock.Notification).not.toHaveBeenCalled()
  })
})
