import { getAccessToken, getAccessTokenCookie, getTenantId } from '../api/client'

type NativeBridge = { postMessage: (message: string) => void }

interface NativeBridgeWindow {
  ReactNativeWebView?: NativeBridge
}

function nativeBridge(): NativeBridge | null {
  if (typeof window === 'undefined') return null
  return (window as NativeBridgeWindow).ReactNativeWebView ?? null
}

/** True when the app is being rendered inside the native TGManager wrapper. */
export function isInNativeApp(): boolean {
  return Boolean(nativeBridge())
}

/**
 * Push the current auth session to the native wrapper so it can register this
 * device for push notifications (FCM on Android, APNs on iOS via Expo).
 */
export function syncAuthToNative(): void {
  const bridge = nativeBridge()
  if (!bridge) return
  const token = getAccessToken() ?? getAccessTokenCookie()
  const tenantId = getTenantId()
  if (!token || !tenantId) return
  bridge.postMessage(JSON.stringify({ type: 'auth', token, tenantId }))
}

export interface NativeMessage {
  type: string
  [key: string]: unknown
}

/**
 * Receive messages from the native wrapper (e.g. "navigate to a URL" when the
 * user taps a push notification). Returns an unsubscribe function.
 */
export function listenForNativeMessages(
  handler: (message: NativeMessage) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const onMessage = (event: MessageEvent) => {
    try {
      const parsed = JSON.parse(String(event.data ?? ''))
      if (parsed && typeof parsed.type === 'string') handler(parsed)
    } catch {
      // Ignore non-JSON or malformed messages.
    }
  }
  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}