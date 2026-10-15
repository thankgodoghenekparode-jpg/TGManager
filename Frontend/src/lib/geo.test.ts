import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCurrentPosition } from './geo'

type SuccessCb = (pos: { coords: { latitude: number; longitude: number } }) => void
type ErrorCb = (err: { code: number; PERMISSION_DENIED?: number }) => void

function stubGeolocation(fn?: (success: SuccessCb, error: ErrorCb) => void) {
  vi.stubGlobal('navigator', fn ? { geolocation: { getCurrentPosition: fn } } : {})
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('getCurrentPosition', () => {
  it('reports "unavailable" when the browser has no geolocation API', async () => {
    stubGeolocation(undefined)
    await expect(getCurrentPosition(50)).resolves.toEqual({
      position: null,
      status: 'unavailable',
    })
  })

  it('resolves with the coordinates on success', async () => {
    stubGeolocation((success) => success({ coords: { latitude: 6.5244, longitude: 3.3792 } }))
    await expect(getCurrentPosition(50)).resolves.toEqual({
      position: { latitude: 6.5244, longitude: 3.3792 },
      status: 'ready',
    })
  })

  it('maps a denied permission error to "denied"', async () => {
    stubGeolocation((_success, error) => error({ code: 1, PERMISSION_DENIED: 1 }))
    await expect(getCurrentPosition(50)).resolves.toEqual({
      position: null,
      status: 'denied',
    })
  })

  it('never hangs: settles with "timeout" when the browser never calls back', async () => {
    vi.useFakeTimers()
    stubGeolocation(() => {
      /* mimics a permission prompt that is never answered */
    })
    const promise = getCurrentPosition(1000)
    await vi.advanceTimersByTimeAsync(2000)
    await expect(promise).resolves.toEqual({ position: null, status: 'timeout' })
  })

  it('settles when getCurrentPosition throws synchronously', async () => {
    stubGeolocation(() => {
      throw new Error('boom')
    })
    await expect(getCurrentPosition(50)).resolves.toEqual({
      position: null,
      status: 'unavailable',
    })
  })
})
