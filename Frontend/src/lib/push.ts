import { api } from '../api/client'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out as Uint8Array<ArrayBuffer>
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await api.get<{ publicKey: string | null }>(
      '/push/vapid-public-key',
    )
    return res.data.publicKey
  } catch {
    return null
  }
}

/**
 * Best-effort Web Push enrollment. No-ops when the browser does not support
 * push, permission is denied, or the backend has not been configured with
 * VAPID keys. Safe to call on every login/bootstrap.
 */
export async function ensurePushSubscription(): Promise<void> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return
  }
  if (Notification.permission === 'denied') return

  const publicKey = await getVapidPublicKey()
  if (!publicKey) return

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return
  }

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const raw = sub.toJSON()
  const keys = raw.keys as { p256dh?: string; auth?: string }
  if (!raw.endpoint || !keys?.p256dh || !keys?.auth) return
  try {
    await api.post('/push/subscriptions', {
      subscription: {
        endpoint: raw.endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      },
    })
  } catch {
    // Push enrollment is optional; never block the app on it.
  }
}

/** Remove the current device's push subscription (e.g. on logout). */
export async function removePushSubscription(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    const raw = sub.toJSON()
    if (raw.endpoint) {
      try {
        await api.delete('/push/subscriptions', {
          data: { endpoint: raw.endpoint },
        })
      } catch {
        // best effort
      }
    }
    await sub.unsubscribe().catch(() => undefined)
  } catch {
    // best effort
  }
}